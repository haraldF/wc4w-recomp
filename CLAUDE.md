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
`../wc3-recomp/CLAUDE.md`. Nothing is shared at build time; carry fixes across by hand
(`WC3W-DIFFERENCES.md` lists what differs and what is still to carry back). Only what
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
  game run its setup), `WSG_NDX.WSG`, `SFOSAVED.DAT`. Without `WC4.CFG` the game runs its setup too (`npm run smoke`). Movies: `Master_FMVs_Upscaled/` and
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
  `RegQueryValueExA`, `RegCloseKey`: new; stubs that find nothing, not called so far; 40F8D0h
  uses them with string resources 12-14 to look up the joystick's name under HKEY_LOCAL_MACHINE), DDRAW 1
  (`DirectDrawCreate` straight from `DDRAW.dll`: no renamed import, unlike WC3W's `WC3EN.dll`),
  WINMM 2 joystick + XanLib's 12 waveOut, XanLib 40 (its C++ classes, including `XDMOVIE`).
  121 Windows functions. Missing from wc3w's runtime and added: `GetCurrentDirectoryA` (C:\),
  `GetFileTime`/`SetFileTime` (no times kept), the registry, `StretchDIBits`. Not implemented yet
  (not called so far): `RtlUnwind`, `RaiseException`, `UnhandledExceptionFilter`,
  `ReadConsoleInputA`; a call stops the program with "wc: unimplemented Windows function
  KERNEL32.DLL!..." (exit 6). The first three only come after an exception, which the runtime
  never raises. Loaded at run time: `dsound.dll` (`DirectSoundCreate`, as WC3W), and the C
  library asks `GetProcAddress(kernel32, "GetProcessAffinityMask")` (not there: fine).

## Ghidra and the generator

- Analysis (`npm run decompile`) takes about half a minute. The generator as in wc3w-recomp:
  2898 functions + 1287 fragments decoded from 1369 relocation targets outside every function,
  238720 instructions in 49 files. No `discover` round was needed so far (no `entries.txt`).
- The texture mappers patch their own code as in WC3W: 1560 instructions read patched constants
  (48F000h-493FFFh; the game makes 48D864h-494F92h writable with VirtualProtect).
- 6 "unhandled CALLOTHER segment" ops: data decoded as code (`[BX+SI]`, 16-bit addressing), in
  fragments that never run.
- `npm run decompile` and `npm run recomp` record what they were made from (`out/ghidra/inputs.json`,
  `out/recomp/inputs.json`: SHA-256 of `image.bin`, `labels.txt`, the scripts, `entries.txt`,
  `code-pointers.txt`, `hooks.txt`, and Ghidra's version). `recomp` skips the generator when nothing
  changed (`--force`) and refuses a Ghidra project made from another image or by another Ghidra;
  `build` refuses when the generator's inputs changed (a new hook needs the generated `wc_hook` call).
- analyzeHeadless exits 0 even when a script throws, so the generator writes `out/recomp/summary.json`
  last (counts, the hooks that aren't at an instruction) and `recomp` fails without it, on a hook
  that was never placed, or on more unhandled p-code ops than the 6 known (`UNHANDLED_OPS`).
- Fragments follow only flows into the image: data decoded as code "jumps" anywhere (the log's
  "cannot decode an instruction at 0c485683").
- x87: the ST registers carry doubles, not 80-bit values (the game sets 53-bit precision, 27Fh, so
  that matches; the control word's precision bits are ignored). `FIST`/`FISTP`/`FRNDINT` (p-code
  `round` then `trunc`) round as the control word's RC bits say: the C library's `_ftol` (4AF33Bh)
  sets chop, so `(int)f` truncates. Before that was honoured it rounded to nearest. NaN or a value
  too large for the integer stores the integer indefinite (80000000h), as x86 does.
- Division: every `INT_DIV`/`INT_SDIV` comes from `DIV`/`IDIV`, whose quotient must fit in half the
  dividend (EDX:EAX: 32 bits). x86 faults (#DE) when it doesn't: the "imul/idiv overflowing"
  crashes the patch works around. Here the quotient is truncated and the instruction reported once
  ("wc: divide overflow at"); `WC_STRICT=1` stops there instead. `INT64_MIN / -1` wraps. The game's
  three fixed-point helpers where that happened are replaced as the patch does (Hooks below), so
  the smoke test's runs report none.
- Memory outside 10000h-MEM_SIZE (Windows would fault) wraps into memory and is reported once for
  each instruction ("wc: read of 4 bytes at ..., outside memory"); `WC_STRICT=1` stops there. A bad
  pointer handed to a Windows function (`guest_ptr` in `win.h`: every block the runtime reads or
  writes directly) always stops the program: there is nothing sensible to wrap to.

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
- 16 bits (GOG's default for gameflow and movies): the game asks `SetDisplayMode(640, 480, 16)`,
  makes a 16-bit primary with a back buffer (the 320x240 off-screen surface only in 8 bits) and a
  16-bit DIB section. DirectDraw offers RGB565 (DDPF_RGB, masks F800h/07E0h/001Fh), which the game
  takes: the Duty Roster looks the same as in 8 bits. Refused (as wc3w's runtime did), the game
  stopped with "Full screen mode initialization failed". Default settings, from GOG's `WC4.CFG`:
  `8000:@55.325,8500:+lmb,8650:-lmb,20000:@585.325,20500:+lmb,20650:-lmb,26000:@320.330,
  26500:+lmb,26650:-lmb` (speed test, install menu, IV), `36000:esc` skips the intro to the first
  mission's objectives ("Fly to the Orlando Depot with Maniac"), a click accepts them: the Virtual
  Combat Mode flight. For 8 bits instead (mouse in 640x480):
  `8000:@55.325,8500:+lmb,8650:-lmb,20000:@154.327,20500:+lmb,20650:-lmb,21500:@322.224,
  22000:+lmb,22150:-lmb,24000:@585.325,24500:+lmb,24650:-lmb,30000:@320.330,30500:+lmb,
  30650:-lmb` (speed test, gameflow 8 bit, movies 8 bit, install menu, IV). Keep the `WC4.CFG`
  it writes to start the game directly next time.
- Before a message box (errors) the game goes windowed: it drops DirectDraw and draws its DIB
  section with `StretchDIBits` (8 bits: DIB_RGB_COLORS, its palette selected; 16 bits: BI_RGB
  5-5-5 or BI_BITFIELDS masks, both handled).
- The frame the host gets is ARGB (`ddraw_frame`), converted from the 8-bit primary and its palette
  or from RGB565; alpha 0 marks the program's colour 0 (index 0, or the 16-bit value 0), which shows
  an HD movie under the game's picture (the choice text). Screenshots are RGB PNGs.
- The game writes `00000102.WSG` (an autosave after the simulator) and `SFOSAVED.DAT` into the
  folder: a copy of a used scratch folder starts at the Duty Roster, without the intro. Make test
  folders from the original files.
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

## The data archives (src/tre.ts)

- WC4's TREs are XTRE version 1 (WC3's 0): the same header ("XTRE", version, offsets of the hash
  table, the names table, the entries, the data) and entries (offset, size; bit 31 packed, bit 30
  RefPack, else LZW; WC4W.EXE's decoders 49D310h, 49D569h). Reader 49B380h, lookup 49B890h.
- The name hash differs (49B980h picks by version): version 1 starts with the first character times
  256, then `h += (h >> 4) * c + i` for each further character (i from 0). The hash table's slots
  (2^n - 1) are a binary tree in an array: from slot k, larger hashes at 2k, smaller at 2k + 1.
  A slot points to the entry, or, where paths collide, into the names table (length byte, path,
  entry offset), which the game searches from there: Language.tre's
  `..\..\DATA\LANGUAGE\SUBTITLE\0270.IFF` and `0720.IFF` share 610C0BBCh. `readTre` checks that
  every slot leads to an entry and every stored path hashes to a colliding slot (true for all 22
  archives); `--names file` names entries from guessed paths.
- Language.tre and Missions.tre each have one `NAV` entry no slot points to (index 1845, 99).

## Hooks (hooks.txt)

As in wc3w-recomp: the generated code first calls `wc_hook(addr)`; a handler returning true makes
the generated function return. To continue elsewhere in the function (a patch's JMP), the handler
enters the recompiled code there with `run_code(to)` and returns true: the function's own RET then
returns through the shadow stack (`fixes.cpp`, `jump`).
- 483AD0h: Play_Movie, the HD movies (`movie.cpp`).
- 475721h: the movie handler's AVI check, skipped (`fixes.cpp`).
- 49D73Ch, 49D74Fh, 49D75Eh: `a * 256 / b`, `a * b / 256`, `a * b / c` (cdecl, 32-bit arguments,
  IMUL then IDIV on EDX:EAX): 64-bit arithmetic cut to 32 bits, the patch's "replacement integer
  math" (`fixes.cpp`). A zero divisor still stops the program.
- The two lists must agree, and both sides check: `recomp` fails on an address in `hooks.txt` that
  isn't an instruction; the runtime stops at the start when a `hook_register` address has no
  generated `wc_hook` call (`wc_hook_addr` in `wc_dispatch.cpp`), and says so when `hooks.txt` has an
  address without a handler.

## Not done / next

1. The rest of the patch's WC4W.EXE fixes (`Mod_GeneralFixes.cpp`'s `#else` branch): the DATA
   folder lookup (49AB03h), the long pause after autopilot (487E31h: a constant in the code, so a
   hook, not a poke), more memory (4AD0B2h), more watchers (4A14B5h), the texture sampler crash
   fix; in-flight HD movies (424722h, 424A84h, 441AFEh), subtitles, choice-text colours.
2. Playing further: Duty Roster, gameflow, missions; `npm run discover` when code is missing.
   **The Duty Roster takes no input in scripted runs**: with a save in the folder (`00000102.WSG`,
   written when the simulator flight starts) the game starts there, in 16 bits, drawing with
   `FlipToGDISurface` + `StretchDIBits` every frame; clicks on a row or on any of its four buttons,
   Enter and Esc reach the window procedure (WM_LBUTTONDOWN/UP, WM_KEYDOWN, WM_COMMAND from the
   accelerator) and only the pointer moves. Not the WM_MOUSEMOVE after each `SetCursorPos` (tried
   without). Whether it works in the window is not checked.
3. Whether `wc4dvd.exe` (what GOG actually runs) should be the target instead: same game, a later
   build, MPEG-2 movies through `mpeg2.dll` (to be replaced like Play_Movie), no relocations.

## Debugging

As in wc3w-recomp: `WC_TRACE=1` (Windows calls), `WC_TRACE=2` (every instruction) with
`WC_TRACE_AT=addr,lo-hi,...` (only those, with ST0-ST2 and the x87 control word), `WC_WATCH=addr`
(writes), `WC_POKE=addr:byte,...` (patch memory before the start), `WC_HEADLESS=1`, `WC_WAV`,
`WC_SCREENSHOT=file.png` after `WC_SCREENSHOT_AT` seconds (the run ends there), `WC_DUMP=file`
(memory on an error), `WC_KEYS=ms:key,...` (`@x.y` moves the pointer, `+lmb`/`-lmb`), `WC_VIRTUAL_TIME=1` (below). New:
`WC_STRICT=1` stops where Windows would fault: memory outside 10000h-MEM_SIZE (otherwise wrapped),
a `DIV`/`IDIV` quotient too large. Movies: `WC_HD_MOVIES=0` off, or another folder than
`Master_FMVs_Upscaled` (`Master_FMVs_Source`, `vob`). Joystick: `WC_STICK_AXES=x,y,twist,throttle`
(SDL axis numbers, `-n` reversed), `WC_JOYSTICK=1` a virtual one when there is none.
- `WC_VIRTUAL_TIME=1` (headless only; `clock.cpp`, `host.h`): one virtual clock for everything
  (`QueryPerformanceCounter`, message times, `Sleep` and the thread scheduler, the vertical blank,
  the movies, `WC_KEYS`, `WC_SCREENSHOT_AT`). It advances with the instructions executed
  (`WC_VIRTUAL_MIPS`, default 200 million a second; this Mac runs about 540 in flight) and every
  wait moves it on at once. The host's work (script, mixer, movie frames, screenshot) then happens
  on the program's thread as the clock moves (`host_tick`); real joysticks are ignored; the movie
  player waits for its decoder (`wait_ahead`). A run repeats exactly: the same instruction count
  and a byte-identical screenshot three times over, through 9 s of the intro movie. The game mostly
  spins (it polls `QueryPerformanceCounter`), so a run takes its instructions' time: 80 virtual
  seconds in 24 s. Don't trace such a run for long: the polling loop prints a line per call.
- `npm run smoke [scenario...]`: headless with virtual time (`--realtime`: the real clock), in
  `out/smoke/game` (a fresh copy without `WC4.CFG`, so the game runs its setup, and without saves),
  the scenarios of `SCENARIOS` in `cli.ts` one after the other: `flight` (the setup, the intro
  skipped, the simulator flight with a target, afterburner, guns and a missile: 80 s) and `roster`
  (the folder now has the flight's save: the Duty Roster, 8 s). Each fails on a stop, an error, a
  message from the runtime (but a joystick's and the warnings: divide overflow, wrapped memory), no
  `WC4.CFG`, or a picture that isn't the scenario's: the display mode's depth (space flight is 8
  bits, setup too; gameflow 16) and a minimum of colours, both from the runtime's "wc: screenshot
  saved to ... (640x480, 8-bit mode, n instructions)" and the PNG. Both take 31 s. Every
  `smoke`/`discover`/`play` run's stderr is in `out/logs/`.
- `npm test`: `node --test` on `test/*.test.ts`, no game files needed: the archive reader (LZW with
  an encoder of its own, RefPack, both hashes, archives made in memory), the PE reader (a module
  made in memory), and the generated code's helpers (`test/rt_test.cpp` with `runtime/cpu.cpp`,
  built with `c++`: DIV/IDIV, x87 rounding and conversions, 80-bit values, flags, memory, the
  shadow stack).
- `npm run imports` and `build` list the imported Windows functions without an implementation
  (`API(...)` in `runtime/*.cpp`): the 4 above.
- `npm run drift`: the lines that differ from `../wc3w-recomp` (`--other`), by shared file.
- HD movies, headless: the host must keep calling `movie_frame` (it takes the frames due off the
  decoder's queue; a movie ends when that is empty). Before it did, a headless movie never ended
  by itself and its decoded 1080p frames piled up.
- "Calibrate Joystick" (the options) calls the game's joystick setup (412E50h) with 1: it waits for
  the buttons to be released, reads the stick 200 times, takes the middle of what it read as the
  centre and a dead zone from the spread. No prompt, nothing drawn: it looks as if nothing happens.

## Conventions

As in wc3w-recomp: TypeScript run directly by Node (≥ 24.2: `import.meta.main`), ESM, `npm run
typecheck`, `npm test`; Java Ghidra
scripts in `ghidra_scripts/`; C++23 runtime, tab-indented, short comments; the standard library
rather than POSIX. Ghidra 12.2 (Homebrew). Commit messages end with
"Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>".
