// Usage: node src/print-save.ts [--game dir] [file.WSG ...]
// Shows the player's kills and the wingmen's morale (0-9, which the game never shows), status and
// kills from saved games: the game folder's *.WSG, newest last, or the files given. A save is an
// IFF FORM SAVE, read by 479D00h and written by 4792xxh (WC4W.EXE); the parts shown here:
//   INFO  the save's version (9), the CD it was made on
//   STAT  three dwords: the game's state (4D80D4h), the scene (4D80D8h), a third (4D80DCh)
//   PILT  26 pilot slots of two bytes (4C1D80h; slot 25 is never used: the pilots' file has 25):
//         morale + 1, then flags. Morale is 0..9 (466CE0h returns the byte - 1), starts at 4 and
//         is moved by the gameflow, clamped to 0..9 (466C20h); in flight a wingman with 4 or more
//         talks from another set of comm messages (40E119h). Byte 0: the pilot is dead (466C80h,
//         also when shot down with flag 8, 452058h).
//         Flags: 1 on the roster (the killboard lists only these, 46DCA5h; set and cleared by the
//         gameflow), 2 shot down and ejected (452035h-4521D5h), 4 away, 8 dies when shot down
//         (466D90h, 451F65h); the gameflow sets and clears 2 and 4 (it clears 2 for everyone).
//         The killboard's STAT column (46DFF4h, Language.tre's KILLBOARD IFF): DEAD, else AWOL
//         (flag 4), else SICK (flag 2), else OK; the pilot's file says "deceased", "deserted the
//         ship, whereabouts unknown" and "detained in the infirmary".
//         After a mission, the rostered pilots who are alive, not shot down and not gone are
//         credited with a few kills each (466FE0h).
//   KILL  26 dwords, the pilots' kills (4C1DB8h); ACE_ 26 dwords, their aces (4C1E28h)
//   PLYR  the player's kills, aces included (4C1EA0h), aces (4C1DB4h), the callsign (15 bytes)
// The others: OPTS the options, FLAG and REGS the gameflow's flags and registers, HARD the ships'
// loadouts, MISL, BRNC the movie branches taken, CRED the programmers' names.
// The pilots' names are from Language.tre's PILT IFF (killboard 46D940h). WSG_NDX.WSG names the
// slots: FORM SAVE with INFO (the version) and a chunk per slot whose tag is the slot's number
// (little-endian) and whose body is the name; slot n is the file %08u.WSG, 102 the autosave
// ("Current Mission").

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

export const PILOTS = [
  "Maniac", "Vagabond", "Catscratch", "Hawk", "Panther", "Seether", "Pliers", "Dekker", "Quality",
  "Miner", "Hazard", "Hippie", "Primate", "Fhish", "Steel", "Slash", "Gambler", "Scar", "Blade", "Tex",
  "Yaeger", "Moose", "Turbo", "Excell", "Vero",
];
const SLOTS = 26;

/** an IFF FORM's chunks by tag (the last of each), checked to be a FORM SAVE */
export function chunks(data: Buffer): Map<string, Buffer> {
  if (data.length < 12 || data.toString("latin1", 0, 4) !== "FORM" || data.toString("latin1", 8, 12) !== "SAVE")
    throw new Error("not a saved game (FORM SAVE)");
  const map = new Map<string, Buffer>();
  const end = Math.min(data.length, 8 + data.readUInt32BE(4));
  for (let o = 12; o + 8 <= end; ) {
    const size = data.readUInt32BE(o + 4);
    map.set(data.toString("latin1", o, o + 4), data.subarray(o + 8, Math.min(end, o + 8 + size)));
    o += 8 + size + (size & 1);
  }
  return map;
}

/** WSG_NDX.WSG: the slots' names by number */
export function slotNames(data: Buffer): Map<number, string> {
  const names = new Map<number, string>();
  const end = Math.min(data.length, 8 + data.readUInt32BE(4));
  for (let o = 12; o + 8 <= end; ) {
    const size = data.readUInt32BE(o + 4);
    if (data.toString("latin1", o, o + 4) !== "INFO") {
      const name = data.toString("latin1", o + 8, Math.min(end, o + 8 + size)).replace(/\0.*$/s, "");
      if (name) names.set(data.readUInt32LE(o), name);
    }
    o += 8 + size + (size & 1);
  }
  return names;
}

function dwords(c: Map<string, Buffer>, tag: string): number[] {
  const b = c.get(tag);
  if (!b || b.length < SLOTS * 4) throw new Error(`no ${tag} chunk`);
  return Array.from({ length: SLOTS }, (_, i) => b.readInt32LE(i * 4));
}

