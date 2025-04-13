#pragma once

// for btScalar

extern "C" {
    // for single precision
    float bw_sqrtf(float x);

    float bw_fabsf(float x);

    float bw_cosf(float x);
    float bw_sinf(float x);
    float bw_tanf(float x);

    float bw_acosf(float x);
    float bw_asinf(float x);
    float bw_atanf(float x);
    float bw_atan2f(float y, float x);

    float bw_expf(float x);
    float bw_logf(float x);
    float bw_powf(float x, float y);
    float bw_fmodf(float x, float y);

    // for double precision
    double bw_cos(double x);
    double bw_sin(double x);
    double bw_tan(double x);

    double bw_acos(double x);
    double bw_asin(double x);
    double bw_atan(double x);
    double bw_atan2(double y, double x);

    double bw_exp(double x);
    double bw_log(double x);
    double bw_pow(double x, double y);
    double bw_fmod(double x, double y);

    // these are only for double precision
    double bw_sqrt(double x);
    double bw_floor(double x);
    double bw_ceil(double x);

    double bw_sqrt(double x);
}

inline float sqrtf(float x) {
    return bw_sqrtf(x);
}

inline float fabsf(float x) {
    return bw_fabsf(x);
}

inline float cosf(float x) {
    return bw_cosf(x);
}

inline float sinf(float x) {
    return bw_sinf(x);
}

inline float tanf(float x) {
    return bw_tanf(x);
}

inline float acosf(float x) {
    return bw_acosf(x);
}

inline float asinf(float x) {
    return bw_asinf(x);
}

inline float atanf(float x) {
    return bw_atanf(x);
}

inline float atan2f(float y, float x) {
    return bw_atan2f(y, x);
}

inline float expf(float x) {
    return bw_expf(x);
}

inline float logf(float x) {
    return bw_logf(x);
}

inline float powf(float x, float y) {
    return bw_powf(x, y);
}

inline float fmodf(float x, float y) {
    return bw_fmodf(x, y);
}

inline double cos(double x) {
    return bw_cos(x);
}

inline double sin(double x) {
    return bw_sin(x);
}

inline double tan(double x) {
    return bw_tan(x);
}

inline double acos(double x) {
    return bw_acos(x);
}

inline double asin(double x) {
    return bw_asin(x);
}

inline double atan(double x) {
    return bw_atan(x);
}

inline double atan2(double y, double x) {
    return bw_atan2(y, x);
}

inline double exp(double x) {
    return bw_exp(x);
}

inline double log(double x) {
    return bw_log(x);
}

inline double pow(double x, double y) {
    return bw_pow(x, y);
}

inline double fmod(double x, double y) {
    return bw_fmod(x, y);
}

// for xmmintrin.h

extern "C" {
    bool bw_isnan(double x);
    bool bw_isinf(double x);

    double bw_fabs(double x);
}

inline long int lrint(double x) {
    return (long int)x;
}

inline long long int llrint(double x) {
    return (long long int)x;
}

inline bool isinf(double x) {
    return bw_isinf(x);
}

inline bool isnan(double x) {
    return bw_isnan(x);
}

inline double fabs(double x) {
    return bw_fabs(x);
}

// for use SIMD instructions

#include <smmintrin.h>

//

// for btHeightfieldTerrainShape

inline double floor(double x) {
    return bw_floor(x);
}

inline double ceil(double x) {
    return bw_ceil(x);
}

//

// for ConstraintSolvers

inline double sqrt(double x) {
    return bw_sqrt(x);
}

//
