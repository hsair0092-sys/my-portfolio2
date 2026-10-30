const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const boardCanvas = document.getElementById("board");
const ctx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const startBtn = document.getElementById("startBtn");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");

const COLORS = [null, "#00d9ff", "#ffd166", "#b56cff", "#06d6a0", "#ef476f", "#4d7cff", "#ff9f43"];

// 블록 모양 (숫자는 COLORS 인덱스)
const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[2, 2], [2, 2]],
  T: [[0, 3, 0], [3, 3, 3], [0, 0, 0]],
  S: [[0, 4, 4], [4, 4, 0], [0, 0, 0]],
  Z: [[5, 5, 0], [0, 5, 5], [0, 0, 0]],
  J: [[6, 0, 0], [6, 6, 6], [0, 0, 0]],
  L: [[0, 0, 7], [7, 7, 7], [0, 0, 0]],
};

const LINE_SCORES = [0, 100, 300, 500, 800];

let board;
let piece;
let nextPiece;
let score;
let lines;
let level;
let dropInterval;
let dropCounter;
let lastTime;
let running = false;
let paused = false;
let animationId;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function randomPiece() {
  const keys = Object.keys(SHAPES);
  const shape = SHAPES[keys[Math.floor(Math.random() * keys.length)]].map((row) => [...row]);
  return {
    shape,
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0,
  };
}

function collides(shape, offsetX, offsetY) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (!shape[y][x]) continue;
      const nx = offsetX + x;
      const ny = offsetY + y;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotate(shape) {
  // 시계 방향 회전
  return shape[0].map((_, i) => shape.map((row) => row[i]).reverse());
}

function tryRotate() {
  const rotated = rotate(piece.shape);
  // 벽에 붙어 있을 때 좌우로 살짝 밀어서 회전 시도
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collides(rotated, piece.x + kick, piece.y)) {
      piece.shape = rotated;
      piece.x += kick;
      return;
    }
  }
}

function move(dir) {
  if (!collides(piece.shape, piece.x + dir, piece.y)) {
    piece.x += dir;
  }
}

function merge() {
  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value && piece.y + y >= 0) {
        board[piece.y + y][piece.x + x] = value;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every((cell) => cell)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      y++; // 같은 줄을 다시 검사
    }
  }
  if (cleared > 0) {
    lines += cleared;
    score += LINE_SCORES[cleared] * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateStats();
  }
}

function lockPiece() {
  merge();
  clearLines();
  piece = nextPiece;
  nextPiece = randomPiece();
  drawNext();
  if (collides(piece.shape, piece.x, piece.y)) {
    gameOver();
  }
}

function softDrop() {
  if (!collides(piece.shape, piece.x, piece.y + 1)) {
    piece.y++;
    score += 1;
    updateStats();
  } else {
    lockPiece();
  }
  dropCounter = 0;
}

function hardDrop() {
  let distance = 0;
  while (!collides(piece.shape, piece.x, piece.y + 1)) {
    piece.y++;
    distance++;
  }
  score += distance * 2;
  updateStats();
  lockPiece();
  dropCounter = 0;
}

function ghostY() {
  let y = piece.y;
  while (!collides(piece.shape, piece.x, y + 1)) y++;
  return y;
}

function drawBlock(context, x, y, color, size = BLOCK, alpha = 1) {
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(x * size, y * size, size, size);
  context.strokeStyle = "rgba(0, 0, 0, 0.35)";
  context.lineWidth = 2;
  context.strokeRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK, 0);
    ctx.lineTo(x * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK);
    ctx.lineTo(COLS * BLOCK, y * BLOCK);
    ctx.stroke();
  }
}

function drawShape(shape, offsetX, offsetY, alpha = 1) {
  shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) drawBlock(ctx, offsetX + x, offsetY + y, COLORS[value], BLOCK, alpha);
    });
  });
}

function draw() {
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid();

  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) drawBlock(ctx, x, y, COLORS[value]);
    });
  });

  if (piece) {
    drawShape(piece.shape, piece.x, ghostY(), 0.2);
    drawShape(piece.shape, piece.x, piece.y);
  }
}

function drawNext() {
  const size = 24;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = nextPiece.shape;
  const offsetX = (nextCanvas.width / size - shape[0].length) / 2;
  const offsetY = (nextCanvas.height / size - shape.length) / 2;
  shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) drawBlock(nextCtx, offsetX + x, offsetY + y, COLORS[value], size);
    });
  });
}

function updateStats() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function showOverlay(text) {
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function update(time = 0) {
  if (!running) return;
  const delta = time - lastTime;
  lastTime = time;

  if (!paused) {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      if (!collides(piece.shape, piece.x, piece.y + 1)) {
        piece.y++;
      } else {
        lockPiece();
      }
      dropCounter = 0;
    }
    draw();
  }

  if (running) animationId = requestAnimationFrame(update);
}

function startGame() {
  cancelAnimationFrame(animationId);
  board = createBoard();
  piece = randomPiece();
  nextPiece = randomPiece();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 1000;
  dropCounter = 0;
  lastTime = performance.now();
  running = true;
  paused = false;
  startBtn.textContent = "다시 시작";
  startBtn.blur();
  hideOverlay();
  updateStats();
  drawNext();
  animationId = requestAnimationFrame(update);
}

function gameOver() {
  running = false;
  draw();
  showOverlay("GAME OVER");
}

function togglePause() {
  paused = !paused;
  if (paused) {
    showOverlay("일시정지");
  } else {
    hideOverlay();
    lastTime = performance.now();
  }
}

document.addEventListener("keydown", (e) => {
  if (!running) return;

  if (e.code === "KeyP") {
    togglePause();
    return;
  }
  if (paused) return;

  switch (e.code) {
    case "ArrowLeft":
      move(-1);
      break;
    case "ArrowRight":
      move(1);
      break;
    case "ArrowDown":
      softDrop();
      break;
    case "ArrowUp":
      tryRotate();
      break;
    case "Space":
      hardDrop();
      break;
    default:
      return;
  }
  e.preventDefault();
  if (running) draw();
});

startBtn.addEventListener("click", startGame);

// 초기 화면
board = createBoard();
draw();
