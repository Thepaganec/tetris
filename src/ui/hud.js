import { COLORS, SHAPES } from "../game/constants.js";

/** Управляет DOM HUD, preview-фигурами, overlay и текстовыми статусами. */
export class GameHud {
  constructor(elements) {
    this.elements = elements;
  }

  /** Обновляет все числовые показатели и preview-блоки. */
  update(snapshot, records, isMuted) {
    this.elements.score.textContent = formatNumber(snapshot.score);
    this.elements.level.textContent = String(snapshot.level);
    this.elements.lines.textContent = String(snapshot.lines);
    this.elements.combo.textContent = String(snapshot.combo);
    this.elements.backToBack.textContent = String(snapshot.backToBack);
    this.elements.highScore.textContent = formatNumber(records.highScore);
    this.elements.bestCombo.textContent = String(records.bestCombo);
    this.elements.reactorValue.textContent = `${Math.round(snapshot.reactorCharge)}%`;
    this.elements.reactorFill.style.width = `${Math.max(0, Math.min(100, snapshot.reactorCharge))}%`;
    this.elements.stateLabel.textContent = formatState(snapshot.state);
    this.elements.muteButton.textContent = isMuted ? "Sound Off" : "Sound On";
    this.elements.muteButton.setAttribute("aria-pressed", isMuted ? "true" : "false");

    renderPreview(this.elements.nextPreview, snapshot.queue[0]);
    renderPreview(this.elements.holdPreview, snapshot.holdType);
  }

  /** Показывает стартовый overlay. */
  showReady() {
    this.setOverlay("Ready", "Reactor Tetris", "Press Enter or engage the reactor to start the cinematic launch.", "Engage Reactor");
  }

  /** Показывает overlay зарядки intro-сцены. */
  showCharging() {
    this.setOverlay("Charging", "Core ignition", "The reactor is spinning up.", "Charging...");
  }

  /** Показывает overlay паузы. */
  showPaused() {
    this.setOverlay("Pause", "Paused", "Press P or resume when ready.", "Resume");
  }

  /** Показывает overlay завершения партии. */
  showGameOver(snapshot) {
    this.setOverlay("Game Over", "Core collapse", `Final score: ${formatNumber(snapshot.score)}`, "Restart Reactor");
  }

  /** Скрывает overlay поверх игрового поля. */
  hideOverlay() {
    this.elements.overlay.classList.add("hidden");
  }

  setOverlay(eyebrow, title, text, buttonLabel) {
    this.elements.overlayEyebrow.textContent = eyebrow;
    this.elements.overlayTitle.textContent = title;
    this.elements.overlayText.textContent = text;
    this.elements.primaryAction.textContent = buttonLabel;
    this.elements.overlay.classList.remove("hidden");
  }
}

function renderPreview(root, type) {
  root.innerHTML = "";
  for (let i = 0; i < 16; i += 1) {
    const cell = document.createElement("span");
    root.appendChild(cell);
  }
  if (!type) return;

  const cells = SHAPES[type];
  const bounds = getShapeBounds(cells);
  const offsetX = Math.floor((4 - bounds.width) / 2) - bounds.minX;
  const offsetY = Math.floor((4 - bounds.height) / 2) - bounds.minY;
  cells.forEach(([x, y]) => {
    const px = x + offsetX;
    const py = y + offsetY;
    const index = py * 4 + px;
    const cell = root.children[index];
    if (!cell) return;
    cell.style.background = COLORS[type];
    cell.style.boxShadow = `0 0 18px ${COLORS[type]}`;
    cell.classList.add("active");
  });
}

function getShapeBounds(cells) {
  let minX = 4;
  let maxX = 0;
  let minY = 4;
  let maxY = 0;
  cells.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });
  return {
    minX,
    minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function formatNumber(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatState(state) {
  if (state === "playing") return "Online";
  if (state === "paused") return "Paused";
  if (state === "gameover") return "Collapsed";
  return "Ready";
}
