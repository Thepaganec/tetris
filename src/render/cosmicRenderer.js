import { Application, Container, Graphics, Text } from "pixi.js";
import { gsap } from "gsap";
import { CELL_SIZE, COLS, COLORS, ROWS } from "../game/constants.js";

const BOARD_WIDTH = COLS * CELL_SIZE;
const BOARD_HEIGHT = ROWS * CELL_SIZE;

/** Рендерит игровое поле, процедурный реактор, частицы, shockwave и intro-сцену. */
export class CosmicRenderer {
  constructor(host) {
    this.host = host;
    this.app = null;
    this.root = new Container();
    this.background = new Graphics();
    this.boardLayer = new Graphics();
    this.cellLayer = new Graphics();
    this.effectLayer = new Graphics();
    this.flashLayer = new Graphics();
    this.calloutLayer = new Container();
    this.snapshot = null;
    this.frameHandler = null;
    this.stars = createStars(130);
    this.particles = [];
    this.shockwaves = [];
    this.streaks = [];
    this.telegraphs = [];
    this.phasePalette = { primary: "#41e8ff", secondary: "#ff3df2", accent: "#ffe45c" };
    this.time = 0;
    this.flash = 0;
    this.shakePower = 0;
    this.field = null;
  }

  /** Инициализирует Pixi Application внутри переданного DOM-контейнера. */
  async init() {
    this.app = new Application();
    await this.app.init({
      antialias: true,
      autoDensity: true,
      backgroundAlpha: 0,
      powerPreference: "high-performance",
      resizeTo: this.host,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    });

    this.host.appendChild(this.app.canvas);
    this.root.addChild(this.background, this.boardLayer, this.cellLayer, this.effectLayer, this.flashLayer, this.calloutLayer);
    this.app.stage.addChild(this.root);
    this.app.ticker.add((ticker) => this.tick(ticker.deltaMS));
  }

  /** Регистрирует callback основного игрового цикла. */
  setFrameHandler(handler) {
    this.frameHandler = handler;
  }

  /** Сохраняет снимок игры для следующего render tick. */
  render(snapshot) {
    this.snapshot = snapshot;
  }

  /** Устанавливает фазовую палитру до первого игрового события. */
  setPhase(phase) {
    if (phase?.palette) {
      this.phasePalette = phase.palette;
    }
  }

  /** Превращает события game core в визуальные эффекты. */
  processEvents(events) {
    events.forEach((event) => {
      if (event.type === "phaseStarted" && event.phase?.palette) {
        this.phasePalette = event.phase.palette;
      }
      if (event.type === "move" || event.type === "rotate" || event.type === "softDrop") {
        this.spawnCellSparks(event.cells || [], "#9df7ff", 2, 0.45);
      }
      if (event.type === "pieceLocked") {
        this.spawnCellSparks(event.cells || [], "#ffffff", event.isHardDrop ? 8 : 4, event.isHardDrop ? 1.4 : 0.85);
        this.flash = Math.max(this.flash, event.isHardDrop ? 0.35 : 0.14);
      }
      if (event.type === "hardDrop") {
        const center = this.getCellsCenter(event.cells || []);
        this.addShockwave(center.x, center.y, "#41e8ff", 0.42, 210);
        this.addStreaks(event.cells || [], event.distance || 0);
        this.shakePower = Math.max(this.shakePower, 8);
      }
      if (event.type === "lineClear") {
        this.spawnLineExplosion(event);
        this.showCallout(buildClearLabel(event), "#ffe45c", 42);
        this.shakePower = Math.max(this.shakePower, 12 + event.count * 2);
        this.flash = Math.max(this.flash, 0.42);
      }
      if (event.type === "reactorBurst") {
        const center = this.getCellsCenter(event.cells || []);
        this.addShockwave(center.x, center.y, "#ff3df2", 0.7, 360);
        this.spawnRadialBurst(center.x, center.y, "#ff3df2", 150, 2.8);
        this.showCallout("REACTOR CRITICAL", "#ff3df2", 38);
      }
      if (event.type === "gameOver") {
        const center = this.getBoardCenter();
        this.addShockwave(center.x, center.y, "#ff426d", 0.6, 340);
        this.spawnRadialBurst(center.x, center.y, "#ff426d", 120, 2.2);
        this.shakePower = Math.max(this.shakePower, 16);
      }
      if (event.type === "hazardWarning") {
        this.addTelegraph(event);
        this.showCallout(`WARNING: ${event.label}`, this.phasePalette.secondary, 28);
        this.shakePower = Math.max(this.shakePower, 5);
      }
      if (event.type === "hazardApplied") {
        const center = event.cells?.length ? this.getCellsCenter(event.cells) : this.getBoardCenter();
        this.addShockwave(center.x, center.y, this.phasePalette.secondary, 0.48, 260);
        this.spawnRadialBurst(center.x, center.y, this.phasePalette.secondary, 42, 1.55);
        this.showCallout(event.label.toUpperCase(), this.phasePalette.accent, 27);
        this.flash = Math.max(this.flash, 0.28);
        this.shakePower = Math.max(this.shakePower, 10);
      }
      if (event.type === "hazardExpired") {
        this.spawnCellSparks(event.cells || [], "#f8fafc", 5, 0.9);
      }
      if (event.type === "objectiveCompleted") {
        this.showCallout("OBJECTIVE COMPLETE", this.phasePalette.accent, 30);
      }
      if (event.type === "phaseUnlocked") {
        this.showCallout("PHASE UNLOCKED", this.phasePalette.primary, 34);
        const center = this.getBoardCenter();
        this.addShockwave(center.x, center.y, this.phasePalette.primary, 0.58, 340);
      }
    });
  }

