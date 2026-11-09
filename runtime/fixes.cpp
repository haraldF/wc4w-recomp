/* Fixes to the game's own flaws and to what GOG's release lacks, as hooks (hooks.txt), ported from
 * the enhancement patch (Mod_GeneralFixes.cpp; MIT, by Matt Wells). */
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

struct init {
	init() { hook_register(0x475721, skip_movie_file_check); }
} init_;

} // namespace
