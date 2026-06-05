import { PHASES } from "../campaign/phases.js";

const VIEW_SCREEN = {
  hangar: "hangar",
  phaseSelect: "phaseSelect",
  playing: "game",
  paused: "game",
  results: "results",
  settings: "settings"
};

/** Управляет экранами arcade app, фазовым фоном и campaign-представлениями. */
export class ArcadeShell {
  constructor(elements) {
    this.elements = elements;
    this.view = "hangar";
  }

  /** Переключает активный экран без router-а. */
  setView(view) {
    this.view = view;
    const screenKey = VIEW_SCREEN[view] || VIEW_SCREEN.hangar;
    document.body.dataset.view = view;
    this.elements.app.dataset.view = view;

    Object.entries(this.elements.screens).forEach(([key, screen]) => {
      screen.hidden = key !== screenKey;
    });
  }

  /** Обновляет CSS-переменные текущей фазы. */
  setPhase(phase) {
    this.elements.app.style.setProperty("--phase-backdrop", `url("${phase.backdrop}")`);
    this.elements.app.style.setProperty("--phase-primary", phase.palette.primary);
    this.elements.app.style.setProperty("--phase-secondary", phase.palette.secondary);
    this.elements.app.style.setProperty("--phase-accent", phase.palette.accent);
  }

  /** Рисует hangar-экран с текущим профилем и рекордами. */
  renderHangar(profile, records, selectedPhase) {
    const completedTotal = PHASES.reduce((sum, phase) => (
      sum + (profile.phaseProgress[phase.id]?.completedObjectives.length || 0)
    ), 0);

    this.elements.hangarHighScore.textContent = formatNumber(records.highScore);
    this.elements.hangarBestCombo.textContent = String(records.bestCombo);
    this.elements.hangarUnlocked.textContent = `${profile.unlockedPhaseIds.length}/${PHASES.length}`;
    this.elements.hangarObjectives.textContent = String(completedTotal);
    this.elements.hangarPhaseTitle.textContent = selectedPhase.title;
    this.elements.hangarPhaseTagline.textContent = selectedPhase.tagline;
    this.elements.hangarPoster.style.backgroundImage = `url("${selectedPhase.backdrop}")`;
  }

  /** Рисует выбор фазы кампании. */
  renderPhaseSelect(profile, selectedPhaseId) {
    this.elements.phaseGrid.innerHTML = "";
    PHASES.forEach((phase) => {
      const progress = profile.phaseProgress[phase.id];
      const record = profile.phaseRecords[phase.id] || { highScore: 0, bestCombo: 0, bestLines: 0 };
      const unlocked = Boolean(progress?.unlocked);
      const selected = phase.id === selectedPhaseId;
      const card = document.createElement("button");
      card.className = `phase-card${selected ? " selected" : ""}${unlocked ? "" : " locked"}`;
      card.type = "button";
      card.disabled = !unlocked;
      card.dataset.appAction = "select-phase";
      card.dataset.phaseId = phase.id;
      card.innerHTML = `
        <span class="phase-poster" style="background-image: url('${phase.backdrop}')"></span>
        <span class="phase-card-body">
          <span class="phase-index">Phase ${phase.index}</span>
          <strong>${phase.title}</strong>
          <span>${unlocked ? phase.tagline : "Locked phase"}</span>
          <span class="phase-card-records">
            <span>${formatNumber(record.highScore)} pts</span>
            <span>${record.bestLines} lines</span>
          </span>
          <span class="objective-mini">
            ${phase.objectives.map((objective) => `<span class="${progress?.completedObjectives.includes(objective.id) ? "done" : ""}">${objective.label}</span>`).join("")}
          </span>
        </span>
      `;
      this.elements.phaseGrid.appendChild(card);
    });
  }

  /** Рисует экран результатов после завершения партии. */
  renderResults(snapshot, phase, profile, campaignEvents, records) {
    const progress = profile.phaseProgress[phase.id];
    const completedCount = progress?.completedObjectives.length || 0;
    const unlockedEvents = campaignEvents.filter((event) => event.type === "phaseUnlocked");
    const objectiveEvents = campaignEvents.filter((event) => event.type === "objectiveCompleted");

    this.elements.resultsTitle.textContent = snapshot.state === "gameover" ? "Core Collapse" : "Run Complete";
    this.elements.resultsPhase.textContent = phase.title;
    this.elements.resultsScore.textContent = formatNumber(snapshot.score);
    this.elements.resultsLines.textContent = String(snapshot.lines);
    this.elements.resultsCombo.textContent = String(snapshot.bestComboThisRun);
    this.elements.resultsHighScore.textContent = formatNumber(records.highScore);
    this.elements.resultsObjectives.textContent = `${completedCount}/${phase.objectives.length}`;
    this.elements.resultsLog.innerHTML = "";

    [...objectiveEvents, ...unlockedEvents].forEach((event) => {
      const item = document.createElement("li");
      item.textContent = event.type === "phaseUnlocked"
        ? `Unlocked: ${event.phaseTitle}`
        : `Objective complete: ${event.objectiveLabel}`;
      this.elements.resultsLog.appendChild(item);
    });

    if (!this.elements.resultsLog.children.length) {
      const item = document.createElement("li");
      item.textContent = "No new objective completed this run.";
      this.elements.resultsLog.appendChild(item);
    }
  }

  /** Рисует лёгкий settings-экран без дополнительных FX-переключателей. */
  renderSettings(isMuted, profile) {
    this.elements.settingsMute.textContent = isMuted ? "Sound Off" : "Sound On";
    this.elements.settingsMute.setAttribute("aria-pressed", isMuted ? "true" : "false");
    this.elements.settingsMuteLabel.textContent = isMuted ? "Sound Off" : "Sound On";
    this.elements.settingsUnlocked.textContent = `${profile.unlockedPhaseIds.length}/${PHASES.length}`;
  }
}

function formatNumber(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
