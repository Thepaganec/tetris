import {
  COLS,
  I_KICKS,
  KICKS,
  ROWS,
  SCORE_TABLE,
  SHAPES,
  TETROMINO_TYPES
} from "./constants.js";

const CLASSIC_PHASE = {
  id: "classic",
  title: "Classic Reactor",
  hazards: [],
  difficulty: {
    gravityMultiplier: 1,
    hazardInitialDelay: 0,
    hazardMinInterval: 0,
    hazardMaxInterval: 0,
    warningDuration: 0,
    speedMultiplier: 1,
    speedDuration: 0,
    surgeGain: 0,
    corruptionCells: 0,
    lockCells: 0,
    lockDuration: 0
  }
};

/** Управляет правилами Tetris и публикует события для renderer-а, UI и audio. */
export class TetrisGame {
  constructor() {
    this.resetToReady();
  }

  /** Возвращает игру в стартовое состояние без запуска партии. */
  resetToReady() {
    this.board = createBoard();
    this.bag = [];
    this.queue = [];
    this.current = null;
    this.holdType = null;
    this.canHold = true;
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.combo = 0;
    this.bestComboThisRun = 0;
    this.backToBack = 0;
    this.backToBackArmed = false;
    this.reactorCharge = 0;
    this.state = "ready";
    this.dropTimer = 0;
    this.reactorDecayTimer = 0;
    this.activePhase = CLASSIC_PHASE;
    this.hazardTimer = 0;
    this.hazardCursor = 0;
    this.pendingHazard = null;
    this.speedSpikeRemaining = 0;
    this.lockedZone = null;
    this.events = [];
    fillQueue(this);
  }

  /** Запускает новую партию и создаёт первую фигуру. */
  startGame(phase = CLASSIC_PHASE) {
    this.resetToReady();
    this.activePhase = normalizePhase(phase);
    this.hazardTimer = this.getNextHazardDelay(true);
    this.state = "playing";
    this.spawnPiece();
    this.emit("phaseStarted", {
      phaseId: this.activePhase.id,
      phaseTitle: this.activePhase.title,
      phase: this.activePhase
    });
    this.emit("phaseLoopChanged", {
      phaseId: this.activePhase.id,
      loop: this.activePhase.loop || null
    });
    this.emit("gameStart", { phaseId: this.activePhase.id });
  }

  /** Обновляет автоматическое падение и плавный спад заряда реактора. */
  update(delta) {
    if (this.state !== "playing" || !this.current) return;

    this.dropTimer += delta;
    this.reactorDecayTimer += delta;
    this.updateHazards(delta);
    if (this.reactorDecayTimer >= 250) {
      this.reactorCharge = Math.max(0, this.reactorCharge - 0.45);
      this.reactorDecayTimer = 0;
    }

    if (this.dropTimer >= this.getEffectiveDropInterval()) {
      if (!this.collides(this.current, this.current.x, this.current.y + 1, this.current.rotation)) {
        this.current.y += 1;
      } else {
        this.lockPiece(false, 0);
      }
      this.dropTimer = 0;
    }
  }

  /** Сдвигает текущую фигуру по горизонтали. */
  move(dx) {
    if (!this.canAct()) return false;
    if (this.collides(this.current, this.current.x + dx, this.current.y, this.current.rotation)) return false;

    this.current.x += dx;
    this.emit("move", { cells: this.getCells(this.current), direction: dx });
    return true;
  }

  /** Поворачивает текущую фигуру с простыми wall kick-попытками. */
  rotate() {
    if (!this.canAct() || this.current.type === "O") return false;

    const nextRotation = (this.current.rotation + 1) % 4;
    const kicks = this.current.type === "I" ? I_KICKS : KICKS;
    for (let i = 0; i < kicks.length; i += 1) {
      const [dx, dy] = kicks[i];
      if (!this.collides(this.current, this.current.x + dx, this.current.y + dy, nextRotation)) {
        this.current.x += dx;
        this.current.y += dy;
        this.current.rotation = nextRotation;
        this.emit("rotate", { cells: this.getCells(this.current), kick: { x: dx, y: dy } });
        return true;
      }
    }

    return false;
  }

  /** Опускает фигуру на одну клетку или фиксирует её при столкновении. */
  softDrop() {
    if (!this.canAct()) return false;
    if (!this.collides(this.current, this.current.x, this.current.y + 1, this.current.rotation)) {
      this.current.y += 1;
      this.dropTimer = 0;
      this.emit("softDrop", { cells: this.getCells(this.current) });
      return true;
    }

    this.lockPiece(false, 0);
    return true;
  }

  /** Мгновенно опускает фигуру до точки фиксации. */
  hardDrop() {
    if (!this.canAct()) return false;

    let distance = 0;
    while (!this.collides(this.current, this.current.x, this.current.y + 1, this.current.rotation)) {
      this.current.y += 1;
      distance += 1;
    }

    this.lockPiece(true, distance);
    return true;
  }

