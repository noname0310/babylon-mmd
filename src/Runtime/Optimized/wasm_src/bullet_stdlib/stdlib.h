#pragma once

#ifdef __wasm64__
typedef unsigned long long size_t;
#else
typedef unsigned long size_t;
#endif

// for btMiniSDF

namespace std {
    typedef size_t size_t;
}

//

#define NULL nullptr

extern "C" {
    void* bw_malloc(size_t size);
    void bw_free(void* ptr);
}

inline void* malloc(size_t size) noexcept {
    return bw_malloc(size);
}

inline void free(void* ptr) noexcept {
    bw_free(ptr);
}

// for btDbvt

#define __int32 int

//
