import { describe, expect, test } from "vitest";
import { DEFAULT_PHASE_ID, PHASES } from "../src/campaign/phases.js";
import {
  CampaignRuntime,
  createDefaultProfile,
  loadProfile,
  saveProfile,
  selectPhase,
  updatePhaseRecord
} from "../src/campaign/profile.js";

describe("campaign profile", () => {
  test("starts with only the first phase unlocked", () => {
    const profile = createDefaultProfile();

    expect(profile.unlockedPhaseIds).toEqual([DEFAULT_PHASE_ID]);
    expect(profile.phaseProgress[DEFAULT_PHASE_ID].unlocked).toBe(true);
    expect(profile.phaseProgress[PHASES[1].id].unlocked).toBe(false);
  });

  test("selects only unlocked phases", () => {
    const profile = createDefaultProfile();
    const lockedSelection = selectPhase(profile, PHASES[1].id);

    expect(lockedSelection.lastSelectedPhaseId).toBe(DEFAULT_PHASE_ID);

    const unlockedProfile = {
      ...profile,
      phaseProgress: {
        ...profile.phaseProgress,
        [PHASES[1].id]: {
          ...profile.phaseProgress[PHASES[1].id],
          unlocked: true
        }
      }
    };
    const selectedProfile = selectPhase(unlockedProfile, PHASES[1].id);

    expect(selectedProfile.lastSelectedPhaseId).toBe(PHASES[1].id);
  });

  test("completes objectives and unlocks the next phase", () => {
    const runtime = new CampaignRuntime(createDefaultProfile());
    runtime.startPhase(DEFAULT_PHASE_ID);

    const events = runtime.applyGameEvents({
      score: 2400,
      lines: 6,
      bestComboThisRun: 2,
      level: 1
    }, []);
    const profile = runtime.getProfile();

    expect(events.filter((event) => event.type === "objectiveCompleted")).toHaveLength(3);
    expect(events.some((event) => event.type === "phaseUnlocked" && event.phaseId === PHASES[1].id)).toBe(true);
    expect(profile.phaseProgress[PHASES[1].id].unlocked).toBe(true);
  });

  test("persists profile records through storage", () => {
    const storage = createMemoryStorage();
    let profile = createDefaultProfile();
    profile = updatePhaseRecord(profile, DEFAULT_PHASE_ID, {
      score: 3200,
      bestComboThisRun: 4,
      lines: 9
    });

    saveProfile(profile, storage);
    const loadedProfile = loadProfile(storage);

    expect(loadedProfile.phaseRecords[DEFAULT_PHASE_ID]).toEqual({
      highScore: 3200,
      bestCombo: 4,
      bestLines: 9
    });
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