  /** Перекладывает текущую фигуру в hold-слот. */
  holdPiece() {
    if (!this.canAct() || !this.canHold) return false;

    const previous = this.holdType;
    this.holdType = this.current.type;
    if (previous) {
      this.current = createPiece(previous);
      if (this.collides(this.current)) {
        this.gameOver();
        return false;
      }
    } else {
      this.spawnPiece();
    }

    this.canHold = false;
    this.emit("hold", { holdType: this.holdType, current: this.current ? this.current.type : null });
    return true;
  }

  /** Переключает паузу без изменения состояния партии. */
  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      this.emit("pause");
      return true;
    }
    if (this.state === "paused") {
      this.state = "playing";
      this.dropTimer = 0;
      this.emit("resume");
      return true;
    }
    return false;
  }

  /** Возвращает снимок состояния для renderer-а и UI. */
  getSnapshot() {
    return {
      board: this.board,
      current: this.current ? { ...this.current } : null,
      ghost: this.current && this.state !== "gameover" ? this.getGhostPiece() : null,
      queue: this.queue.slice(),
      holdType: this.holdType,
      score: this.score,
      level: this.level,
      lines: this.lines,
      combo: this.combo,
      bestComboThisRun: this.bestComboThisRun,
      backToBack: this.backToBack,
      reactorCharge: this.reactorCharge,
      phase: {
        id: this.activePhase.id,
        title: this.activePhase.title,
        palette: this.activePhase.palette || null
      },
      hazardWarning: this.pendingHazard ? {
        type: this.pendingHazard.type,
        label: this.pendingHazard.label,
        remaining: this.pendingHazard.warningRemaining,
        duration: this.pendingHazard.warningDuration,
        cells: this.pendingHazard.cells,
        rows: this.pendingHazard.rows
      } : null,
      activeHazards: {
        speedSpike: this.speedSpikeRemaining > 0,
        lockedZone: this.lockedZone ? this.lockedZone.cells : []
      },
      state: this.state
    };
  }

  /** Возвращает и очищает очередь событий последнего кадра. */
  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  /** Возвращает интервал автоматического падения для текущего уровня. */
  getDropInterval() {
    return Math.max(90, 820 - (this.level - 1) * 68);
  }

  /** Возвращает интервал падения с учётом фазы и активных hazards. */
  getEffectiveDropInterval() {
    const phaseMultiplier = this.activePhase.difficulty.gravityMultiplier || 1;
    const speedMultiplier = this.speedSpikeRemaining > 0
      ? this.activePhase.difficulty.speedMultiplier || 1
      : 1;
    return Math.max(55, this.getDropInterval() * phaseMultiplier * speedMultiplier);
  }

  /** Создаёт координаты занятых клеток фигуры. */
  getCells(piece, rotation = piece.rotation, x = piece.x, y = piece.y) {
    const cells = SHAPES[piece.type];
    const result = [];

    for (let i = 0; i < cells.length; i += 1) {
      let rx = cells[i][0];
      let ry = cells[i][1];

      if (piece.type !== "O") {
        for (let turn = 0; turn < rotation % 4; turn += 1) {
          const oldRx = rx;
          rx = 3 - ry;
          ry = oldRx;
        }
      }

      result.push({ x: x + rx, y: y + ry, type: piece.type });
    }

    return result;
  }

  /** Проверяет столкновение фигуры со стенами, полом или занятыми клетками. */
  collides(piece = this.current, x = piece.x, y = piece.y, rotation = piece.rotation) {
    if (!piece) return true;
    const cells = this.getCells(piece, rotation, x, y);
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      if (cell.x < 0 || cell.x >= COLS || cell.y >= ROWS) return true;
      if (cell.y >= 0 && this.board[cell.y][cell.x]) return true;
    }
    return false;
  }

  /** Создаёт ghost-фигуру в точке будущей фиксации. */
  getGhostPiece() {
    const ghost = { ...this.current };
    while (!this.collides(ghost, ghost.x, ghost.y + 1, ghost.rotation)) {
      ghost.y += 1;
    }
    return ghost;
  }

  spawnPiece() {
    fillQueue(this);
    this.current = createPiece(this.queue.shift());
    fillQueue(this);
    this.canHold = true;
    if (this.collides(this.current)) {
      this.gameOver();
      return;
    }
    this.emit("spawn", { pieceType: this.current.type });
  }

  lockPiece(isHardDrop, distance) {
    const cells = this.getCells(this.current);
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      if (cell.y < 0) {
        this.gameOver();
        return;
      }
      this.board[cell.y][cell.x] = this.current.type;
    }

    this.emit("pieceLocked", { cells, isHardDrop });
    if (isHardDrop) {
      this.emit("hardDrop", { cells, distance });
    }

    const fullRows = this.findFullRows();
    if (fullRows.length) {
      const previousCharge = this.reactorCharge;
      const clearedCells = this.collectRowCells(fullRows);
      this.clearRows(fullRows);
      this.applyLineScore(fullRows.length);
      this.emit("lineClear", {
        rows: fullRows,
        cells: clearedCells,
        count: fullRows.length,
        combo: this.combo,
        backToBack: this.backToBack,
        reactorCharge: this.reactorCharge
      });
      if (previousCharge < 100 && this.reactorCharge >= 100) {
        this.emit("reactorBurst", { cells: clearedCells, reactorCharge: this.reactorCharge });
      }
    } else {
      this.combo = 0;
      this.reactorCharge = Math.max(0, this.reactorCharge - 6);
    }

    this.spawnPiece();
    this.emit("scoreChanged", this.getSnapshot());
  }

  updateHazards(delta) {
    this.updateActiveHazards(delta);
    if (!this.activePhase.hazards.length) return;

    if (this.pendingHazard) {
      this.pendingHazard.warningRemaining -= delta;
      if (this.pendingHazard.warningRemaining <= 0) {
        const hazard = this.pendingHazard;
        this.pendingHazard = null;
        this.applyHazard(hazard);
        this.hazardTimer = this.getNextHazardDelay(false);
      }
      return;
    }

    this.hazardTimer -= delta;
    if (this.hazardTimer <= 0) {
      this.startHazardWarning();
    }
  }

  updateActiveHazards(delta) {
    this.speedSpikeRemaining = Math.max(0, this.speedSpikeRemaining - delta);
    if (!this.lockedZone) return;

    this.lockedZone.remaining -= delta;
    if (this.lockedZone.remaining > 0) return;

    this.lockedZone.cells.forEach((cell) => {
      if (this.board[cell.y] && this.board[cell.y][cell.x] === "X") {
        this.board[cell.y][cell.x] = null;
      }
    });
    this.emit("hazardExpired", { hazardType: "lockedZone", cells: this.lockedZone.cells });
    this.lockedZone = null;
  }

  startHazardWarning() {
    const hazardType = this.activePhase.hazards[this.hazardCursor % this.activePhase.hazards.length];
    this.hazardCursor += 1;
    const warningDuration = this.activePhase.difficulty.warningDuration || 900;
    const hazard = this.createHazard(hazardType, warningDuration);
    this.pendingHazard = hazard;
    this.emit("hazardWarning", {
      phaseId: this.activePhase.id,
      hazardType: hazard.type,
      label: hazard.label,
      warningDuration: hazard.warningDuration,
      cells: hazard.cells,
      rows: hazard.rows
    });
  }

  createHazard(hazardType, warningDuration) {
    if (hazardType === "rowCorruption") {
      const cells = this.pickCorruptionCells(this.activePhase.difficulty.corruptionCells || 4);
      return {
        type: hazardType,
        label: "Row corruption",
        warningDuration,
        warningRemaining: warningDuration,
        cells,
        rows: uniqueRows(cells)
      };
    }

    if (hazardType === "lockedZone") {
      const cells = this.pickLockedZoneCells(this.activePhase.difficulty.lockCells || 4);
      return {
        type: hazardType,
        label: "Locked zone",
        warningDuration,
        warningRemaining: warningDuration,
        cells,
        rows: uniqueRows(cells)
      };
    }

    return {
      type: hazardType,
      label: hazardType === "speedSpike" ? "Gravity spike" : "Reactor surge",
      warningDuration,
      warningRemaining: warningDuration,
      cells: [],
      rows: []
    };
  }

  applyHazard(hazard) {
    if (hazard.type === "speedSpike") {
      this.speedSpikeRemaining = this.activePhase.difficulty.speedDuration || 4200;
    }
    if (hazard.type === "reactorSurge") {
      this.reactorCharge = Math.min(100, this.reactorCharge + (this.activePhase.difficulty.surgeGain || 20));
    }
    if (hazard.type === "rowCorruption") {
      hazard.cells.forEach((cell) => {
        if (this.board[cell.y] && !this.board[cell.y][cell.x]) {
          this.board[cell.y][cell.x] = "X";
        }
      });
    }
    if (hazard.type === "lockedZone") {
      hazard.cells.forEach((cell) => {
        if (this.board[cell.y] && !this.board[cell.y][cell.x]) {
          this.board[cell.y][cell.x] = "X";
        }
      });
      this.lockedZone = {
        cells: hazard.cells,
        remaining: this.activePhase.difficulty.lockDuration || 4200
      };
    }

    this.emit("hazardApplied", {
      phaseId: this.activePhase.id,
      hazardType: hazard.type,
      label: hazard.label,
      cells: hazard.cells,
      rows: hazard.rows,
      reactorCharge: this.reactorCharge
    });
  }

  getNextHazardDelay(isInitial) {
    if (!this.activePhase.hazards.length) return Number.POSITIVE_INFINITY;
    const difficulty = this.activePhase.difficulty;
    if (isInitial) return difficulty.hazardInitialDelay || difficulty.hazardMinInterval || 8000;
    const min = difficulty.hazardMinInterval || 7000;
    const max = Math.max(min, difficulty.hazardMaxInterval || min);
    const span = max - min;
    return min + (span * ((this.hazardCursor % 4) / 3));
  }

  pickCorruptionCells(count) {
    const cells = [];
    const startY = Math.max(ROWS - 6, 0);
    for (let y = ROWS - 1; y >= startY && cells.length < count; y -= 1) {
      for (let x = (y + this.hazardCursor) % 2; x < COLS && cells.length < count; x += 3) {
        if (!this.board[y][x]) cells.push({ x, y, type: "X" });
      }
    }
    return cells;
  }

  pickLockedZoneCells(count) {
    const cells = [];
    const centerX = 4 + (this.hazardCursor % 2);
    const startY = Math.max(ROWS - 9, 2);
    for (let y = startY; y < ROWS - 2 && cells.length < count; y += 2) {
      for (let x = centerX - 1; x <= centerX + 1 && cells.length < count; x += 1) {
        if (x >= 0 && x < COLS && !this.board[y][x]) cells.push({ x, y, type: "X" });
      }
    }
    return cells;
  }

  findFullRows() {
    const rows = [];
    for (let y = 0; y < ROWS; y += 1) {
      let full = true;
      for (let x = 0; x < COLS; x += 1) {
        if (!this.board[y][x]) {
          full = false;
          break;
        }
      }
      if (full) rows.push(y);
    }
    return rows;
  }

  collectRowCells(rows) {
    const cells = [];
    for (let i = 0; i < rows.length; i += 1) {
      const y = rows[i];
      for (let x = 0; x < COLS; x += 1) {
        cells.push({ x, y, type: this.board[y][x] });
      }
    }
    return cells;
  }

  clearRows(rows) {
    const newBoard = [];
    for (let y = 0; y < ROWS; y += 1) {
      if (!rows.includes(y)) {
        newBoard.push(this.board[y]);
      }
    }
    while (newBoard.length < ROWS) {
      newBoard.unshift(createEmptyRow());
    }
    this.board = newBoard;
  }

  applyLineScore(count) {
    this.lines += count;
    this.score += SCORE_TABLE[count] * this.level;
    this.level = Math.floor(this.lines / 10) + 1;
    this.combo += 1;
    this.bestComboThisRun = Math.max(this.bestComboThisRun, this.combo);

    if (count === 4) {
      this.backToBack = this.backToBackArmed ? this.backToBack + 1 : 1;
      this.backToBackArmed = true;
    } else {
      this.backToBack = 0;
      this.backToBackArmed = false;
    }

    const chargeGain = count * 14 + this.combo * 4 + (count === 4 ? 22 : 0) + (this.backToBack > 1 ? 15 : 0);
    this.reactorCharge = Math.min(100, this.reactorCharge + chargeGain);
  }

  canAct() {
    return this.state === "playing" && Boolean(this.current);
  }

  gameOver() {
    this.state = "gameover";
    this.emit("gameOver", this.getSnapshot());
  }

  emit(type, payload = {}) {
    this.events.push({ type, ...payload });
  }
}

