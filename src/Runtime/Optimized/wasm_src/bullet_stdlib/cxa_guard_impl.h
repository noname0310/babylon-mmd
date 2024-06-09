//===----------------------------------------------------------------------===//
//
// Part of the LLVM Project, under the Apache License v2.0 with LLVM Exceptions.
// See https://llvm.org/LICENSE.txt for license information.
// SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
//
//===----------------------------------------------------------------------===//

#ifndef LIBCXXABI_SRC_INCLUDE_CXA_GUARD_IMPL_H
#define LIBCXXABI_SRC_INCLUDE_CXA_GUARD_IMPL_H

/* cxa_guard_impl.h - Implements the C++ runtime support for function local
 * static guards.
 * The layout of the guard object is the same across ARM and Itanium.
 *
 * The first "guard byte" (which is checked by the compiler) is set only upon
 * the completion of cxa release.
 *
 * The second "init byte" does the rest of the bookkeeping. It tracks if
 * initialization is complete or pending, and if there are waiting threads.
 *
 * If the guard variable is 64-bits and the platforms supplies a 32-bit thread
 * identifier, it is used to detect recursive initialization. The thread ID of
 * the thread currently performing initialization is stored in the second word.
 *
 *  Guard Object Layout:
 * ---------------------------------------------------------------------------
 * | a+0: guard byte | a+1: init byte | a+2: unused ... | a+4: thread-id ... |
 * ---------------------------------------------------------------------------
 *
 * Note that we don't do what the ABI docs suggest (put a mutex in the guard
 * object which we acquire in cxa_guard_acquire and release in
 * cxa_guard_release). Instead we use the init byte to imitate that behaviour,
 * but without actually holding anything mutex related between aquire and
 * release/abort.
 *
 *  Access Protocol:
 *    For each implementation the guard byte is checked and set before accessing
 *    the init byte.
 *
 *  Overall Design:
 *    The implementation was designed to allow each implementation to be tested
 *    independent of the C++ runtime or platform support.
 *
 */

#include "__cxxabi_config.h"
#include "include/atomic_support.h" // from libc++
#if defined(__has_include)
#  if __has_include(<sys/syscall.h>)
#    include <sys/syscall.h>
#  endif
#  if __has_include(<unistd.h>)
#    include <unistd.h>
#  endif
#endif

#include <stdint.h>
#include <stdlib.h>

#if defined(__clang__)
#  pragma clang diagnostic push
#  pragma clang diagnostic ignored "-Wtautological-pointer-compare"
#elif defined(__GNUC__)
#  pragma GCC diagnostic push
#  pragma GCC diagnostic ignored "-Waddress"
#endif

// we don't need to implement ABORT_WITH_MESSAGE because there is no case where recursive initialization is detected
#define ABORT_WITH_MESSAGE(...)

namespace __cxxabiv1 {
// Use an anonymous namespace to ensure that the tests and actual implementation
// have unique definitions of these symbols.
namespace {

//===----------------------------------------------------------------------===//
//                          Misc Utilities
//===----------------------------------------------------------------------===//

template <class T, T (*Init)()>
struct LazyValue {
  LazyValue() : is_init(false) {}

  T& get() {
    if (!is_init) {
      value = Init();
      is_init = true;
    }
    return value;
  }

private:
  T value;
  bool is_init = false;
};

template <class IntType>
class AtomicInt {
public:
  using MemoryOrder = std::__libcpp_atomic_order;

  explicit AtomicInt(IntType* b) : b_(b) {}
  AtomicInt(AtomicInt const&) = delete;
  AtomicInt& operator=(AtomicInt const&) = delete;

  IntType load(MemoryOrder ord) { return std::__libcpp_atomic_load(b_, ord); }
  void store(IntType val, MemoryOrder ord) { std::__libcpp_atomic_store(b_, val, ord); }
  IntType exchange(IntType new_val, MemoryOrder ord) { return std::__libcpp_atomic_exchange(b_, new_val, ord); }
  bool compare_exchange(IntType* expected, IntType desired, MemoryOrder ord_success, MemoryOrder ord_failure) {
    return std::__libcpp_atomic_compare_exchange(b_, expected, desired, ord_success, ord_failure);
  }

private:
  IntType* b_;
};

//===----------------------------------------------------------------------===//
//                       PlatformGetThreadID
//===----------------------------------------------------------------------===//

extern "C" {
  uintptr_t bw_get_thread_id();
}

uint32_t PlatformThreadID() {
  return bw_get_thread_id();
}

//===----------------------------------------------------------------------===//
//                          GuardByte
//===----------------------------------------------------------------------===//

static constexpr uint8_t UNSET = 0;
static constexpr uint8_t COMPLETE_BIT = (1 << 0);
static constexpr uint8_t PENDING_BIT = (1 << 1);
static constexpr uint8_t WAITING_BIT = (1 << 2);

/// Manages reads and writes to the guard byte.
struct GuardByte {
  GuardByte() = delete;
  GuardByte(GuardByte const&) = delete;
  GuardByte& operator=(GuardByte const&) = delete;

