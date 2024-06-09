#pragma once

#include <stdlib.h>
#include <stdint.h>

void *memset(void *dest, int c, size_t n);

void *memcpy(void *__restrict dest, const void *__restrict src, size_t n);

int strncmp(const char *s1, const char *s2, size_t n);

void *memmove(void *dest, const void *src, size_t n);
