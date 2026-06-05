import "./styles.css";
import { ReactiveAudio } from "./audio/reactiveAudio.js";
import { TetrisGame } from "./game/tetrisGame.js";
import { bindControls } from "./input/controls.js";
import { CosmicRenderer } from "./render/cosmicRenderer.js";
import { loadRecords, saveAudioMuted, updateRunRecords } from "./storage.js";
import { GameHud } from "./ui/hud.js";

const elements = {
  pixiStage: document.getElementById("pixi-stage"),
  overlay: document.getElementById("overlay"),
  overlayEyebrow: document.getElementById("overlay-eyebrow"),
  overlayTitle: document.getElementById("overlay-title"),
  overlayText: document.getElementById("overlay-text"),
  primaryAction: document.getElementById("primary-action"),
  muteButton: document.getElementById("mute-button"),
  stateLabel: document.getElementById("state-label"),
  score: document.getElementById("score"),
  level: document.getElementById("level"),
  lines: document.getElementById("lines"),
  combo: document.getElementById("combo"),
  backToBack: document.getElementById("back-to-back"),
  highScore: document.getElementById("high-score"),
  bestCombo: document.getElementById("best-combo"),
  reactorFill: document.getElementById("reactor-fill"),
  reactorValue: document.getElementById("reactor-value"),
  nextPreview: document.getElementById("next-preview"),
  holdPreview: document.getElementById("hold-preview")
};

const game = new TetrisGame();
let records = loadRecords();
const audio = new ReactiveAudio(records.audioMuted);
const hud = new GameHud(elements);
const renderer = new CosmicRenderer(elements.pixiStage);
let isStarting = false;

bootstrap();

/** Инициализирует renderer, input bindings и основной игровой цикл. */
async function bootstrap() {
  await renderer.init();
  renderer.render(game.getSnapshot());
  hud.update(game.getSnapshot(), records, audio.isMuted);
  hud.showReady();

  elements.primaryAction.addEventListener("click", () => handlePrimaryAction());
  elements.muteButton.addEventListener("click", () => toggleAudio());

  bindControls({
    onAction: (action) => handleAction(action),
    onPrimaryAction: () => handlePrimaryAction()
  });

  renderer.setFrameHandler((delta) => {
    game.update(delta);
    processEvents(game.drainEvents());
    const snapshot = game.getSnapshot();
    records = updateRunRecords(records, snapshot);
    renderer.render(snapshot);
    hud.update(snapshot, records, audio.isMuted);
  });
}

async function handlePrimaryAction() {
  if (isStarting) return;
  if (game.state === "paused") {
    handleAction("pause");
    return;
  }
  if (game.state === "playing") return;

  isStarting = true;
  hud.showCharging();
  await audio.unlock();
  await renderer.playIntro();
  game.startGame();
  processEvents(game.drainEvents());
  hud.hideOverlay();
  isStarting = false;
}

async function handleAction(action) {
  await audio.unlock();

  if (action === "pause") {
    game.togglePause();
  }
  if (action === "move-left") {
    game.move(-1);
  }
  if (action === "move-right") {
    game.move(1);
  }
  if (action === "rotate") {
    game.rotate();
  }
  if (action === "soft-drop") {
    game.softDrop();
  }
  if (action === "hard-drop") {
    game.hardDrop();
  }
  if (action === "hold") {
    game.holdPiece();
  }

  processEvents(game.drainEvents());
  const snapshot = game.getSnapshot();
  renderer.render(snapshot);
  hud.update(snapshot, records, audio.isMuted);
}

function processEvents(events) {
  if (!events.length) return;
  renderer.processEvents(events);
  events.forEach((event) => audio.playEvent(event));

  const snapshot = game.getSnapshot();
  records = updateRunRecords(records, snapshot);
  if (events.some((event) => event.type === "pause")) {
    hud.showPaused();
  }
  if (events.some((event) => event.type === "resume")) {
    hud.hideOverlay();
  }
  if (events.some((event) => event.type === "gameOver")) {
    hud.showGameOver(snapshot);
  }
}

async function toggleAudio() {
  const isMuted = audio.setMuted(!audio.isMuted);
  saveAudioMuted(isMuted);
  if (!isMuted) {
    await audio.unlock();
  }
  hud.update(game.getSnapshot(), records, audio.isMuted);
}