  explicit GuardByte(uint8_t* const guard_byte_address) : guard_byte(guard_byte_address) {}

public:
  /// The guard byte portion of cxa_guard_acquire. Returns true if
  /// initialization has already been completed.
  bool acquire() {
    // if guard_byte is non-zero, we have already completed initialization
    // (i.e. release has been called)
    return guard_byte.load(std::_AO_Acquire) != UNSET;
  }

  /// The guard byte portion of cxa_guard_release.
  void release() { guard_byte.store(COMPLETE_BIT, std::_AO_Release); }

  /// The guard byte portion of cxa_guard_abort.
  void abort() {} // Nothing to do

private:
  AtomicInt<uint8_t> guard_byte;
};

//===----------------------------------------------------------------------===//
//                       InitByte Implementations
//===----------------------------------------------------------------------===//
//
// Each initialization byte implementation supports the following methods:
//
//  InitByte(uint8_t* _init_byte_address, uint32_t* _thread_id_address)
//    Construct the InitByte object, initializing our member variables
//
//  bool acquire()
//    Called before we start the initialization. Check if someone else has already started, and if
//    not to signal our intent to start it ourselves. We determine the current status from the init
//    byte, which is one of 4 possible values:
//      COMPLETE:           Initialization was finished by somebody else. Return true.
//      PENDING:            Somebody has started the initialization already, set the WAITING bit,
//                          then wait for the init byte to get updated with a new value.
//      (PENDING|WAITING):  Somebody has started the initialization already, and we're not the
//                          first one waiting. Wait for the init byte to get updated.
//      UNSET:              Initialization hasn't successfully completed, and nobody is currently
//                          performing the initialization. Set the PENDING bit to indicate our
//                          intention to start the initialization, and return false.
//    The return value indicates whether initialization has already been completed.
//
//  void release()
//    Called after successfully completing the initialization. Update the init byte to reflect
//    that, then if anybody else is waiting, wake them up.
//
//  void abort()
//    Called after an error is thrown during the initialization. Reset the init byte to UNSET to
//    indicate that we're no longer performing the initialization, then if anybody is waiting, wake
//    them up so they can try performing the initialization.
//

//===----------------------------------------------------------------------===//
//                    Single Threaded Implementation
//===----------------------------------------------------------------------===//

/// InitByteNoThreads - Doesn't use any inter-thread synchronization when
/// managing reads and writes to the init byte.
struct InitByteNoThreads {
  InitByteNoThreads() = delete;
  InitByteNoThreads(InitByteNoThreads const&) = delete;
  InitByteNoThreads& operator=(InitByteNoThreads const&) = delete;

  explicit InitByteNoThreads(uint8_t* _init_byte_address, uint32_t*) : init_byte_address(_init_byte_address) {}

  /// The init byte portion of cxa_guard_acquire. Returns true if
  /// initialization has already been completed.
  bool acquire() {
    if (*init_byte_address == COMPLETE_BIT)
      return true;
    if (*init_byte_address & PENDING_BIT)
      ABORT_WITH_MESSAGE("__cxa_guard_acquire detected recursive initialization: do you have a function-local static variable whose initialization depends on that function?");
    *init_byte_address = PENDING_BIT;
    return false;
  }

  /// The init byte portion of cxa_guard_release.
  void release() { *init_byte_address = COMPLETE_BIT; }
  /// The init byte portion of cxa_guard_abort.
  void abort() { *init_byte_address = UNSET; }

private:
  /// The address of the byte used during initialization.
  uint8_t* const init_byte_address;
};

//===----------------------------------------------------------------------===//
//                     Global Mutex Implementation
//===----------------------------------------------------------------------===//

typedef uint8_t mutex_t;
typedef uint32_t condvar_t;

extern "C" {
  mutex_t* bw_mutex_init();
  uint8_t bw_mutex_lock(mutex_t* mutex);
  uint8_t bw_mutex_unlock(mutex_t* mutex);

  condvar_t* bw_cond_init();
  uint8_t bw_cond_wait(condvar_t* condvar, mutex_t* mutex);
  uint8_t bw_cond_broadcast(condvar_t* condvar);
}

struct LibcppMutex;
struct LibcppCondVar;

#ifndef _LIBCXXABI_HAS_NO_THREADS
struct LibcppMutex {
  LibcppMutex(): mutex(bw_mutex_init()) {}
  LibcppMutex(LibcppMutex const&) = delete;
  LibcppMutex& operator=(LibcppMutex const&) = delete;

