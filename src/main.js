import "./styles.css";
import { ReactiveAudio } from "./audio/reactiveAudio.js";
import { CampaignRuntime, loadProfile, saveProfile, selectPhase, updatePhaseRecord } from "./campaign/profile.js";
import { getPhaseById } from "./campaign/phases.js";
import { TetrisGame } from "./game/tetrisGame.js";
import { bindControls } from "./input/controls.js";
import { CosmicRenderer } from "./render/cosmicRenderer.js";
import { loadRecords, saveAudioMuted, updateRunRecords } from "./storage.js";
import { ArcadeShell } from "./ui/appShell.js";
import { GameHud } from "./ui/hud.js";

const elements = {
  app: document.getElementById("app"),
  screens: {
    hangar: document.getElementById("hangar-screen"),
    phaseSelect: document.getElementById("phase-screen"),
    game: document.getElementById("game-screen"),
    results: document.getElementById("results-screen"),
    settings: document.getElementById("settings-screen")
  },
  hangarPoster: document.getElementById("hangar-poster"),
  hangarHighScore: document.getElementById("hangar-high-score"),
  hangarBestCombo: document.getElementById("hangar-best-combo"),
  hangarUnlocked: document.getElementById("hangar-unlocked"),
  hangarObjectives: document.getElementById("hangar-objectives"),
  hangarPhaseTitle: document.getElementById("hangar-phase-title"),
  hangarPhaseTagline: document.getElementById("hangar-phase-tagline"),
  phaseGrid: document.getElementById("phase-grid"),
  resultsTitle: document.getElementById("results-title"),
  resultsPhase: document.getElementById("results-phase"),
  resultsScore: document.getElementById("results-score"),
  resultsLines: document.getElementById("results-lines"),
  resultsCombo: document.getElementById("results-combo"),
  resultsHighScore: document.getElementById("results-high-score"),
  resultsObjectives: document.getElementById("results-objectives"),
  resultsLog: document.getElementById("results-log"),
  settingsMute: document.getElementById("settings-mute-button"),
  settingsMuteLabel: document.getElementById("settings-mute-label"),
  settingsUnlocked: document.getElementById("settings-unlocked"),
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
  highScore: document.getElementById("hangar-high-score"),
  bestCombo: document.getElementById("hangar-best-combo"),
  reactorFill: document.getElementById("reactor-fill"),
  reactorValue: document.getElementById("reactor-value"),
  nextPreview: document.getElementById("next-preview"),
  holdPreview: document.getElementById("hold-preview"),
  phaseTitle: document.getElementById("phase-title"),
  phaseTagline: document.getElementById("phase-tagline"),
  objectiveList: document.getElementById("objective-list"),
  hazardChip: document.getElementById("hazard-chip")
};

const game = new TetrisGame();
let records = loadRecords();
let profile = loadProfile();
let selectedPhaseId = profile.lastSelectedPhaseId;
let activePhase = getPhaseById(selectedPhaseId);
let campaign = new CampaignRuntime(profile);
let runCampaignEvents = [];
let isStarting = false;
let rendererReady = false;

const audio = new ReactiveAudio(records.audioMuted);
const hud = new GameHud(elements);
const shell = new ArcadeShell(elements);
const renderer = new CosmicRenderer(elements.pixiStage);

bootstrap();

/** Инициализирует экранную оболочку, input bindings и lazy Pixi renderer. */
function bootstrap() {
  shell.setPhase(activePhase);
  shell.setView("hangar");
  renderChrome();
  hud.update(game.getSnapshot(), records, audio.isMuted, { phase: activePhase, profile });
  hud.showReady();

  elements.primaryAction.addEventListener("click", () => handlePrimaryAction());
  elements.muteButton.addEventListener("click", () => toggleAudio());
  document.addEventListener("click", (event) => handleAppClick(event));

  bindControls({
    onAction: (action) => handleAction(action),
    onPrimaryAction: () => handlePrimaryAction()
  });
}

async function handlePrimaryAction() {
  if (isStarting) return;
  if (shell.view === "paused") {
    await handleAction("pause");
    return;
  }
  if (shell.view === "results") {
    await startSelectedPhase(activePhase.id);
    return;
  }
  if (shell.view === "hangar" || shell.view === "phaseSelect") {
    await startSelectedPhase(selectedPhaseId);
  }
}