/** Создаёт пустое игровое поле. */
export function createBoard() {
  const rows = [];
  for (let y = 0; y < ROWS; y += 1) {
    rows.push(createEmptyRow());
  }
  return rows;
}

/** Создаёт новую фигуру указанного типа. */
export function createPiece(type) {
  return {
    type,
    x: 3,
    y: -1,
    rotation: 0
  };
}

// Helper-ы ниже обслуживают локальное состояние мешка фигур.
function createEmptyRow() {
  return Array.from({ length: COLS }, () => null);
}

function fillQueue(game) {
  while (game.queue.length < 5) {
    game.queue.push(takeFromBag(game));
  }
}

function takeFromBag(game) {
  if (!game.bag.length) {
    game.bag = shuffle(TETROMINO_TYPES);
  }
  return game.bag.pop();
}

function shuffle(values) {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

function normalizePhase(phase) {
  return {
    ...CLASSIC_PHASE,
    ...phase,
    difficulty: {
      ...CLASSIC_PHASE.difficulty,
      ...(phase && phase.difficulty ? phase.difficulty : {})
    },
    hazards: Array.isArray(phase && phase.hazards) ? phase.hazards.slice() : []
  };
}

function uniqueRows(cells) {
  return Array.from(new Set(cells.map((cell) => cell.y)));
}
