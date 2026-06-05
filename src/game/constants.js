export const COLS = 10;
export const ROWS = 20;
export const CELL_SIZE = 30;
export const LOCK_FLASH_TIME = 160;
export const SCORE_TABLE = [0, 40, 100, 300, 1200];

export const COLORS = {
  I: "#41e8ff",
  J: "#4777ff",
  L: "#ff9d2e",
  O: "#ffe45c",
  S: "#46ff8f",
  T: "#c451ff",
  Z: "#ff426d",
  X: "#f8fafc"
};

export const SHAPES = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]]
};

export const KICKS = [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, -1], [1, -1], [-1, -1]];
export const I_KICKS = [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, -1], [0, 1], [1, 1], [-1, 1]];
export const TETROMINO_TYPES = Object.keys(SHAPES);

export const STORAGE_KEYS = {
  highScore: "cosmicTetris.highScore",
  bestCombo: "cosmicTetris.bestCombo",
  audioMuted: "cosmicTetris.audioMuted",
  profile: "cosmicTetris.profile.v2"
};