  /** Проигрывает cinematic intro перед стартом партии. */
  playIntro(phase = null) {
    const intro = new Container();
    const shade = new Graphics();
    const rings = new Graphics();
    const title = new Text({
      text: phase ? phase.title.toUpperCase() : "COSMIC REACTOR",
      style: {
        align: "center",
        fill: "#eef8ff",
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: 34,
        fontWeight: "900"
      }
    });
    const subtitle = new Text({
      text: phase ? "PHASE IGNITION" : "CORE IGNITION",
      style: {
        align: "center",
        fill: "#41e8ff",
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: 15,
        fontWeight: "800"
      }
    });

    const { width, height } = this.getScreenSize();
    shade.rect(0, 0, width, height).fill({ color: 0x030510, alpha: 0.84 });
    const primary = toHexNumber(this.phasePalette.primary);
    const secondary = toHexNumber(this.phasePalette.secondary);
    rings.circle(0, 0, 86).stroke({ color: primary, alpha: 0.7, width: 3 });
    rings.circle(0, 0, 138).stroke({ color: secondary, alpha: 0.35, width: 2 });
    rings.position.set(width / 2, height / 2);
    title.anchor.set(0.5);
    title.position.set(width / 2, height / 2 - 18);
    subtitle.anchor.set(0.5);
    subtitle.position.set(width / 2, height / 2 + 28);
    intro.addChild(shade, rings, title, subtitle);
    this.app.stage.addChild(intro);

    title.alpha = 0;
    subtitle.alpha = 0;
    title.scale.set(0.88);
    subtitle.scale.set(0.88);
    rings.alpha = 0;
    rings.rotation = -0.8;
    rings.scale.set(0.58);

    return new Promise((resolve) => {
      gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => {
          intro.destroy({ children: true });
          resolve();
        }
      })
        .to(rings, { alpha: 1, rotation: 1.8, duration: 0.72 })
        .to(rings.scale, { x: 1.18, y: 1.18, duration: 0.72 }, "<")
        .to(title, { alpha: 1, duration: 0.38 }, "-=0.44")
        .to(title.scale, { x: 1, y: 1, duration: 0.38 }, "<")
        .to(subtitle, { alpha: 1, y: subtitle.y + 8, duration: 0.32 }, "-=0.22")
        .to(subtitle.scale, { x: 1, y: 1, duration: 0.32 }, "<")
        .to(rings.scale, { x: 2.9, y: 2.9, duration: 0.54, ease: "power2.in" }, "+=0.38")
        .to(rings, { alpha: 0, duration: 0.54, ease: "power2.in" }, "<")
        .to([title, subtitle, shade], { alpha: 0, duration: 0.26 }, "-=0.22");
    });
  }

  tick(delta) {
    this.time += delta;
    if (this.frameHandler) this.frameHandler(delta);

    this.updateEffects(delta);
    this.draw();
  }

  draw() {
    if (!this.app) return;
    this.field = this.computeFieldLayout();
    this.applyShake();
    this.drawBackground();
    this.drawBoardFrame();
    this.drawCells();
    this.drawEffects();
    this.drawFlash();
  }

  drawBackground() {
    const { width, height } = this.getScreenSize();
    this.background.clear();
    this.background.rect(0, 0, width, height).fill({ color: 0x030510, alpha: 0.26 });

    for (let i = 0; i < this.stars.length; i += 1) {
      const star = this.stars[i];
      const x = star.x * width;
      const y = (star.y * height + this.time * star.speed) % height;
      const alpha = 0.18 + Math.sin(this.time * 0.004 + star.phase) * 0.16;
      this.background.circle(x, y, star.size).fill({ color: 0xdffaff, alpha: Math.max(0.08, alpha) });
    }

    const center = this.getBoardCenter();
    const pulse = 0.5 + Math.sin(this.time * 0.003) * 0.5;
    const charge = this.snapshot ? this.snapshot.reactorCharge / 100 : 0;
    const ringAlpha = 0.2 + charge * 0.36 + pulse * 0.08;
    const primary = toHexNumber(this.phasePalette.primary);
    const secondary = toHexNumber(this.phasePalette.secondary);
    this.background.circle(center.x, center.y, this.field.width * (0.72 + pulse * 0.04))
      .stroke({ color: primary, alpha: ringAlpha, width: 2 });
    this.background.circle(center.x, center.y, this.field.width * (0.92 + pulse * 0.05))
      .stroke({ color: secondary, alpha: 0.16 + charge * 0.22, width: 1 });

    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12 + this.time * 0.00035;
      const start = this.field.width * 0.6;
      const end = this.field.width * (1.05 + charge * 0.2);
      this.background.moveTo(center.x + Math.cos(angle) * start, center.y + Math.sin(angle) * start);
      this.background.lineTo(center.x + Math.cos(angle) * end, center.y + Math.sin(angle) * end);
      this.background.stroke({ color: primary, alpha: 0.06 + charge * 0.1, width: 1 });
    }
  }

  drawBoardFrame() {
    const field = this.field;
    this.boardLayer.clear();
    this.boardLayer.roundRect(field.x - 12, field.y - 12, field.width + 24, field.height + 24, 8)
      .fill({ color: 0x08101f, alpha: 0.78 })
      .stroke({ color: 0x41e8ff, alpha: 0.44, width: 2 });
    this.boardLayer.rect(field.x, field.y, field.width, field.height)
      .fill({ color: 0x030711, alpha: 0.92 })
      .stroke({ color: 0x9df7ff, alpha: 0.34, width: 1 });

    for (let x = 1; x < COLS; x += 1) {
      const px = field.x + x * field.cell;
      this.boardLayer.moveTo(px, field.y);
      this.boardLayer.lineTo(px, field.y + field.height);
      this.boardLayer.stroke({ color: 0x74eeff, alpha: 0.08, width: 1 });
    }
    for (let y = 1; y < ROWS; y += 1) {
      const py = field.y + y * field.cell;
      this.boardLayer.moveTo(field.x, py);
      this.boardLayer.lineTo(field.x + field.width, py);
      this.boardLayer.stroke({ color: 0x74eeff, alpha: 0.08, width: 1 });
    }
  }

  drawCells() {
    this.cellLayer.clear();
    if (!this.snapshot) return;

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const type = this.snapshot.board[y][x];
        if (type) this.drawCell(x, y, type, 1, false);
      }
    }

    if (this.snapshot.ghost && this.snapshot.current && this.snapshot.state !== "gameover") {
      const ghostCells = this.getCellsFromPiece(this.snapshot.ghost);
      ghostCells.forEach((cell) => {
        if (cell.y >= 0) this.drawCell(cell.x, cell.y, this.snapshot.current.type, 0.28, true);
      });
    }

    if (this.snapshot.current && this.snapshot.state !== "gameover") {
      const currentCells = this.getCellsFromPiece(this.snapshot.current);
      currentCells.forEach((cell) => {
        if (cell.y >= 0) this.drawCell(cell.x, cell.y, this.snapshot.current.type, 1, false);
      });
    }
  }

  drawCell(x, y, type, alpha, isGhost) {
    const field = this.field;
    const color = toHexNumber(COLORS[type]);
    const px = field.x + x * field.cell;
    const py = field.y + y * field.cell;
    const inset = Math.max(2, field.cell * 0.08);
    const size = field.cell - inset * 2;

    if (isGhost) {
      this.cellLayer.rect(px + inset, py + inset, size, size)
        .stroke({ color, alpha, width: 2 });
      return;
    }

    this.cellLayer.rect(px + 1, py + 1, field.cell - 2, field.cell - 2)
      .fill({ color, alpha: alpha * 0.18 });
    this.cellLayer.roundRect(px + inset, py + inset, size, size, 3)
      .fill({ color, alpha })
      .stroke({ color: 0xffffff, alpha: 0.32, width: 1 });
    this.cellLayer.rect(px + inset + 2, py + inset + 2, size - 4, Math.max(2, size * 0.18))
      .fill({ color: 0xffffff, alpha: alpha * 0.24 });
  }

  drawEffects() {
    this.effectLayer.clear();
    this.drawTelegraphs();

    for (let i = 0; i < this.streaks.length; i += 1) {
      const streak = this.streaks[i];
      const alpha = Math.max(0, streak.life / streak.maxLife);
      this.effectLayer.moveTo(streak.x, streak.y1);
      this.effectLayer.lineTo(streak.x, streak.y2);
      this.effectLayer.stroke({ color: 0x41e8ff, alpha: alpha * 0.38, width: streak.width });
    }

    for (let i = 0; i < this.shockwaves.length; i += 1) {
      const wave = this.shockwaves[i];
      const progress = 1 - wave.life / wave.maxLife;
      const radius = wave.radius + wave.maxRadius * progress;
      this.effectLayer.circle(wave.x, wave.y, radius)
        .stroke({ color: toHexNumber(wave.color), alpha: wave.alpha * (1 - progress), width: 3 });
    }

    for (let i = 0; i < this.particles.length; i += 1) {
      const particle = this.particles[i];
      const alpha = Math.max(0, particle.life / particle.maxLife);
      this.effectLayer.circle(particle.x, particle.y, particle.size * (0.6 + alpha),)
        .fill({ color: toHexNumber(particle.color), alpha: alpha * particle.alpha });
    }
  }

  drawFlash() {
    const { width, height } = this.getScreenSize();
    this.flashLayer.clear();
    if (this.flash <= 0) return;
    this.flashLayer.rect(0, 0, width, height).fill({ color: 0xffffff, alpha: this.flash * 0.22 });
  }

  updateEffects(delta) {
    const step = delta / 16.67;
    this.flash = Math.max(0, this.flash - delta * 0.0018);
    this.shakePower = Math.max(0, this.shakePower - delta * 0.035);

    this.particles = this.particles.filter((particle) => {
      particle.life -= delta;
      particle.vy += particle.gravity * step;
      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      return particle.life > 0;
    });

    this.shockwaves = this.shockwaves.filter((wave) => {
      wave.life -= delta;
      return wave.life > 0;
    });

    this.streaks = this.streaks.filter((streak) => {
      streak.life -= delta;
      return streak.life > 0;
    });

    this.telegraphs = this.telegraphs.filter((telegraph) => {
      telegraph.life -= delta;
      return telegraph.life > 0;
    });
  }

  drawTelegraphs() {
    const field = this.field;
    const color = toHexNumber(this.phasePalette.secondary);
    for (let i = 0; i < this.telegraphs.length; i += 1) {
      const telegraph = this.telegraphs[i];
      const progress = Math.max(0, telegraph.life / telegraph.maxLife);
      const pulse = 0.45 + Math.sin(this.time * 0.025) * 0.35;
      const alpha = Math.max(0.12, progress * 0.34 + pulse * 0.16);

      telegraph.rows.forEach((row) => {
        this.effectLayer.rect(field.x, field.y + row * field.cell, field.width, field.cell)
          .fill({ color, alpha: alpha * 0.42 })
          .stroke({ color, alpha, width: 2 });
      });

      telegraph.cells.forEach((cell) => {
        const x = field.x + cell.x * field.cell;
        const y = field.y + cell.y * field.cell;
        this.effectLayer.rect(x + 2, y + 2, field.cell - 4, field.cell - 4)
          .stroke({ color, alpha: Math.min(0.95, alpha + 0.18), width: 3 });
      });

      if (!telegraph.rows.length && !telegraph.cells.length) {
        const center = this.getBoardCenter();
        this.effectLayer.circle(center.x, center.y, field.width * (0.62 + (1 - progress) * 0.18))
          .stroke({ color, alpha, width: 4 });
      }
    }
  }

  spawnLineExplosion(event) {
    const intensity = 2 + event.count + Math.min(4, event.combo);
    event.cells.forEach((cell) => {
      const color = COLORS[cell.type] || "#41e8ff";
      this.spawnCellSparks([cell], color, intensity, 1.55 + event.count * 0.35);
    });

    const center = this.getCellsCenter(event.cells);
    this.addShockwave(center.x, center.y, event.count === 4 ? "#ff3df2" : "#ffe45c", 0.54, 250 + event.count * 32);
    this.spawnRadialBurst(center.x, center.y, event.count === 4 ? "#ff3df2" : "#ffe45c", 35 + event.count * 22, 1.8);
  }

  spawnCellSparks(cells, color, count, force) {
    cells.forEach((cell) => {
      if (cell.y < 0) return;
      const center = this.getCellCenter(cell.x, cell.y);
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (1.2 + Math.random() * 4.6) * force;
        this.particles.push({
          x: center.x + (Math.random() - 0.5) * this.field.cell,
          y: center.y + (Math.random() - 0.5) * this.field.cell,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          gravity: 0.08,
          size: 1.2 + Math.random() * 2.8,
          color,
          alpha: 0.9,
          life: 360 + Math.random() * 360,
          maxLife: 720
        });
      }
    });
  }

  spawnRadialBurst(x, y, color, count, force) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.18;
      const speed = (2.4 + Math.random() * 5.6) * force;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.02,
        size: 1.4 + Math.random() * 3.6,
        color,
        alpha: 0.95,
        life: 520 + Math.random() * 420,
        maxLife: 940
      });
    }
  }

  addShockwave(x, y, color, alpha, maxRadius) {
    this.shockwaves.push({
      x,
      y,
      color,
      alpha,
      radius: 8,
      maxRadius,
      life: 540,
      maxLife: 540
    });
  }

  addStreaks(cells, distance) {
    cells.forEach((cell) => {
      if (cell.y < 0) return;
      const center = this.getCellCenter(cell.x, cell.y);
      this.streaks.push({
        x: center.x,
        y1: Math.max(this.field.y, center.y - Math.max(60, distance * this.field.cell * 0.85)),
        y2: center.y + this.field.cell * 0.5,
        width: Math.max(2, this.field.cell * 0.18),
        life: 260,
        maxLife: 260
      });
    });
  }

  addTelegraph(event) {
    this.telegraphs.push({
      cells: event.cells || [],
      rows: event.rows || [],
      label: event.label,
      life: event.warningDuration || 900,
      maxLife: event.warningDuration || 900
    });
  }

  showCallout(label, color, size) {
    const center = this.getBoardCenter();
    const text = new Text({
      text: label,
      style: {
        align: "center",
        fill: color,
        fontFamily: "Inter, Segoe UI, sans-serif",
        fontSize: size,
        fontWeight: "900",
        stroke: { color: "#020510", width: 4 }
      }
    });
    text.anchor.set(0.5);
    text.position.set(center.x, center.y - this.field.height * 0.18);
    text.alpha = 0;
    this.calloutLayer.addChild(text);

    gsap.timeline({ onComplete: () => text.destroy() })
      .to(text, { alpha: 1, y: text.y - 18, duration: 0.18, ease: "power2.out" })
      .to(text.scale, { x: 1.12, y: 1.12, duration: 0.24, ease: "back.out(2)" }, "<")
      .to(text, { alpha: 0, y: text.y - 76, duration: 0.62, ease: "power2.in" }, "+=0.16");
  }

  applyShake() {
    if (this.shakePower <= 0) {
      this.root.position.set(0, 0);
      return;
    }
    this.root.position.set(
      (Math.random() - 0.5) * this.shakePower,
      (Math.random() - 0.5) * this.shakePower
    );
  }

  getCellCenter(x, y) {
    return {
      x: this.field.x + x * this.field.cell + this.field.cell / 2,
      y: this.field.y + y * this.field.cell + this.field.cell / 2
    };
  }

  getCellsCenter(cells) {
    if (!cells.length) return this.getBoardCenter();
    const points = cells.filter((cell) => cell.y >= 0).map((cell) => this.getCellCenter(cell.x, cell.y));
    if (!points.length) return this.getBoardCenter();
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length
    };
  }

  getBoardCenter() {
    if (!this.field) this.field = this.computeFieldLayout();
    return {
      x: this.field.x + this.field.width / 2,
      y: this.field.y + this.field.height / 2
    };
  }

  getCellsFromPiece(piece) {
    const shape = {
      I: [[0, 1], [1, 1], [2, 1], [3, 1]],
      J: [[0, 0], [0, 1], [1, 1], [2, 1]],
      L: [[2, 0], [0, 1], [1, 1], [2, 1]],
      O: [[1, 0], [2, 0], [1, 1], [2, 1]],
      S: [[1, 0], [2, 0], [0, 1], [1, 1]],
      T: [[1, 0], [0, 1], [1, 1], [2, 1]],
      Z: [[0, 0], [1, 0], [1, 1], [2, 1]]
    }[piece.type];
    return shape.map(([x, y]) => {
      let rx = x;
      let ry = y;
      if (piece.type !== "O") {
        for (let turn = 0; turn < piece.rotation % 4; turn += 1) {
          const oldRx = rx;
          rx = 3 - ry;
          ry = oldRx;
        }
      }
      return { x: piece.x + rx, y: piece.y + ry, type: piece.type };
    });
  }

  computeFieldLayout() {
    const { width, height } = this.getScreenSize();
    const scale = Math.min((width - 48) / BOARD_WIDTH, (height - 54) / BOARD_HEIGHT, 1.35);
    const cell = CELL_SIZE * Math.max(0.72, scale);
    const boardWidth = COLS * cell;
    const boardHeight = ROWS * cell;
    return {
      x: (width - boardWidth) / 2,
      y: (height - boardHeight) / 2,
      width: boardWidth,
      height: boardHeight,
      cell
    };
  }

  getScreenSize() {
    return {
      width: this.app.screen.width,
      height: this.app.screen.height
    };
  }
}

function buildClearLabel(event) {
  if (event.count === 4 && event.backToBack > 1) return `BACK-TO-BACK x${event.backToBack}`;
  if (event.count === 4) return "TETRIS BURST";
  if (event.combo > 1) return `COMBO x${event.combo}`;
  return event.count === 1 ? "LINE CLEAR" : `${event.count} LINE BLAST`;
}

function createStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: 0.6 + Math.random() * 1.8,
    speed: 0.004 + Math.random() * 0.018,
    phase: Math.random() * Math.PI * 2
  }));
}

function toHexNumber(color) {
  return Number.parseInt(color.replace("#", ""), 16);
}
