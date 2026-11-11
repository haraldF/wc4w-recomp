/* Fixes to the game's own flaws and to what GOG's release lacks, as hooks (hooks.txt), ported from
 * the enhancement patch (Mod_GeneralFixes.cpp; MIT, by Matt Wells). */
#include <cstdio>

#include "win.h"

namespace {

/* Continue the hooked function at another of its instructions (the patch's JMP): the recompiled
 * code entered there runs to the function's RET, which returns here through the shadow stack, and
 * the hooked function then returns too. */
bool jump(uint32_t to)
{
	run_code(to);
	return true;
}

/* The game's movie handler opens the scene's AVI (475767h: ..\..\data\englmovi\sc_0010.AVI, in
 * MOVIES*.TRE on the CDs) before playing it and, without it, says "Movie not found" and plays
 * TESTMOVI.AVI instead, which isn't there either ("Application files could not be found"). GOG's
 * archives hold only the in-flight movies; the scenes are MP4 files (movie.cpp). As the patch does,
 * the check is skipped (475721h to 475B09h). */
bool skip_movie_file_check(void) { return jump(0x475b09); }

/* The game's fixed-point helpers (cdecl, 32-bit arguments) multiply into EDX:EAX and divide it with
 * IDIV, which faults when the quotient doesn't fit in 32 bits: the patch's "crashes when imul/idiv
 * were overflowing". As the patch does, they are replaced by 64-bit arithmetic whose result is cut
 * to 32 bits. A zero divisor stops the program as it did (the patch's faults there too). */
int64_t arg_s(int i) { return (int32_t)rd32((uint32_t)rd(R_SP, 4) + 4 + 4 * (uint32_t)i); }

/* the function's return: EAX, and the RET (cdecl: the caller pops the arguments) */
bool returns(int64_t value)
{
	wr(R_AX, 4, (uint64_t)value);
	wr(R_SP, 4, rd(R_SP, 4) + 4);
	return true;
}

int64_t divide(int64_t a, int64_t b, uint32_t at)
{
	if (!b) cpu_div0(at);
	return a / b; /* |a| < 2^62: no INT64_MIN / -1 */
}

bool mul_256_div(void) { return returns(divide(arg_s(0) * 256, arg_s(1), 0x49d73c)); }       /* a * 256 / b */
bool mul_div_256(void) { return returns((arg_s(0) * arg_s(1)) >> 8); }                        /* a * b / 256 */
bool mul_div(void) { return returns(divide(arg_s(0) * arg_s(1), arg_s(2), 0x49d75e)); }       /* a * b / c */

/* The file loader (49AAE0h) about to give up on a file it must have, in no archive and not in the
 * folder: "Application files could not be found on the local hard drive or on any CD ROM drive",
 * and the program ends. Which file is the first thing to know: said here, then the game goes on to
 * its message. ESI is the file object, its name at the start. */
bool report_missing_file(void)
{
	fprintf(stderr, "wc: the game can't find %s (in no archive and not in the game folder)\n",
		guest_str((uint32_t)rd(R_SI, 4)).c_str());
	cpu_report(stderr);
	return false;
}

struct init {
	init()
	{
		hook_register(0x475721, skip_movie_file_check);
		hook_register(0x49ab31, report_missing_file);
		hook_register(0x49d73c, mul_256_div);
		hook_register(0x49d74f, mul_div_256);
		hook_register(0x49d75e, mul_div);
	}
} init_;

} // namespace
