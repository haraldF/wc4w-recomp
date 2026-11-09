/* ADVAPI32: the registry, which has nothing (every key is missing). */
#include <cstdio>

#include "win.h"

API(ADVAPI32, RegOpenKeyExA, 5)
{
	if (wc_trace) fprintf(stderr, " [registry: %s]", arg(1) ? guest_str(arg(1)).c_str() : "");
	if (arg(4)) wr32(arg(4), 0);
	return ERROR_FILE_NOT_FOUND;
}
API(ADVAPI32, RegQueryValueExA, 6) { return ERROR_FILE_NOT_FOUND; }
API(ADVAPI32, RegCloseKey, 1) { return ERROR_INVALID_HANDLE; }
