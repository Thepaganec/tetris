import { DEFAULT_PHASE_ID, PHASES, getNextPhase, getPhaseById } from "./phases.js";
import { STORAGE_KEYS } from "../game/constants.js";

export const PROFILE_STORAGE_KEY = STORAGE_KEYS.profile;

/** Создаёт новый локальный профиль кампании. */
export function createDefaultProfile() {
  const phaseProgress = {};
  const phaseRecords = {};
  PHASES.forEach((phase) => {
    phaseProgress[phase.id] = {
      unlocked: phase.id === DEFAULT_PHASE_ID,
      completedObjectives: []
    };
    phaseRecords[phase.id] = createPhaseRecord();
  });

  return {
    version: 2,
    activePhaseId: DEFAULT_PHASE_ID,
    lastSelectedPhaseId: DEFAULT_PHASE_ID,
    unlockedPhaseIds: [DEFAULT_PHASE_ID],
    phaseProgress,
    phaseRecords
  };
}

/** Нормализует профиль после загрузки из localStorage. */
export function normalizeProfile(rawProfile) {
  const profile = createDefaultProfile();
  if (!rawProfile || typeof rawProfile !== "object") return profile;

  const phaseProgress = { ...profile.phaseProgress };
  const phaseRecords = { ...profile.phaseRecords };
  PHASES.forEach((phase) => {
    const storedProgress = rawProfile.phaseProgress && rawProfile.phaseProgress[phase.id];
    if (storedProgress) {
      phaseProgress[phase.id] = {
        unlocked: Boolean(storedProgress.unlocked),
        completedObjectives: Array.isArray(storedProgress.completedObjectives)
          ? storedProgress.completedObjectives.filter((objectiveId) => phase.objectives.some((objective) => objective.id === objectiveId))
          : []
      };
    }

    const storedRecord = rawProfile.phaseRecords && rawProfile.phaseRecords[phase.id];
    phaseRecords[phase.id] = normalizePhaseRecord(storedRecord);
  });
  phaseProgress[DEFAULT_PHASE_ID].unlocked = true;

  const unlockedPhaseIds = PHASES
    .filter((phase) => phaseProgress[phase.id].unlocked)
    .map((phase) => phase.id);
  const selectedPhase = getPhaseById(rawProfile.lastSelectedPhaseId);
  const safeSelectedPhaseId = phaseProgress[selectedPhase.id].unlocked ? selectedPhase.id : DEFAULT_PHASE_ID;

  return {
    version: 2,
    activePhaseId: safeSelectedPhaseId,
    lastSelectedPhaseId: safeSelectedPhaseId,
    unlockedPhaseIds,
    phaseProgress,
    phaseRecords
  };
}

/** Загружает профиль кампании из storage. */
export function loadProfile(storage = window.localStorage) {
  try {
    const rawValue = storage.getItem(PROFILE_STORAGE_KEY);
    return normalizeProfile(rawValue ? JSON.parse(rawValue) : null);
  } catch (_error) {
    return createDefaultProfile();
  }
}

/** Сохраняет профиль кампании в storage. */
export function saveProfile(profile, storage = window.localStorage) {
  try {
    storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalizeProfile(profile)));
  } catch (_error) {
    // localStorage может быть недоступен; профиль остаётся рабочим до перезагрузки страницы.
  }
}

/** Выбирает активную фазу, если она открыта в профиле. */
export function selectPhase(profile, phaseId) {
  const normalizedProfile = normalizeProfile(profile);
  const phase = getPhaseById(phaseId);
  if (!normalizedProfile.phaseProgress[phase.id].unlocked) {
    return normalizedProfile;
  }

  return {
    ...normalizedProfile,
    activePhaseId: phase.id,
    lastSelectedPhaseId: phase.id
  };
}

/** Обновляет рекорд выбранной фазы по снимку текущей партии. */
export function updatePhaseRecord(profile, phaseId, snapshot) {
  const normalizedProfile = normalizeProfile(profile);
  const phase = getPhaseById(phaseId);
  const record = normalizedProfile.phaseRecords[phase.id] || createPhaseRecord();
  normalizedProfile.phaseRecords[phase.id] = {
    highScore: Math.max(record.highScore, snapshot.score || 0),
    bestCombo: Math.max(record.bestCombo, snapshot.bestComboThisRun || 0),
    bestLines: Math.max(record.bestLines, snapshot.lines || 0)
  };
  return normalizedProfile;
}

/** Создаёт runtime кампании для одной партии. */
export class CampaignRuntime {
  constructor(profile) {
    this.profile = normalizeProfile(profile);
    this.phase = getPhaseById(this.profile.activePhaseId);
    this.runStats = createRunStats();
  }

