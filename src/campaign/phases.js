import ignitionBackdrop from "../assets/backdrops/phase-1-ignition.svg";
import riftBackdrop from "../assets/backdrops/phase-2-rift.svg";
import gridBackdrop from "../assets/backdrops/phase-3-grid.svg";
import voidBackdrop from "../assets/backdrops/phase-4-void.svg";
import overdriveBackdrop from "../assets/backdrops/phase-5-overdrive.svg";
import ignitionLoop from "../assets/audio/phase-1-ignition.wav";
import riftLoop from "../assets/audio/phase-2-rift.wav";
import gridLoop from "../assets/audio/phase-3-grid.wav";
import voidLoop from "../assets/audio/phase-4-void.wav";
import overdriveLoop from "../assets/audio/phase-5-overdrive.wav";

export const DEFAULT_PHASE_ID = "ignition-array";

export const PHASES = [
  {
    id: DEFAULT_PHASE_ID,
    index: 1,
    title: "Ignition Array",
    tagline: "Warm the core, keep the board clean, and learn the warning rhythm.",
    backdrop: ignitionBackdrop,
    loop: ignitionLoop,
    unlockRequired: 2,
    palette: { primary: "#ffe45c", secondary: "#ff426d", accent: "#41e8ff" },
    objectives: [
      { id: "ignition-lines", label: "Clear 6 lines", type: "lines", target: 6 },
      { id: "ignition-score", label: "Reach 2,000 score", type: "score", target: 2000 },
      { id: "ignition-combo", label: "Hit combo x2", type: "combo", target: 2 }
    ],
    difficulty: {
      gravityMultiplier: 1,
      hazardInitialDelay: 9000,
      hazardMinInterval: 9000,
      hazardMaxInterval: 11500,
      warningDuration: 1100,
      speedMultiplier: 0.72,
      speedDuration: 3600,
      surgeGain: 14,
      corruptionCells: 3,
      lockCells: 2,
      lockDuration: 3600
    },
    hazards: ["reactorSurge", "speedSpike"]
  },
  {
    id: "neon-rift",
    index: 2,
    title: "Neon Rift",
    tagline: "The rift bends timing; stay ahead of short gravity spikes.",
    backdrop: riftBackdrop,
    loop: riftLoop,
    unlockRequired: 2,
    palette: { primary: "#41e8ff", secondary: "#4777ff", accent: "#ff3df2" },
    objectives: [
      { id: "rift-level", label: "Survive to level 3", type: "surviveLevel", target: 3 },
      { id: "rift-combo", label: "Hit combo x3", type: "combo", target: 3 },
      { id: "rift-tetris", label: "Clear one Tetris", type: "tetris", target: 1 }
    ],
    difficulty: {
      gravityMultiplier: 0.94,
      hazardInitialDelay: 7600,
      hazardMinInterval: 7400,
      hazardMaxInterval: 9800,
      warningDuration: 950,
      speedMultiplier: 0.62,
      speedDuration: 4200,
      surgeGain: 18,
      corruptionCells: 4,
      lockCells: 3,
      lockDuration: 4100
    },
    hazards: ["speedSpike", "rowCorruption", "reactorSurge"]
  },
  {
    id: "plasma-grid",
    index: 3,
    title: "Plasma Grid",
    tagline: "Corruption cells appear low and punish sloppy stacking.",
    backdrop: gridBackdrop,
    loop: gridLoop,
    unlockRequired: 2,
    palette: { primary: "#46ff8f", secondary: "#41e8ff", accent: "#ffe45c" },
    objectives: [
      { id: "grid-lines", label: "Clear 12 lines", type: "lines", target: 12 },
      { id: "grid-score", label: "Reach 6,000 score", type: "score", target: 6000 },
      { id: "grid-back-to-back", label: "Land back-to-back Tetris", type: "backToBack", target: 2 }
    ],
    difficulty: {
      gravityMultiplier: 0.88,
      hazardInitialDelay: 6800,
      hazardMinInterval: 6400,
      hazardMaxInterval: 8800,
      warningDuration: 850,
      speedMultiplier: 0.58,
      speedDuration: 4500,
      surgeGain: 22,
      corruptionCells: 5,
      lockCells: 4,
      lockDuration: 4500
    },
    hazards: ["rowCorruption", "lockedZone", "speedSpike"]
  },
  {
    id: "void-surge",
    index: 4,
    title: "Void Surge",
    tagline: "Locked zones flicker in the stack while the core surges hard.",
    backdrop: voidBackdrop,
    loop: voidLoop,
    unlockRequired: 2,
    palette: { primary: "#c451ff", secondary: "#ff3df2", accent: "#41e8ff" },
    objectives: [
      { id: "void-level", label: "Survive to level 5", type: "surviveLevel", target: 5 },
      { id: "void-combo", label: "Hit combo x4", type: "combo", target: 4 },
      { id: "void-score", label: "Reach 10,000 score", type: "score", target: 10000 }
    ],
    difficulty: {
      gravityMultiplier: 0.82,
      hazardInitialDelay: 5900,
      hazardMinInterval: 5400,
      hazardMaxInterval: 7600,
      warningDuration: 760,
      speedMultiplier: 0.5,
      speedDuration: 4900,
      surgeGain: 28,
      corruptionCells: 6,
      lockCells: 5,
      lockDuration: 5200
    },
    hazards: ["lockedZone", "reactorSurge", "rowCorruption", "speedSpike"]
  },
  {
    id: "reactor-overdrive",
    index: 5,
    title: "Reactor Overdrive",
    tagline: "Everything fires at once; complete the ladder in full cabinet pressure.",
    backdrop: overdriveBackdrop,
    loop: overdriveLoop,
    unlockRequired: 3,
    palette: { primary: "#ffe45c", secondary: "#ff3df2", accent: "#ffffff" },
    objectives: [
      { id: "overdrive-score", label: "Reach 16,000 score", type: "score", target: 16000 },
      { id: "overdrive-lines", label: "Clear 18 lines", type: "lines", target: 18 },
      { id: "overdrive-combo", label: "Hit combo x5", type: "combo", target: 5 },
      { id: "overdrive-back-to-back", label: "Stack back-to-back x3", type: "backToBack", target: 3 }
    ],
    difficulty: {
      gravityMultiplier: 0.76,
      hazardInitialDelay: 4800,
      hazardMinInterval: 4600,
      hazardMaxInterval: 6600,
      warningDuration: 700,
      speedMultiplier: 0.46,
      speedDuration: 5600,
      surgeGain: 34,
      corruptionCells: 7,
      lockCells: 6,
      lockDuration: 5800
    },
    hazards: ["speedSpike", "rowCorruption", "lockedZone", "reactorSurge"]
  }
];

/** Возвращает фазу кампании по id или первую фазу по умолчанию. */
export function getPhaseById(phaseId) {
  const phase = PHASES.find((item) => item.id === phaseId);
  return phase || PHASES[0];
}

/** Возвращает следующую фазу после переданной, если она существует. */
export function getNextPhase(phaseId) {
  const index = PHASES.findIndex((item) => item.id === phaseId);
  if (index < 0 || index >= PHASES.length - 1) return null;
  return PHASES[index + 1];
}
