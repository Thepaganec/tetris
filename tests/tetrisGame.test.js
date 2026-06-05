import { describe, expect, test } from "vitest";
import { COLS, ROWS } from "../src/game/constants.js";
import { TetrisGame } from "../src/game/tetrisGame.js";

describe("TetrisGame", () => {
  test("starts a playable game with queue, current piece and zeroed arcade state", () => {
    const game = new TetrisGame();

    game.startGame();
    const snapshot = game.getSnapshot();

    expect(snapshot.state).toBe("playing");
    expect(snapshot.current).not.toBeNull();
    expect(snapshot.queue).toHaveLength(5);
    expect(snapshot.score).toBe(0);
    expect(snapshot.combo).toBe(0);
    expect(snapshot.reactorCharge).toBe(0);
  });

  test("line clear keeps base scoring compatible and charges combo reactor", () => {
    const game = new TetrisGame();
    game.startGame();
    game.drainEvents();
    game.board[ROWS - 1] = Array.from({ length: COLS }, (_value, x) => (x >= 3 && x <= 6 ? null : "I"));
    game.current = { type: "I", x: 3, y: ROWS - 2, rotation: 0 };

    game.hardDrop();
    const events = game.drainEvents();
    const snapshot = game.getSnapshot();

    expect(events.some((event) => event.type === "lineClear" && event.count === 1)).toBe(true);
    expect(snapshot.lines).toBe(1);
    expect(snapshot.score).toBe(40);
    expect(snapshot.combo).toBe(1);
    expect(snapshot.bestComboThisRun).toBe(1);
    expect(snapshot.reactorCharge).toBeGreaterThan(0);
  });

  test("tetris clears arm back-to-back state", () => {
    const game = new TetrisGame();
    game.startGame();
    game.drainEvents();
    for (let y = ROWS - 4; y < ROWS; y += 1) {
      game.board[y] = Array.from({ length: COLS }, () => "T");
      game.board[y][4] = null;
    }
    game.current = { type: "I", x: 2, y: ROWS - 4, rotation: 1 };

    game.hardDrop();
    const snapshot = game.getSnapshot();

    expect(snapshot.lines).toBe(4);
    expect(snapshot.score).toBe(1200);
    expect(snapshot.backToBack).toBe(1);
    expect(snapshot.reactorCharge).toBeGreaterThan(70);
  });

  test("phase hazards warn before applying speed spike", () => {
    const game = new TetrisGame();
    game.startGame({
      id: "test-phase",
      title: "Test Phase",
      hazards: ["speedSpike"],
      difficulty: {
        hazardInitialDelay: 1,
        hazardMinInterval: 1000,
        hazardMaxInterval: 1000,
        warningDuration: 100,
        speedMultiplier: 0.5,
        speedDuration: 600
      }
    });
    game.drainEvents();

    game.update(2);
    const warningEvents = game.drainEvents();

    expect(warningEvents.some((event) => event.type === "hazardWarning" && event.hazardType === "speedSpike")).toBe(true);
    expect(game.getSnapshot().hazardWarning.label).toBe("Gravity spike");

    game.update(120);
    const appliedEvents = game.drainEvents();
    const snapshot = game.getSnapshot();

    expect(appliedEvents.some((event) => event.type === "hazardApplied" && event.hazardType === "speedSpike")).toBe(true);
    expect(snapshot.activeHazards.speedSpike).toBe(true);
    expect(game.getEffectiveDropInterval()).toBeLessThan(game.getDropInterval());
  });
});
