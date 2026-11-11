# wc4w-recomp

Statically recompiles the Windows version of Wing Commander IV: The Price of Freedom (`WC4W.EXE`,
1996, as GOG's 30th Anniversary Edition brings it) to C++ with Ghidra, driven from TypeScript, to
build a native program (arm64 macOS first; no Wine, no Rosetta).

It is a sibling of [wc3w-recomp](../wc3w-recomp), which does the same for Wing Commander III's
Windows version: the pipeline, the generator (`ghidra_scripts/WcRecomp.java`) and the runtime
(`runtime/`: the CPU core, the Win32 API, DirectDraw, DirectSound, the SDL host) started as copies
of its own. The projects share nothing at build time.

State: early. Headless, the game runs its first-time setup (speed test, video options), plays the
intro as the 30th Anniversary Edition's HD movie (decoded with FFmpeg), flies the opening simulator
mission and reaches the Duty Roster and the first mission, with GOG's default (16-bit) video
settings or 8-bit ones. See `CLAUDE.md` for details and what's missing.

## Building it yourself

This repository contains no game files and nothing derived from them: you need the 30th
Anniversary Edition from GOG. Its installer is for Windows, but `innoextract` unpacks it anywhere;
only the `WC4_Enhanced` folder is needed:

```bash
brew install node ghidra innoextract cmake ninja sdl3 ffmpeg
innoextract --gog -I WC4_Enhanced -d ../game4.30 path/to/setup_wing_commander_iv_the_price_of_freedom_30th_anniversary_edition_v1.0_\(95014\).exe
npm ci
```

Everything is worked out on its `WC4W.EXE` (SHA-256
`97dd8663f867e30573940dd57537d44c19b93902bc7c28dfee6f474d1dfb7b70`) and `Xanlib.dll`
(`5b7f494a7f78d08739892e489b6f29b488b1939d034a0f074beafceb01290c4f`); other files are refused.

With the game at `../game4.30/WC4_Enhanced` (or `-- --game path` for every step):

```bash
npm run imports      # map the modules, link them into one image and list the Windows functions they import
npm run decompile    # import the image into a Ghidra project (out/ghidra) and analyze it
npm run recomp       # translate it to C++ (out/recomp) and build out/bin/wc4w (the generator only when its inputs changed)
npm run build        # only rebuild out/bin/wc4w, after changes to runtime/
npm run smoke        # run it headless from the setup to the first flight, in a fresh copy of the game folder
npm test             # unit tests of the archive and PE readers and the CPU helpers (no game files needed)
npm run discover     # run it headless, adding code it reaches only through pointers (entries.txt)
npm run play         # the same in the window
npm run tre -- path/to/Missions.tre [outdir]   # list (or unpack) a data archive
```

Then run it with a copy of the game folder (the game writes its saves into it):

```bash
out/bin/wc4w path/to/WC4_Enhanced
```

Without `WC4.CFG` (or with GOG's) the game first runs its setup: the speed test, then the video
options, the install menu and "IV". Environment variables for debugging and input (`WC_TRACE`,
`WC_KEYS`, `WC_STRICT`, `WC_VIRTUAL_TIME`, `WC_HD_MOVIES`, `WC_STICK_AXES`...) are listed in `CLAUDE.md`.

## License

BSD 2-Clause (`LICENSE`), for this repository's own code. `runtime/movie.cpp` and `runtime/fixes.cpp`
port parts of Matt Wells' Wing Commander IV Enhancement Patch (MIT, its notice in `LICENSE`).
