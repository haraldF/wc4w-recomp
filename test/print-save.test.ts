// The saved-game reader (src/print-save.ts) on a save and an index made in memory.

import assert from "node:assert/strict";
import { test } from "node:test";

import { describe, readSave, slotNames } from "../src/print-save.ts";

function chunk(tag: string | number, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  if (typeof tag === "number") head.writeUInt32LE(tag, 0);
  else head.write(tag, 0, "latin1");
  head.writeUInt32BE(body.length, 4);
  return Buffer.concat([head, body, Buffer.alloc(body.length & 1)]);
}

function form(type: string, parts: Buffer[]): Buffer {
  const body = Buffer.concat([Buffer.from(type, "latin1"), ...parts]);
  const head = Buffer.from("FORM\0\0\0\0", "latin1");
  head.writeUInt32BE(body.length, 4);
  return Buffer.concat([head, body]);
}

const dwords = (v: number[]) => {
  const b = Buffer.alloc(v.length * 4);
  v.forEach((x, i) => b.writeInt32LE(x, i * 4));
  return b;
};

test("readSave and describe", () => {
  const pilt = Buffer.alloc(52);
  for (let i = 0; i < 26; i++) pilt[i * 2] = 5; // morale 4, no flags
  pilt.set([10, 1], 0);             // Maniac: morale 9, on the roster
  pilt.set([0, 1], 2);              // Vagabond: dead
  pilt.set([5, 1 | 2], 4);          // Catscratch: sick
  pilt.set([5, 4 | 8], 6);          // Hawk: AWOL, dies if shot down, not on the roster
  const kills = Array.from({ length: 26 }, (_, i) => i), aces = Array(26).fill(0);
  aces[0] = 3;
  const plyr = Buffer.concat([dwords([44, 5]), Buffer.from("Nemesis\0\0\0\0\0\0\0\0", "latin1")]);
  const save = readSave(form("SAVE", [
    chunk("INFO", dwords([9, 3])), chunk("STAT", dwords([4, 12, 14])), chunk("FLAG", Buffer.alloc(1024)),
    chunk("PILT", pilt), chunk("KILL", dwords(kills)), chunk("ACE_", dwords(aces)), chunk("PLYR", plyr),
  ]));
  assert.equal(save.version, 9);
  assert.equal(save.cd, 3);
  assert.equal(save.scene, 12);
  assert.equal(save.callsign, "Nemesis");
  assert.equal(save.kills, 44);
  assert.equal(save.aces, 5);
  assert.deepEqual(save.pilots[0], { slot: 0, name: "Maniac", morale: 9, flags: 1, kills: 0, aces: 3 });
  assert.equal(save.pilots[1].morale, -1);
  assert.equal(save.pilots[24].name, "Vero");
  assert.equal(save.pilots[25].name, "slot 25");

  const lines = describe(save);
  assert.match(lines[0], /^ {2}Nemesis +kills +44 +aces +5/);
  assert.match(lines[1], /^ {2}Maniac +morale 9 +kills +0 +aces +3$/);
  assert.match(lines[2], /^ {2}Vagabond +kills +1 +aces +0 +DEAD$/);
  assert.match(lines[3], /^ {2}Catscratch +morale 4 .* SICK$/);
  assert.equal(lines[4], "  not on the roster:");
  assert.match(lines[5], /^ {2}Hawk +morale 4 .* AWOL, dies if shot down$/);

  assert.throws(() => readSave(form("MISN", [])), /not a saved game/);
  assert.throws(() => readSave(form("SAVE", [chunk("INFO", dwords([9, 1]))])), /no PILT/);
});

test("slotNames", () => {
  const name = (s: string) => Buffer.concat([Buffer.from(s, "latin1"), Buffer.alloc(44 - s.length)]);
  const names = slotNames(form("SAVE", [chunk("INFO", dwords([9])), chunk(0, name("H1")), chunk(1, name("")),
    chunk(102, name("Current Mission"))]));
  assert.deepEqual([...names], [[0, "H1"], [102, "Current Mission"]]);
});
