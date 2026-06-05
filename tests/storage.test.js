import { afterEach, describe, expect, test } from "vitest";
import { loadRecords, saveAudioMuted, updateRunRecords } from "../src/storage.js";

const originalWindow = globalThis.window;

describe("storage records", () => {
  afterEach(() => {
    globalThis.window = originalWindow;
  });

  test("persists high score, best combo and mute state", () => {
    const storage = createMemoryStorage();
    globalThis.window = { localStorage: storage };

    saveAudioMuted(true);
    updateRunRecords(loadRecords(), {
      score: 4200,
      bestComboThisRun: 5
    });
    const records = loadRecords();

    expect(records.highScore).toBe(4200);
    expect(records.bestCombo).toBe(5);
    expect(records.audioMuted).toBe(true);
  });
});

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) || null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}
