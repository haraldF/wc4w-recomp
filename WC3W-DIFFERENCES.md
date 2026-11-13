# Differences from wc3w-recomp

The pipeline, generator and runtime started as copies of [wc3w-recomp](../wc3w-recomp)'s, and
nothing is shared at build time, so fixes go across by hand. This file lists what differs, so that
a fix in either project can be checked against the other. Keep it current when a shared file
changes. Lines like "WC3W.EXE" → "WC4W.EXE" in comments aren't listed.

## Fixes to carry back to wc3w-recomp

- `WC_TRACE_AT` without `WC_TRACE=2` (then no Windows calls), with all eight registers:
  `runtime/cpu.cpp` (`wc_trace_ins`), `main.cpp`, `wc_rt.h`.

The HD movies' subtitles were carried back on 13 November 2026 (`runtime/srt.cpp`,
`subtitle.cpp`, `subtitle.h`, `test/srt*`, FreeType in `CMakeLists.txt`, `movie.cpp`'s `find_file`
and `subtitles_for`). Earlier ones were all carried back. These were carried back (on 11 November 2026): x87 rounding and
out-of-range conversions, division overflow, `WC_STRICT`, wrapped memory reported, `guest_ptr`, the
hooks checked on both sides, the generator's summary and fragment filter, Ghidra's version in the
stamps, the virtual clock, the movie fixes (headless frames taken, shared frames, the clock past the
sound's end), the mixer's interpolation, `win_thunk` without a string copy, the CLI (stamps,
`--force`, smoke scenarios with a picture check, `drift`, the unimplemented imports, stderr logs in
`out/logs/`), `src/tre.ts` (both versions, the checks, `--names`) and `test/`.

What still differs in shared files for wc3w's reasons, not listed below: `fixes.cpp` (its own hooks
and the integer math at 46EABCh...), `hooks.txt`, `cli.ts` (the modules, `DLL_ALIASES`, the smoke
scenario: a new game to the first mission, no setup or `WC4.CFG`; `UNHANDLED_OPS` 3; the PNG
reader also takes indexed pictures, since its screenshots are 8-bit with a palette), `ddraw.cpp`
and `host_sdl.cpp` (8 bits only), the window's title, `src/tre.ts` (two comments name WC3W.EXE's
hash function). `npm run drift`: 20 of 40 shared files are the same.

## WC4-only (not for wc3w-recomp)

- `runtime/advapi32.cpp`: the registry (nothing found).
- `runtime/kernel32.cpp`: `GetCurrentDirectoryA`, `GetFileTime`, `SetFileTime`.
- `runtime/gdi32.cpp`: `StretchDIBits` and the windowed mode before message boxes (8-bit
  DIB_RGB_COLORS with the selected palette, 16-bit BI_RGB 5-5-5 and BI_BITFIELDS).
- `runtime/ddraw.cpp`: 16-bit display modes (RGB565 surfaces); `ddraw_frame` hands the host ARGB
  instead of 8-bit pixels and a palette (`host_sdl.cpp` follows, and screenshots are always RGB).
- `runtime/movie.cpp`: WC4W.EXE's addresses (Play_Movie 483AD0h, the branch list, halt flag...),
  scene names from `..\..\data\englmovi\sc_0010.AVI`.
  The subtitles' switch and language are the game's (4D8720h, 4B8014h); WC3W.EXE has neither, so
  wc3w-recomp's reads GOG's patch settings (`wc3w_en.ini`, `wc3w_en_ingame.ini`) and `WC_SUBTITLES`.
  A branch without its MP4 is skipped here (no AVI scenes); wc3w's plays the original movie.
- `runtime/fixes.cpp`: the movie handler's AVI check skipped (475721h); the integer math
  replacements (49D73Ch...: WC4W.EXE's addresses).
- `runtime/host_sdl.cpp`: the window's title.
- `src/cli.ts`: the modules (`WC4W.EXE`, `Xanlib.dll` with their SHA-256), no DLL aliases (WC3W
  imports DirectDraw from `WC3EN.dll`).
- `src/print-save.ts`: WC4's save format (PILT as 26 two-byte slots, morale 0-9 and flags; 25
  pilots; the slots' names from `WSG_NDX.WSG`), written anew rather than shared with wc3w's.
