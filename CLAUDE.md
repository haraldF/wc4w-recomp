# CLAUDE.md

Notes for working on this project: what was found out the hard way. The README describes the
pipeline and usage; this file records the facts and pitfalls behind it.

## Goal

A native executable (arm64 macOS first, no Wine or Rosetta) of Wing Commander IV's Windows version,
`WC4W.EXE` as GOG's 30th Anniversary Edition (2026) has it, made by statically recompiling it to
C++. The user doesn't care about naming or understanding the code, only about running it.

Split off from wc3w-recomp (`../wc3w-recomp`, Wing Commander III's Windows version, fully
playable): its CLAUDE.md has the background on the one-image layout, the generator (p-code to C++,
the shadow return stack, x87, patched constants), the Win32/DirectX runtime, threads, sound, the
joystick and the HD movies. Its own background (the DOS extender, the SDL host) is in
`../wc3-recomp/CLAUDE.md`. Nothing is shared at build time; carry fixes across by hand. Only what
is verified for WC4 is recorded here.

Never commit game files or anything derived from their bytes: `WC4W.EXE`, the DLLs, the `.TRE` and
`.IFF` files, `WC4.CFG`, the movies, the mapped image (`out/image.bin`), Ghidra projects,
screenshots. Everything under `out/` is generated and ignored. Run the game headless
(`WC_HEADLESS=1`) and in a scratch copy of the game folder (small files copied, `.TRE` files and
movie folders linked): it writes `WC4.CFG` and saves there.

## The game files

