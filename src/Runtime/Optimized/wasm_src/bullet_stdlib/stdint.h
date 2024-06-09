#pragma once

typedef int int32_t;
typedef unsigned int uint32_t;
typedef long long int64_t;
typedef unsigned long long uint64_t;
typedef short int16_t;
typedef unsigned short uint16_t;
typedef char int8_t;
typedef unsigned char uint8_t;

#ifdef __wasm64__
typedef uint64_t uintptr_t;
#else
typedef uint32_t uintptr_t;
#endif
