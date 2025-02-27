#pragma once

int printf(const char* fmt, ...);

#ifdef BT_DEBUG
void __debugbreak();
#endif
