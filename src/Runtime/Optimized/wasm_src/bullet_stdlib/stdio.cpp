#include <stdio.h>
#include <stdarg.h>

#ifdef BT_DEBUG
extern "C" {
    int bw_error(char const* message, va_list args);
}
#endif

int printf(const char* fmt, ...) {
#ifdef BT_DEBUG
    va_list args;

    va_start(args, fmt);
    int bytes_written = bw_error(fmt, args);
    va_end(args);

    return bytes_written;
#else
    return 0;
#endif
}

#ifdef BT_DEBUG
void __debugbreak() {
}
#endif
