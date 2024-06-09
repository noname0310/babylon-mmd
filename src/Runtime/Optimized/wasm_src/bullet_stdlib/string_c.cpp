#include <string.h>

//ref: https://github.com/emscripten-core/emscripten/blob/0ca463011d0db12de9954b6b15d03f88dcd1eeaa/system/lib/libc/musl/src/string/memset.c#L4

void *memset(void *dest, int c, size_t n)
{
    unsigned char *s = static_cast<unsigned char *>(dest);
    size_t k;

    /* Fill head and tail with minimal branching. Each
     * conditional ensures that all the subsequently used
     * offsets are well-defined and in the dest region. */

    if (!n) return dest;
    s[0] = c;
    s[n-1] = c;
    if (n <= 2) return dest;
    s[1] = c;
    s[2] = c;
    s[n-2] = c;
    s[n-3] = c;
    if (n <= 6) return dest;
    s[3] = c;
    s[n-4] = c;
    if (n <= 8) return dest;

    /* Advance pointer to align it at a 4-byte boundary,
     * and truncate n to a multiple of 4. The previous code
     * already took care of any head/tail that get cut off
     * by the alignment. */

    k = -(uintptr_t)s & 3;
    s += k;
    n -= k;
    n &= -4;

#ifdef __GNUC__
    typedef uint32_t __attribute__((__may_alias__)) u32;
    typedef uint64_t __attribute__((__may_alias__)) u64;

    u32 c32 = ((u32)-1)/255 * (unsigned char)c;

    /* In preparation to copy 32 bytes at a time, aligned on
     * an 8-byte bounary, fill head/tail up to 28 bytes each.
     * As in the initial byte-based head/tail fill, each
     * conditional below ensures that the subsequent offsets
     * are valid (e.g. !(n<=24) implies n>=28). */

    *(u32 *)(s+0) = c32;
    *(u32 *)(s+n-4) = c32;
    if (n <= 8) return dest;
    *(u32 *)(s+4) = c32;
    *(u32 *)(s+8) = c32;
    *(u32 *)(s+n-12) = c32;
    *(u32 *)(s+n-8) = c32;
    if (n <= 24) return dest;
    *(u32 *)(s+12) = c32;
    *(u32 *)(s+16) = c32;
    *(u32 *)(s+20) = c32;
    *(u32 *)(s+24) = c32;
    *(u32 *)(s+n-28) = c32;
    *(u32 *)(s+n-24) = c32;
    *(u32 *)(s+n-20) = c32;
    *(u32 *)(s+n-16) = c32;

    /* Align to a multiple of 8 so we can fill 64 bits at a time,
     * and avoid writing the same bytes twice as much as is
     * practical without introducing additional branching. */

    k = 24 + ((uintptr_t)s & 4);
    s += k;
    n -= k;

    /* If this loop is reached, 28 tail bytes have already been
     * filled, so any remainder when n drops below 32 can be
     * safely ignored. */

    u64 c64 = c32 | ((u64)c32 << 32);
    for (; n >= 32; n-=32, s+=32) {
        *(u64 *)(s+0) = c64;
        *(u64 *)(s+8) = c64;
        *(u64 *)(s+16) = c64;
        *(u64 *)(s+24) = c64;
    }
#else
    /* Pure C fallback with no aliasing violations. */
    for (; n; n--, s++) *s = c;
#endif

    return dest;
}

//ref: https://github.com/emscripten-core/emscripten/blob/b059a0c8896edc9e9866e1ef212a5e95ba345998/system/lib/libc/emscripten_memcpy.c

void *memcpy(void *__restrict dest, const void *__restrict src, size_t n)
{
    unsigned char *d = static_cast<unsigned char *>(dest);
    const unsigned char *s = static_cast<const unsigned char *>(src);

    unsigned char *aligned_d_end;
    unsigned char *block_aligned_d_end;
    unsigned char *d_end;

    d_end = d + n;
    if ((((uintptr_t)d) & 3) == (((uintptr_t)s) & 3))
    {
        // The initial unaligned < 4-byte front.
        while ((((uintptr_t)d) & 3) && d < d_end)
        {
            *d++ = *s++;
        }
        aligned_d_end = (unsigned char *)(((uintptr_t)d_end) & -4);
        if (((uintptr_t)aligned_d_end) >= 64)
        {
            block_aligned_d_end = aligned_d_end - 64;
            while (d <= block_aligned_d_end)
            {
                // TODO: we could use 64-bit ops here, but we'd need to make sure the
                //       alignment is 64-bit, which might cost us
                *(((uint32_t *)d)) = *(((uint32_t *)s));
                *(((uint32_t *)d) + 1) = *(((uint32_t *)s) + 1);
                *(((uint32_t *)d) + 2) = *(((uint32_t *)s) + 2);
                *(((uint32_t *)d) + 3) = *(((uint32_t *)s) + 3);
                *(((uint32_t *)d) + 4) = *(((uint32_t *)s) + 4);
                *(((uint32_t *)d) + 5) = *(((uint32_t *)s) + 5);
                *(((uint32_t *)d) + 6) = *(((uint32_t *)s) + 6);
                *(((uint32_t *)d) + 7) = *(((uint32_t *)s) + 7);
                *(((uint32_t *)d) + 8) = *(((uint32_t *)s) + 8);
                *(((uint32_t *)d) + 9) = *(((uint32_t *)s) + 9);
                *(((uint32_t *)d) + 10) = *(((uint32_t *)s) + 10);
                *(((uint32_t *)d) + 11) = *(((uint32_t *)s) + 11);
                *(((uint32_t *)d) + 12) = *(((uint32_t *)s) + 12);
                *(((uint32_t *)d) + 13) = *(((uint32_t *)s) + 13);
                *(((uint32_t *)d) + 14) = *(((uint32_t *)s) + 14);
                *(((uint32_t *)d) + 15) = *(((uint32_t *)s) + 15);
                d += 64;
                s += 64;
            }
        }
        while (d < aligned_d_end)
        {
            *((uint32_t *)d) = *((uint32_t *)s);
            d += 4;
            s += 4;
        }
    }
    else
    {
        // In the unaligned copy case, unroll a bit as well.
        if (((uintptr_t)d_end) >= 4)
        {
            aligned_d_end = d_end - 4;
            while (d <= aligned_d_end)
            {
                *d = *s;
                *(d + 1) = *(s + 1);
                *(d + 2) = *(s + 2);
                *(d + 3) = *(s + 3);
                d += 4;
                s += 4;
            }
        }
    }
    // The remaining unaligned < 4 byte tail.
    while (d < d_end)
    {
        *d++ = *s++;
    }
    return dest;
}

int strncmp(const char *s1, const char *s2, size_t n)
{
    unsigned char u1, u2;

    while (n-- > 0)
    {
        u1 = (unsigned char)*s1++;
        u2 = (unsigned char)*s2++;
        if (u1 != u2)
            return u1 - u2;
        if (u1 == '\0')
            return 0;
    }
    return 0;
}

// ref: https://github.com/emscripten-core/emscripten/blob/b059a0c8896edc9e9866e1ef212a5e95ba345998/system/lib/libc/emscripten_memmove.c

void *memmove(void *dest, const void *src, size_t n) {
  if (dest < src) return memcpy(dest, src, n);
  unsigned char *d = (unsigned char *)dest + n;
  const unsigned char *s = (const unsigned char *)src + n;
#pragma clang loop unroll(disable)
  while(n--) *--d = *--s;
  return dest;
}