async function handleAction(action) {
  await audio.unlock();

  if (action === "pause") {
    if (game.togglePause()) {
      processEvents(game.drainEvents());
      if (game.state === "paused") {
        shell.setView("paused");
        hud.showPaused();
      } else {
        shell.setView("playing");
        hud.hideOverlay();
      }
    }
    return;
  }

  if (shell.view !== "playing" || game.state !== "playing") return;

  if (action === "move-left") game.move(-1);
  if (action === "move-right") game.move(1);
  if (action === "rotate") game.rotate();
  if (action === "soft-drop") game.softDrop();
  if (action === "hard-drop") game.hardDrop();
  if (action === "hold") game.holdPiece();

  processEvents(game.drainEvents());
  renderGameSnapshot();
}

async function handleAppClick(event) {
  const control = event.target.closest("[data-app-action]");
  if (!control) return;

  const action = control.dataset.appAction;
  if (action === "select-phase") {
    selectPhaseForShell(control.dataset.phaseId);
  }
  if (action === "open-phases") {
    shell.setView("phaseSelect");
    renderChrome();
  }
  if (action === "open-settings") {
    shell.setView("settings");
    renderChrome();
  }
  if (action === "back-hangar") {
    shell.setView("hangar");
    renderChrome();
  }
  if (action === "start-selected") {
    await startSelectedPhase(selectedPhaseId);
  }
  if (action === "retry-phase") {
    await startSelectedPhase(activePhase.id);
  }
  if (action === "toggle-audio") {
    await toggleAudio();
  }
}

async function startSelectedPhase(phaseId) {
  if (isStarting) return;
  const requestedPhase = getPhaseById(phaseId);
  if (!profile.phaseProgress[requestedPhase.id]?.unlocked) return;

  isStarting = true;
  runCampaignEvents = [];
  profile = selectPhase(profile, requestedPhase.id);
  campaign = new CampaignRuntime(profile);
  activePhase = campaign.startPhase(requestedPhase.id);
  profile = campaign.getProfile();
  selectedPhaseId = activePhase.id;
  saveProfile(profile);

  shell.setPhase(activePhase);
  shell.setView("playing");
  renderChrome();
  await nextFrame();
  await ensureRenderer();
  renderer.setPhase(activePhase);
  renderer.render(game.getSnapshot());

  hud.showCharging();
  await audio.unlock();
  await renderer.playIntro(activePhase);
  game.startGame(activePhase);
  processEvents(game.drainEvents());
  hud.hideOverlay();
  renderGameSnapshot();
  isStarting = false;
}

function processEvents(events) {
  if (!events.length) return;
  if (rendererReady) renderer.processEvents(events);
  events.forEach((event) => audio.playEvent(event));

  const snapshot = game.getSnapshot();
  records = updateRunRecords(records, snapshot);
  const campaignEvents = campaign.applyGameEvents(snapshot, events);
  if (campaignEvents.length) {
    runCampaignEvents.push(...campaignEvents);
    if (rendererReady) renderer.processEvents(campaignEvents);
    campaignEvents.forEach((event) => audio.playEvent(event));
    profile = campaign.getProfile();
    saveProfile(profile);
    renderChrome();
  }

  if (events.some((event) => event.type === "gameOver")) {
    profile = updatePhaseRecord(campaign.getProfile(), activePhase.id, snapshot);
    saveProfile(profile);
    shell.setView("results");
    shell.renderResults(snapshot, activePhase, profile, runCampaignEvents, records);
  }
}

async function toggleAudio() {
  const isMuted = audio.setMuted(!audio.isMuted);
  saveAudioMuted(isMuted);
  records = { ...records, audioMuted: isMuted };
  if (!isMuted) {
    await audio.unlock();
  }
  renderChrome();
  renderGameSnapshot();
}

function selectPhaseForShell(phaseId) {
  profile = selectPhase(profile, phaseId);
  selectedPhaseId = profile.lastSelectedPhaseId;
  activePhase = getPhaseById(selectedPhaseId);
  saveProfile(profile);
  shell.setPhase(activePhase);
  renderChrome();
}

async function ensureRenderer() {
  if (rendererReady) return;
  await renderer.init();
  renderer.setFrameHandler((delta) => handleFrame(delta));
  rendererReady = true;
}

function handleFrame(delta) {
  if (game.state === "playing") {
    game.update(delta);
    processEvents(game.drainEvents());
  }
  renderGameSnapshot();
}

function renderChrome() {
  shell.renderHangar(profile, records, activePhase);
  shell.renderPhaseSelect(profile, selectedPhaseId);
  shell.renderSettings(audio.isMuted, profile);
}

function renderGameSnapshot() {
  const snapshot = game.getSnapshot();
  records = updateRunRecords(records, snapshot);
  if (rendererReady) renderer.render(snapshot);
  hud.update(snapshot, records, audio.isMuted, { phase: activePhase, profile });
}

function nextFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}