- GOG's installer (`setup_..._(95014).exe` + 6 `.bin` parts, 23 GB) is Inno Setup: `innoextract
  --gog -I WC4_Enhanced` unpacks the game folder (17 GB with the movies). `WC4_DVD/` is the plain
  DVD edition, `Extras/` PDFs, `__support/` the patch's per-user files.
- GOG's launcher (`Wing Commander IV.exe`, `goggame-2023550212.info`: `/movies_path=
  Master_FMVs_Upscaled\`, `_Source\` or `vob\`) runs **`wc4dvd.exe -L0`**, not `WC4W.EXE`.
  `wc4dvd.exe` is the 1997 DVD edition (MSVC 5, linked 16 Sep 1997, no base relocations, image
  400000h-4D9000h): it imports `DirectDrawCreate` from `DWRAP.dll` (the enhancement patch built
  for it), its movies from `mpeg2.dll` (class `MPEG`, DirectShow MPEG-2) and XanLib like WC4W.EXE.
  `WC4W.EXE` is the 1996 CD version, which this project recompiles (as asked); the patch's
  `ddraw.dll` is the build for it. Both builds come from one source (below).
- `WC4_Enhanced/`: `WC4W.EXE`, `Xanlib.dll`, the data as `.TRE` archives (`Gameflow`, `INSTALL`,
  `Language`, `MOVIES1`-`6`, `Music1`/`MUSIC2`-`4`, `Missions`, `Objects`, `SPECIAL1`-`6`,
  `Wc4misc`), `Globals.iff`, `Wc4lang.iff` (English, German, French), `Wc4.cds` (which TREs each
  of the 6 CDs has, as `WC3.CON` did), `WC4.CFG` (137 bytes, the configuration: GOG's makes the
  game run its setup), `WSG_NDX.WSG`, `SFOSAVED.DAT`. Movies: `Master_FMVs_Upscaled/` and
  `Master_FMVs_Source/` (`SC_0010A.mp4`..., upper case, with `subtitles/*.srt`), `vob/` (the DVD's,
  with a `movies.ini` renaming a few branches). `ddraw.dll`/`dwrap.dll` + `wc4w_en*.ini`: the
  enhancement patch; `libvlc*.dll`, `plugins/`: VLC for it; `dxmci.dll`, `mpeg2.dll`, AC3Filter,
  `Mpeg2DecFilter.ax`: the DVD edition's movie playback. None of those are needed.
- **GOG's `MOVIES*.TRE` don't have the CD version's scenes** (`..\..\data\englmovi\sc_0010.AVI`):
  MOVIES1.TRE is 28 MB, 153 entries starting with AVI `00db` chunks (the in-flight comms). The
  scenes exist only as MP4. WC4W.EXE plays them through the HD movie hook (below) or not at all.
- The **Wing Commander IV Enhancement Patch** by Matt Wells (MIT): source at
  `github.com/mattwells77/Wing_Commander_IV_Enhancement_Patch` (`wc4w_en/`; `VERSION_WC4_DVD`
  picks the DVD build). `wc4w.cpp` names WC4W.EXE's addresses (the `#else` branches), which match
  this file (e.g. `szAppName` 4DB6F8h, the title of every message box). `Mod_Movies.cpp`,
  `Mod_GeneralFixes.cpp` have the code patches to port.

## The modules (src/pe.ts, npm run imports)

- `WC4W.EXE`: PE32, i386, linked 12 Jul 1996 (linker 2.55: MSVC 2.x), image base 400000h, entry
  4B0640h, SizeOfImage F0000h; `.text` 401000h (B65D4h), `.bss` 4B8000h (179CCh, no file data),
  `.rdata` 4D0000h, `.data` 4D3000h, `.idata` 4DE000h, `.rsrc` 4E0000h, `.reloc` (22592
  relocations). Stack reserve 1 MB. SHA-256 97dd8663...7b70.
- `Xanlib.dll`: byte-identical to WC3W's `XANLIB.DLL` (same SHA-256 5b7f494a...0c4f), moved from
  90000000h to 200000h as there. The image is 200000h-4F0000h; VirtualAlloc's regions start at
  500000h as in wc3w-recomp.
- Imports: KERNEL32 61 (+ XanLib's 15), USER32 30 (+1), GDI32 8, ADVAPI32 3 (`RegOpenKeyExA`,
  `RegQueryValueExA`, `RegCloseKey`: new; stubs that find nothing, not called so far), DDRAW 1
  (`DirectDrawCreate` straight from `DDRAW.dll`: no renamed import, unlike WC3W's `WC3EN.dll`),
  WINMM 2 joystick + XanLib's 12 waveOut, XanLib 40 (its C++ classes, including `XDMOVIE`).
  121 Windows functions. Missing from wc3w's runtime and added: `GetCurrentDirectoryA` (C:\),
  `GetFileTime`/`SetFileTime` (no times kept), the registry, `StretchDIBits`. Not implemented yet
  (not called so far): `RtlUnwind`, `RaiseException`, `UnhandledExceptionFilter`,
  `ReadConsoleInputA`. Loaded at run time: `dsound.dll` (`DirectSoundCreate`, as WC3W), and the C
  library asks `GetProcAddress(kernel32, "GetProcessAffinityMask")` (not there: fine).

## Ghidra and the generator

- Analysis (`npm run decompile`) takes about half a minute. The generator as in wc3w-recomp:
  2898 functions + 1287 fragments decoded from 1369 relocation targets outside every function,
  238720 instructions in 49 files. No `discover` round was needed so far (no `entries.txt`).
- The texture mappers patch their own code as in WC3W: 1560 instructions read patched constants
  (48F000h-493FFFh; the game makes 48D864h-494F92h writable with VirtualProtect).
- 6 "unhandled CALLOTHER segment" ops: data decoded as code (`[BX+SI]`, 16-bit addressing), in
  fragments that never run.

## How it runs (headless, all verified)

- Startup like WC3W: "Loading Wing Commander IV.", the window (class `WING COMMANDER IV`),
  DirectSound, DirectDraw 640x480x8 with a back buffer ("Card is not bank switched. Using double
  buffer mode.") and a 320x240 off-screen surface, `joyGetDevCapsA`, `GLOBALS.IFF`,
  `WC4LANG.IFF`, `WC4.CFG`, `INSTALL.TRE`, `LANGUAGE.TRE`, then CD1's TREs from `Wc4.cds`.
- With GOG's `WC4.CFG` the game runs its setup first: "Machine Speed Test" (the left button,
  (55,325), runs it: CPU speed 1, video 0), then options: spaceflight VGA/SVGA, movies and
  gameflow "SVGA 8 bit" or "SVGA 16 bit" (16 preselected), subtitles, movie optimisations;
  top-left (55,165) "Test Movie", right (585,325) "Main Install Menu" (from the first screen, that
  button quits). The install menu ("Install and Configuration": game directory C:\, Direct Sound,
  the video choices, control type) starts the game with "IV" (320,330), which writes `WC4.CFG`.
- **16 bits isn't supported yet**: with 16-bit gameflow the game creates a 16-bit DIB section and
  asks `SetDisplayMode(640, 480, 16)`, which the runtime refuses ("Full screen mode
  initialization failed"). With 8 bits it runs. Script for 8 bits (mouse in 640x480):
  `8000:@55.325,8500:+lmb,8650:-lmb,20000:@154.327,20500:+lmb,20650:-lmb,21500:@322.224,
  22000:+lmb,22150:-lmb,24000:@585.325,24500:+lmb,24650:-lmb,30000:@320.330,30500:+lmb,
  30650:-lmb` (speed test, gameflow 8 bit, movies 8 bit, install menu, IV). Keep the `WC4.CFG`
  it writes to start the game directly next time.
- Before a movie the game shows windowed GDI pictures on errors: it drops DirectDraw, draws its
  640x480x8 DIB section with `StretchDIBits` (DIB_RGB_COLORS, its palette selected) and shows the
  message box.
- Movies: the movie handler opens the scene's AVI first (475767h, `49AA80h` file load); without it
  "Movie not found" and `TESTMOVI.AVI`, then "Application files could not be found on the local
  hard drive or on any CD ROM drive" and the exit. The patch jumps over that check (475721h to
  475B09h, "Fix for dvd version of the game which does not include the original movies"):
  `fixes.cpp` does the same. Then Play_Movie (483AD0h) is replaced by `movie.cpp` (wc3w's, with
  WC4W.EXE's addresses from the patch: branch list 4C6FE8h, index 4D94D0h, halt flag 4D94C0h,
  frame count 4D94A4h, click time 4C7C80h, frequency 4C01D8h, translate messages 4ADE20h, message
  nodes 4AE2A0h/4AE2E0h, movie messages 4827F0h, draw_movie_frame 4830D0h before handle_movie(0)
  4754F0h). The intro `SC_0010A.mp4` (1080p) plays.
- Esc during the intro leads to the opening "Virtual Combat Mode" (a simulator fight with Maniac):
  space flight in 640x480x8 with the cockpit, the in-flight comm video (from MOVIES1.TRE through
  XanLib), targeting and guns. After it the gameflow's "Duty Roster" (load/save) screen. 100 s of
  that ran without a stop: `WC_KEYS=5000:esc,20000:t,25000:+space,27000:-space,30000:enter,...`.

## Hooks (hooks.txt)

As in wc3w-recomp: the generated code first calls `wc_hook(addr)`; a handler returning true makes
the generated function return. To continue elsewhere in the function (a patch's JMP), the handler
enters the recompiled code there with `run_code(to)` and returns true: the function's own RET then
returns through the shadow stack (`fixes.cpp`, `jump`).
- 483AD0h: Play_Movie, the HD movies (`movie.cpp`).
- 475721h: the movie handler's AVI check, skipped (`fixes.cpp`).

## Not done / next

1. 16-bit DirectDraw (640x480x16 primary and surfaces, RGB565 or 555 to the host) and 16-bit DIB
   sections with StretchDIBits: GOG's default gameflow and movie settings, the patch's "16bit
   movies" paths.
2. The rest of the patch's WC4W.EXE fixes (`Mod_GeneralFixes.cpp`'s `#else` branch): the DATA
   folder lookup (49AB03h), the integer math replacements (49D73Ch...: "crashes when imul/idiv
   were overflowing"), the long pause after autopilot (487E31h), more memory (4AD0B2h), more
   watchers (4A14B5h), the texture sampler crash fix; in-flight HD movies (424722h, 424A84h,
   441AFEh), subtitles, choice-text colours.
3. Playing further: Duty Roster, gameflow, missions; `npm run discover` when code is missing.
4. `src/tre.ts` reads WC3's TREs (version 0); WC4's are version 1 (header "XTRE", 1, then the hash
   table (255 slots of hash, entry offset; empty slots 0, FFFFFFFFh), entries of offset and size,
   data): it lists them but the names (hashes) aren't checked yet.
5. Whether `wc4dvd.exe` (what GOG actually runs) should be the target instead: same game, a later
   build, MPEG-2 movies through `mpeg2.dll` (to be replaced like Play_Movie), no relocations.

## Debugging

As in wc3w-recomp: `WC_TRACE=1` (Windows calls), `WC_TRACE=2` with `WC_TRACE_AT`, `WC_WATCH`,
`WC_HEADLESS=1`, `WC_WAV`, `WC_SCREENSHOT=file.png` after `WC_SCREENSHOT_AT` seconds (the run ends
there), `WC_DUMP`, `WC_KEYS=ms:key,...` (`@x.y` moves the pointer, `+lmb`/`-lmb`).

## Conventions

As in wc3w-recomp: TypeScript run directly by Node (≥ 23.6), ESM, `npm run typecheck`; Java Ghidra
scripts in `ghidra_scripts/`; C++23 runtime, tab-indented, short comments; the standard library
rather than POSIX. Ghidra 12.2 (Homebrew). Commit messages end with
"Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>".
