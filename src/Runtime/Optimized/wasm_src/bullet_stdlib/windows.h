#pragma once 

// for btQuickprof

typedef unsigned long DWORD;
typedef int BOOL;

#define VOID void
typedef long LONG;

typedef long long LONGLONG;
typedef unsigned long long ULONGLONG;

typedef union _LARGE_INTEGER {
    struct {
        DWORD LowPart;
        LONG HighPart;
    } DUMMYSTRUCTNAME;
    struct {
        DWORD LowPart;
        LONG HighPart;
    } u;
    LONGLONG QuadPart;
} LARGE_INTEGER;

#define __declspec(x) // for compile __declspec(thread) to nothing

// time related functions is only used in profiling, so we can just return 0

BOOL QueryPerformanceCounter(LARGE_INTEGER* lpPerformanceCount);

BOOL QueryPerformanceFrequency(LARGE_INTEGER* lpFrequency);

DWORD GetTickCount(VOID);

ULONGLONG GetTickCount64(VOID);