  bool lock() { 
    return bw_mutex_lock(mutex);
  }
  bool unlock() { 
    return bw_mutex_unlock(mutex);
  }

private:
  friend struct LibcppCondVar;
  mutex_t* mutex;
};

struct LibcppCondVar {
  LibcppCondVar(): cond(bw_cond_init()) {}
  LibcppCondVar(LibcppCondVar const&) = delete;
  LibcppCondVar& operator=(LibcppCondVar const&) = delete;

  bool wait(LibcppMutex& mut) { return bw_cond_wait(cond, mut.mutex); }
  bool broadcast() { return bw_cond_broadcast(cond); }

private:
  condvar_t* cond;
};
#else
struct LibcppMutex {};
struct LibcppCondVar {};
#endif // !defined(_LIBCXXABI_HAS_NO_THREADS)

/// InitByteGlobalMutex - Uses a global mutex and condition variable (common to
/// all static local variables) to manage reads and writes to the init byte.
template <class Mutex, class CondVar, Mutex& global_mutex, CondVar& global_cond,
          uint32_t (*GetThreadID)() = PlatformThreadID>
struct InitByteGlobalMutex {

  explicit InitByteGlobalMutex(uint8_t* _init_byte_address, uint32_t* _thread_id_address)
      : init_byte_address(_init_byte_address), thread_id_address(_thread_id_address),
        has_thread_id_support(_thread_id_address != nullptr && GetThreadID != nullptr) {}

public:
  /// The init byte portion of cxa_guard_acquire. Returns true if
  /// initialization has already been completed.
  bool acquire() {
    LockGuard g("__cxa_guard_acquire");
    // Check for possible recursive initialization.
    if (has_thread_id_support && (*init_byte_address & PENDING_BIT)) {
      if (*thread_id_address == current_thread_id.get())
        ABORT_WITH_MESSAGE("__cxa_guard_acquire detected recursive initialization: do you have a function-local static variable whose initialization depends on that function?");
    }

    // Wait until the pending bit is not set.
    while (*init_byte_address & PENDING_BIT) {
      *init_byte_address |= WAITING_BIT;
      global_cond.wait(global_mutex);
    }

    if (*init_byte_address == COMPLETE_BIT)
      return true;

    if (has_thread_id_support)
      *thread_id_address = current_thread_id.get();

    *init_byte_address = PENDING_BIT;
    return false;
  }

  /// The init byte portion of cxa_guard_release.
  void release() {
    bool has_waiting;
    {
      LockGuard g("__cxa_guard_release");
      has_waiting = *init_byte_address & WAITING_BIT;
      *init_byte_address = COMPLETE_BIT;
    }
    if (has_waiting) {
      if (global_cond.broadcast()) {
        ABORT_WITH_MESSAGE("%s failed to broadcast", "__cxa_guard_release");
      }
    }
  }

  /// The init byte portion of cxa_guard_abort.
  void abort() {
    bool has_waiting;
    {
      LockGuard g("__cxa_guard_abort");
      if (has_thread_id_support)
        *thread_id_address = 0;
      has_waiting = *init_byte_address & WAITING_BIT;
      *init_byte_address = UNSET;
    }
    if (has_waiting) {
      if (global_cond.broadcast()) {
        ABORT_WITH_MESSAGE("%s failed to broadcast", "__cxa_guard_abort");
      }
    }
  }

private:
  /// The address of the byte used during initialization.
  uint8_t* const init_byte_address;
  /// An optional address storing an identifier for the thread performing initialization.
  /// It's used to detect recursive initialization.
  uint32_t* const thread_id_address;

  const bool has_thread_id_support;
  LazyValue<uint32_t, GetThreadID> current_thread_id;

private:
  struct LockGuard {
    LockGuard() = delete;
    LockGuard(LockGuard const&) = delete;
    LockGuard& operator=(LockGuard const&) = delete;

    explicit LockGuard(const char* calling_func) : calling_func_(calling_func) {
      if (global_mutex.lock())
        ABORT_WITH_MESSAGE("%s failed to acquire mutex", calling_func_);
    }

    ~LockGuard() {
      if (global_mutex.unlock())
        ABORT_WITH_MESSAGE("%s failed to release mutex", calling_func_);
    }

