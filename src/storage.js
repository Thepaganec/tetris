import { STORAGE_KEYS } from "./game/constants.js";

/** Загружает сохранённые рекорды и настройки из localStorage. */
export function loadRecords() {
  return {
    highScore: readNumber(STORAGE_KEYS.highScore),
    bestCombo: readNumber(STORAGE_KEYS.bestCombo),
    audioMuted: readBoolean(STORAGE_KEYS.audioMuted)
  };
}

/** Обновляет рекорды текущей партии и сохраняет изменённые значения. */
export function updateRunRecords(records, snapshot) {
  const nextRecords = { ...records };
  if (snapshot.score > nextRecords.highScore) {
    nextRecords.highScore = snapshot.score;
    writeValue(STORAGE_KEYS.highScore, String(snapshot.score));
  }
  if (snapshot.bestComboThisRun > nextRecords.bestCombo) {
    nextRecords.bestCombo = snapshot.bestComboThisRun;
    writeValue(STORAGE_KEYS.bestCombo, String(snapshot.bestComboThisRun));
  }
  return nextRecords;
}

/** Сохраняет состояние mute-переключателя. */
export function saveAudioMuted(isMuted) {
  writeValue(STORAGE_KEYS.audioMuted, isMuted ? "true" : "false");
}

function readNumber(key) {
  const rawValue = readValue(key);
  const value = Number.parseInt(rawValue || "0", 10);
  return Number.isFinite(value) ? value : 0;
}

function readBoolean(key) {
  return readValue(key) === "true";
}

function readValue(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function writeValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_error) {
    // localStorage может быть недоступен в приватном режиме; игра остаётся рабочей без persistence.
  }
}