export interface Pilot {
  slot: number;
  name: string;
  /** 0..9, or -1: dead */
  morale: number;
  flags: number;
  kills: number;
  aces: number;
}

export interface Save {
  version?: number;
  cd?: number;
  scene?: number;
  callsign: string;
  kills?: number;
  aces?: number;
  pilots: Pilot[];
}

export function readSave(data: Buffer): Save {
  const c = chunks(data);
  const pilt = c.get("PILT");
  if (!pilt || pilt.length < SLOTS * 2) throw new Error("no PILT chunk");
  const kill = dwords(c, "KILL"), ace = dwords(c, "ACE_");
  const plyr = c.get("PLYR"), stat = c.get("STAT"), info = c.get("INFO");
  const pilots = Array.from({ length: SLOTS }, (_, slot) => ({
    slot, name: PILOTS[slot] ?? `slot ${slot}`, morale: pilt[slot * 2] - 1, flags: pilt[slot * 2 + 1],
    kills: kill[slot], aces: ace[slot],
  }));
  return {
    version: info && info.length >= 4 ? info.readInt32LE(0) : undefined,
    cd: info && info.length >= 8 ? info.readInt32LE(4) : undefined,
    scene: stat && stat.length >= 8 ? stat.readInt32LE(4) : undefined,
    callsign: plyr && plyr.length > 8 ? plyr.toString("latin1", 8).replace(/\0.*$/s, "") : "?",
    kills: plyr && plyr.length >= 8 ? plyr.readInt32LE(0) : undefined,
    aces: plyr && plyr.length >= 8 ? plyr.readInt32LE(4) : undefined,
    pilots,
  };
}

function status(p: Pilot): string {
  const s: string[] = [];
  if (p.morale < 0) s.push("DEAD");
  if (p.flags & 4) s.push("AWOL");
  if (p.flags & 2) s.push("SICK");
  if (p.flags & 8 && p.morale >= 0) s.push("dies if shot down");
  return s.join(", ");
}

/** the lines printed for a save: the player, then the rostered pilots, then the others */
export function describe(save: Save): string[] {
  const out: string[] = [];
  const row = (name: string, morale: string, kills: number, aces: number, note: string) =>
    out.push((`  ${name.padEnd(11)}${morale.padEnd(12)}kills ${String(kills).padStart(4)}  aces ${String(aces).padStart(2)}  ${note}`).trimEnd());
  if (save.kills !== undefined) row(save.callsign, "", save.kills, save.aces ?? 0, "(kills include the aces)");
  const shown = save.pilots.filter((p) => p.slot < PILOTS.length || p.morale !== -1 || p.flags || p.kills || p.aces);
  const line = (p: Pilot) => row(p.name, p.morale < 0 ? "" : `morale ${p.morale}`, p.kills, p.aces, status(p));
  const roster = shown.filter((p) => p.flags & 1), others = shown.filter((p) => !(p.flags & 1));
  roster.forEach(line);
  if (others.length) {
    out.push("  not on the roster:");
    others.forEach(line);
  }
  return out;
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dirname, "..");
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { game: { type: "string", default: path.resolve(root, "../game4.30/WC4_Enhanced") } },
  });

  let files = positionals;
  const dir = files.length ? path.dirname(files[0]) : values.game;
  if (files.length === 0) {
    files = readdirSync(values.game)
      .filter((f) => /^\d+\.wsg$/i.test(f))
      .map((f) => path.join(values.game, f))
      .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
    if (files.length === 0) throw new Error(`no saved games (*.WSG) in ${values.game} (--game)`);
  }
  let names = new Map<number, string>();
  const ndx = readdirSync(dir).find((f) => /^wsg_ndx\.wsg$/i.test(f));
  if (ndx && existsSync(path.join(dir, ndx))) {
    try {
      names = slotNames(readFileSync(path.join(dir, ndx)));
    } catch {
      // no names then
    }
  }

  for (const file of files) {
    try {
      const save = readSave(readFileSync(file));
      const base = path.basename(file), slot = /^(\d+)\.wsg$/i.exec(base);
      const name = slot ? names.get(Number(slot[1])) : undefined;
      const where = [save.scene !== undefined ? `scene ${save.scene}` : "", save.cd !== undefined ? `CD ${save.cd}` : ""];
      console.log(`${base}${name ? ` "${name}"` : ""}  ${save.callsign}  ${where.filter(Boolean).join(", ")}  (${statSync(file).mtime.toLocaleString()})`);
      for (const l of describe(save)) console.log(l);
    } catch (e) {
      console.log(`${path.basename(file)}: ${(e as Error).message}`);
    }
  }
}
