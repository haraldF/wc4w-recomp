# Differences from wc3w-recomp

The pipeline, generator and runtime started as copies of [wc3w-recomp](../wc3w-recomp)'s, and
nothing is shared at build time, so fixes go across by hand. This file lists what differs, so that
a fix in either project can be checked against the other. Keep it current when a shared file
changes. Lines like "WC3W.EXE" → "WC4W.EXE" in comments aren't listed.

## Fixes to carry back to wc3w-recomp

They apply to both games and aren't in wc3w-recomp yet:

- x87 rounding (`runtime/cpu.cpp`, `x87_fround`): `FIST`/`FISTP`/`FRNDINT` follow the control
  word's RC bits. Before, they always rounded to nearest, so the C library's `_ftol` (which sets
  chop) rounded `(int)f` instead of truncating it.
- x87 conversions out of range (`x87_ftrunc(a, size, to)`, `WcRecomp.java` passes the output size):
  the integer indefinite for NaN and values too large, not undefined behaviour.
- Division (`runtime/wc_rt.h`; `WcRecomp.java` passes the size to `udiv`): a quotient that doesn't
  fit (x86 #DE) is reported once and truncated; `INT64_MIN / -1` and `% -1` are defined.
- `WC_STRICT=1` (`wc_rt.h` `mem_addr`, `cpu.cpp` `mem_outside`, `cpu_div_overflow`): stops on
  memory outside 10000h–MEM_SIZE and on division overflow.
- `src/cli.ts`: input stamps for `decompile`/`recomp`/`build`, `--force`, `smoke`, stderr logs
  in `out/logs/`.
- `src/tre.ts`: checks the hash table and names records against `treHash`, `--names`.
- The virtual clock (`runtime/clock.cpp`, `host.h`; `WC_VIRTUAL_TIME`): `thread.cpp`, `kernel32.cpp`,
  `user32.cpp`, `ddraw.cpp` (the vertical blank), `movie.cpp` and `host_sdl.cpp` (`host_tick`) take
  their time from `clock_us` instead of five `steady_clock`s.
- `guest_ptr` (`win.h`) wherever a Windows function used `M + address` (`kernel32.cpp`, `ddraw.cpp`,
  `gdi32.cpp`, `dsound.cpp`, `winmm.cpp`, `user32.cpp`, `thread.cpp`, `win.cpp`'s `put_str`).
- `cpu.cpp` `mem_outside`: wrapped accesses reported once for each instruction.
- Hooks checked on both sides (`WcRecomp.java`'s `wc_hook_addr` and `summary.json`, `win.cpp`
  `check_hooks`, `cli.ts`); fragments only follow flows into the image.
- `movie.cpp`: frames shared with the host instead of copied twice, the clock going on past the
  sound's end, `wait_ahead`; `host_sdl.cpp` takes the frames due headless too (a headless movie
  never ended by itself, and its frames piled up).
- `sound.cpp`: linear interpolation between frames; `win.cpp` `win_thunk` without a string copy
  for each call; `thread.cpp` without the unused `thread_poll`.
- `src/cli.ts`: Ghidra's version in the stamps, the generator's summary, the unimplemented imports
  listed, smoke scenarios with a picture check, `drift`; `test/` (`npm test`).

## WC4-only (not for wc3w-recomp)

- `runtime/advapi32.cpp`: the registry (nothing found).
- `runtime/kernel32.cpp`: `GetCurrentDirectoryA`, `GetFileTime`, `SetFileTime`.
- `runtime/gdi32.cpp`: `StretchDIBits` and the windowed mode before message boxes (8-bit
  DIB_RGB_COLORS with the selected palette, 16-bit BI_RGB 5-5-5 and BI_BITFIELDS).
- `runtime/ddraw.cpp`: 16-bit display modes (RGB565 surfaces); `ddraw_frame` hands the host ARGB
  instead of 8-bit pixels and a palette (`host_sdl.cpp` follows, and screenshots are always RGB).
- `runtime/movie.cpp`: WC4W.EXE's addresses (Play_Movie 483AD0h, the branch list, halt flag...),
  scene names from `..\..\data\englmovi\sc_0010.AVI`.
- `runtime/fixes.cpp`: the movie handler's AVI check skipped (475721h); the integer math
  replacements (49D73Ch...: WC4W.EXE's addresses).
- `runtime/host_sdl.cpp`: the window's title.
- `src/tre.ts`: XTRE version 1 (WC4's hash, the hash table as a binary tree).
- `src/cli.ts`: the modules (`WC4W.EXE`, `Xanlib.dll` with their SHA-256), no DLL aliases (WC3W
  imports DirectDraw from `WC3EN.dll`).