  /** Запускает отслеживание objectives для выбранной фазы. */
  startPhase(phaseId) {
    this.profile = selectPhase(this.profile, phaseId);
    this.phase = getPhaseById(this.profile.activePhaseId);
    this.runStats = createRunStats();
    return this.phase;
  }

  /** Обновляет прогресс кампании по событиям партии и возвращает campaign events. */
  applyGameEvents(snapshot, events) {
    updateRunStats(this.runStats, snapshot, events);
    this.profile = updatePhaseRecord(this.profile, this.phase.id, snapshot);
    const campaignEvents = [];
    const phaseProgress = this.profile.phaseProgress[this.phase.id];

    this.phase.objectives.forEach((objective) => {
      if (phaseProgress.completedObjectives.includes(objective.id)) return;
      if (!isObjectiveComplete(objective, this.runStats)) return;

      phaseProgress.completedObjectives.push(objective.id);
      campaignEvents.push({
        type: "objectiveCompleted",
        phaseId: this.phase.id,
        objectiveId: objective.id,
        objectiveLabel: objective.label
      });
    });

    const unlockedPhase = unlockNextPhaseIfReady(this.profile, this.phase);
    if (unlockedPhase) {
      campaignEvents.push({
        type: "phaseUnlocked",
        phaseId: unlockedPhase.id,
        phaseTitle: unlockedPhase.title
      });
    }

    return campaignEvents;
  }

  /** Возвращает текущий профиль кампании. */
  getProfile() {
    return normalizeProfile(this.profile);
  }

  /** Возвращает текущую фазу кампании. */
  getPhase() {
    return this.phase;
  }
}

/** Возвращает количество выполненных objectives для фазы. */
export function getCompletedObjectiveCount(profile, phaseId) {
  const normalizedProfile = normalizeProfile(profile);
  return normalizedProfile.phaseProgress[phaseId]?.completedObjectives.length || 0;
}

/** Возвращает true, если фаза открыта. */
export function isPhaseUnlocked(profile, phaseId) {
  const normalizedProfile = normalizeProfile(profile);
  return Boolean(normalizedProfile.phaseProgress[phaseId]?.unlocked);
}

function createRunStats() {
  return {
    score: 0,
    lines: 0,
    bestCombo: 0,
    level: 1,
    tetrisCount: 0,
    bestBackToBack: 0
  };
}

function createPhaseRecord() {
  return {
    highScore: 0,
    bestCombo: 0,
    bestLines: 0
  };
}

function normalizePhaseRecord(rawRecord) {
  if (!rawRecord || typeof rawRecord !== "object") return createPhaseRecord();
  return {
    highScore: safeNumber(rawRecord.highScore),
    bestCombo: safeNumber(rawRecord.bestCombo),
    bestLines: safeNumber(rawRecord.bestLines)
  };
}

function safeNumber(value) {
  const numberValue = Number.parseInt(value || "0", 10);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function updateRunStats(runStats, snapshot, events) {
  runStats.score = Math.max(runStats.score, snapshot.score);
  runStats.lines = Math.max(runStats.lines, snapshot.lines);
  runStats.bestCombo = Math.max(runStats.bestCombo, snapshot.bestComboThisRun);
  runStats.level = Math.max(runStats.level, snapshot.level);

  events.forEach((event) => {
    if (event.type === "lineClear" && event.count === 4) {
      runStats.tetrisCount += 1;
    }
    if (event.type === "lineClear") {
      runStats.bestBackToBack = Math.max(runStats.bestBackToBack, event.backToBack || 0);
    }
  });
}

function isObjectiveComplete(objective, runStats) {
  if (objective.type === "score") return runStats.score >= objective.target;
  if (objective.type === "lines") return runStats.lines >= objective.target;
  if (objective.type === "combo") return runStats.bestCombo >= objective.target;
  if (objective.type === "surviveLevel") return runStats.level >= objective.target;
  if (objective.type === "tetris") return runStats.tetrisCount >= objective.target;
  if (objective.type === "backToBack") return runStats.bestBackToBack >= objective.target;
  return false;
}

function unlockNextPhaseIfReady(profile, phase) {
  const completedCount = profile.phaseProgress[phase.id].completedObjectives.length;
  if (completedCount < phase.unlockRequired) return null;

  const nextPhase = getNextPhase(phase.id);
  if (!nextPhase || profile.phaseProgress[nextPhase.id].unlocked) return null;

  profile.phaseProgress[nextPhase.id].unlocked = true;
  profile.unlockedPhaseIds = PHASES
    .filter((item) => profile.phaseProgress[item.id].unlocked)
    .map((item) => item.id);
  return nextPhase;
}