  private:
    const char* const calling_func_;
  };
};

//===----------------------------------------------------------------------===//
//                          GuardObject
//===----------------------------------------------------------------------===//

enum class AcquireResult {
  INIT_IS_DONE,
  INIT_IS_PENDING,
};
constexpr AcquireResult INIT_IS_DONE = AcquireResult::INIT_IS_DONE;
constexpr AcquireResult INIT_IS_PENDING = AcquireResult::INIT_IS_PENDING;

/// Co-ordinates between GuardByte and InitByte.
template <class InitByteT>
struct GuardObject {
  GuardObject() = delete;
  GuardObject(GuardObject const&) = delete;
  GuardObject& operator=(GuardObject const&) = delete;

private:
  GuardByte guard_byte;
  InitByteT init_byte;

public:
  /// ARM Constructor
  explicit GuardObject(uint32_t* raw_guard_object)
      : guard_byte(reinterpret_cast<uint8_t*>(raw_guard_object)),
        init_byte(reinterpret_cast<uint8_t*>(raw_guard_object) + 1, nullptr) {}

  /// Itanium Constructor
  explicit GuardObject(uint64_t* raw_guard_object)
      : guard_byte(reinterpret_cast<uint8_t*>(raw_guard_object)),
        init_byte(reinterpret_cast<uint8_t*>(raw_guard_object) + 1, reinterpret_cast<uint32_t*>(raw_guard_object) + 1) {
  }

  /// Implements __cxa_guard_acquire.
  AcquireResult cxa_guard_acquire() {
    // Use short-circuit evaluation to avoid calling init_byte.acquire when
    // guard_byte.acquire returns true. (i.e. don't call it when we know from
    // the guard byte that initialization has already been completed)
    if (guard_byte.acquire() || init_byte.acquire())
      return INIT_IS_DONE;
    return INIT_IS_PENDING;
  }

  /// Implements __cxa_guard_release.
  void cxa_guard_release() {
    // Update guard byte first, so if somebody is woken up by init_byte.release
    // and comes all the way back around to __cxa_guard_acquire again, they see
    // it as having completed initialization.
    guard_byte.release();
    init_byte.release();
  }

  /// Implements __cxa_guard_abort.
  void cxa_guard_abort() {
    guard_byte.abort();
    init_byte.abort();
  }
};

//===----------------------------------------------------------------------===//
//                          Convenience Classes
//===----------------------------------------------------------------------===//

/// NoThreadsGuard - Manages initialization without performing any inter-thread
/// synchronization.
using NoThreadsGuard = GuardObject<InitByteNoThreads>;

/// GlobalMutexGuard - Manages initialization using a global mutex and
/// condition variable.
template <class Mutex, class CondVar, Mutex& global_mutex, CondVar& global_cond,
          uint32_t (*GetThreadID)() = PlatformThreadID>
using GlobalMutexGuard = GuardObject<InitByteGlobalMutex<Mutex, CondVar, global_mutex, global_cond, GetThreadID>>;

//===----------------------------------------------------------------------===//
//
//===----------------------------------------------------------------------===//

template <class T>
struct GlobalStatic {
  static T instance;
};
template <class T>
// _LIBCPP_CONSTINIT // disable constinit for avoid compile error
T GlobalStatic<T>::instance = {};

enum class Implementation { NoThreads, GlobalMutex };

template <Implementation Impl>
struct SelectImplementation;

template <>
struct SelectImplementation<Implementation::NoThreads> {
  using type = NoThreadsGuard;
};

template <>
struct SelectImplementation<Implementation::GlobalMutex> {
  using type = GlobalMutexGuard<LibcppMutex, LibcppCondVar, GlobalStatic<LibcppMutex>::instance,
                                GlobalStatic<LibcppCondVar>::instance, PlatformThreadID>;
};

// TODO(EricWF): We should prefer the futex implementation when available. But
// it should be done in a separate step from adding the implementation.
constexpr Implementation CurrentImplementation =
#if defined(_LIBCXXABI_HAS_NO_THREADS)
    Implementation::NoThreads;
#else
    Implementation::GlobalMutex;
#endif

using SelectedImplementation = SelectImplementation<CurrentImplementation>::type;

} // end namespace
} // end namespace __cxxabiv1

#if defined(__clang__)
#  pragma clang diagnostic pop
#elif defined(__GNUC__)
#  pragma GCC diagnostic pop
#endif

#endif // LIBCXXABI_SRC_INCLUDE_CXA_GUARD_IMPL_H
