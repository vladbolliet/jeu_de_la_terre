// Saves the game state to a JSON file so a crash/restart on game day does not lose the game.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import type { GameSnapshot } from './game.ts';

export function loadSnapshot(file: string, maxAgeMs: number): GameSnapshot | null {
  if (!existsSync(file)) return null;
  try {
    const snap = JSON.parse(readFileSync(file, 'utf8')) as GameSnapshot;
    if (snap.version !== 1 || Date.now() - snap.savedAt > maxAgeMs) return null;
    return snap;
  } catch (e) {
    console.error(`state: cannot read ${file}, ignoring it`, e);
    return null;
  }
}

/** Atomic write: a crash mid-write never leaves a truncated file. */
export function saveSnapshot(file: string, snap: GameSnapshot) {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(snap));
  renameSync(tmp, file);
}

export function deleteSnapshot(file: string) {
  rmSync(file, { force: true });
}
