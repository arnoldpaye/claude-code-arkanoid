// Constantes
const WIDTH = 800;
const HEIGHT = 600;
const HUD_HEIGHT = 40;          // franja superior reservada al HUD
const MAX_DT = 1 / 30;          // límite de dt en segundos

const PADDLE = { w: 120, h: 14, y: 560, speed: 480 };    // speed en px/s
const BALL = { size: 16, speed: 360 };                     // speed en px/s, constante
const MAX_BOUNCE_ANGLE = Math.PI / 3;                      // 60°

const BRICK = { w: 72, h: 24, gap: 4, cols: 10, offsetTop: 80 };
// offsetLeft centra la rejilla en el canvas
const BRICK_OFFSET_LEFT = (WIDTH - (BRICK.cols * BRICK.w + (BRICK.cols - 1) * BRICK.gap)) / 2;

const ROWS = [                  // de arriba abajo
  { color: 'red',     points: 60 },
  { color: 'yellow',  points: 50 },
  { color: 'cyan',    points: 40 },
  { color: 'magenta', points: 30 },
  { color: 'hotpink', points: 20 },
  { color: 'green',   points: 10 },
];

const START_LIVES = 3;

// Estado mutable
const state = {
  screen: 'start',              // 'start' | 'serve' | 'playing' | 'paused' | 'gameover' | 'win'
  score: 0,
  lives: START_LIVES,
  paddle: { x: 340 },           // x = borde izquierdo
  ball: { x: 0, y: 0, vx: 0, vy: 0 },   // x,y = esquina superior izquierda
  bricks: [],                   // { x, y, color, points, alive }
  input: { left: false, right: false, mouseX: null },
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let lastTime = null;

// Entrada
const KEYS_LEFT = ['ArrowLeft', 'KeyA'];
const KEYS_RIGHT = ['ArrowRight', 'KeyD'];

function setKey(code, pressed) {
  if (KEYS_LEFT.includes(code)) { state.input.left = pressed; return true; }
  if (KEYS_RIGHT.includes(code)) { state.input.right = pressed; return true; }
  return false;
}

// Espacio o clic: acción principal según la pantalla actual
function onAction() {
  switch (state.screen) {
    case 'start':
      state.screen = 'serve';
      break;
    case 'serve':
      launchBall();
      break;
    case 'gameover':
    case 'win':
      resetGame();
      break;
  }
}

// P o Esc: playing ⇄ paused
function togglePause() {
  if (state.screen === 'playing') state.screen = 'paused';
  else if (state.screen === 'paused') state.screen = 'playing';
}

// Reinicio completo: 3 vidas, 0 puntos, 60 bloques, pelota en la pala
function resetGame() {
  state.score = 0;
  state.lives = START_LIVES;
  state.paddle.x = (WIDTH - PADDLE.w) / 2;
  buildBricks();
  attachBallToPaddle();
  state.screen = 'serve';
}

window.addEventListener('keydown', (e) => {
  if (setKey(e.code, true)) { e.preventDefault(); return; }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) onAction();
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (!e.repeat) togglePause();
  }
});

window.addEventListener('keyup', (e) => {
  if (setKey(e.code, false)) e.preventDefault();
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  state.input.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
});

canvas.addEventListener('click', onAction);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updatePaddle(dt) {
  const paddle = state.paddle;
  const input = state.input;

  // Ratón: la pala se centra en la X del cursor (se consume cada movimiento)
  if (input.mouseX !== null) {
    paddle.x = input.mouseX - PADDLE.w / 2;
    input.mouseX = null;
  }

  // Teclado
  let dir = 0;
  if (input.left) dir -= 1;
  if (input.right) dir += 1;
  paddle.x += dir * PADDLE.speed * dt;

  paddle.x = clamp(paddle.x, 0, WIDTH - PADDLE.w);
}

// Pelota
function attachBallToPaddle() {
  const ball = state.ball;
  ball.x = state.paddle.x + PADDLE.w / 2 - BALL.size / 2;
  ball.y = PADDLE.y - BALL.size;
  ball.vx = 0;
  ball.vy = 0;
}

function launchBall() {
  state.ball.vx = 0;
  state.ball.vy = -BALL.speed;   // sale hacia arriba
  state.screen = 'playing';
}

// Rebote en la pala: el ángulo depende del punto de impacto.
// Centro → vertical; bordes → hasta ±MAX_BOUNCE_ANGLE respecto a la vertical.
function collideBallPaddle() {
  const ball = state.ball;
  const paddle = state.paddle;

  if (ball.vy <= 0) return;   // solo si baja

  const overlaps =
    ball.x + BALL.size > paddle.x &&
    ball.x < paddle.x + PADDLE.w &&
    ball.y + BALL.size > PADDLE.y &&
    ball.y < PADDLE.y + PADDLE.h;
  if (!overlaps) return;

  const ballCenter = ball.x + BALL.size / 2;
  const paddleCenter = paddle.x + PADDLE.w / 2;
  const hit = clamp((ballCenter - paddleCenter) / (PADDLE.w / 2 + BALL.size / 2), -1, 1);
  const angle = hit * MAX_BOUNCE_ANGLE;

  ball.vx = BALL.speed * Math.sin(angle);
  ball.vy = -BALL.speed * Math.cos(angle);
  ball.y = PADDLE.y - BALL.size;   // sacarla de la pala
}

// Bloques
function buildBricks() {
  const bricks = [];
  ROWS.forEach((row, r) => {
    for (let c = 0; c < BRICK.cols; c++) {
      bricks.push({
        x: BRICK_OFFSET_LEFT + c * (BRICK.w + BRICK.gap),
        y: BRICK.offsetTop + r * (BRICK.h + BRICK.gap),
        color: row.color,
        points: row.points,
        alive: true,
      });
    }
  });
  state.bricks = bricks;
}

// Como máximo un bloque por frame; rebote por el eje de menor penetración.
function collideBallBricks() {
  const ball = state.ball;
  const ballRight = ball.x + BALL.size;
  const ballBottom = ball.y + BALL.size;

  for (const brick of state.bricks) {
    if (!brick.alive) continue;

    const brickRight = brick.x + BRICK.w;
    const brickBottom = brick.y + BRICK.h;
    if (ballRight <= brick.x || ball.x >= brickRight ||
        ballBottom <= brick.y || ball.y >= brickBottom) continue;

    const penLeft = ballRight - brick.x;      // entra por la izquierda
    const penRight = brickRight - ball.x;     // entra por la derecha
    const penTop = ballBottom - brick.y;      // entra por arriba
    const penBottom = brickBottom - ball.y;   // entra por abajo
    const penX = Math.min(penLeft, penRight);
    const penY = Math.min(penTop, penBottom);

    if (penX < penY) {
      if (penLeft < penRight) {
        ball.x = brick.x - BALL.size;
        ball.vx = -Math.abs(ball.vx);
      } else {
        ball.x = brickRight;
        ball.vx = Math.abs(ball.vx);
      }
    } else {
      if (penTop < penBottom) {
        ball.y = brick.y - BALL.size;
        ball.vy = -Math.abs(ball.vy);
      } else {
        ball.y = brickBottom;
        ball.vy = Math.abs(ball.vy);
      }
    }

    brick.alive = false;
    state.score += brick.points;
    if (state.bricks.every((b) => !b.alive)) state.screen = 'win';
    return;
  }
}

function updateBall(dt) {
  const ball = state.ball;

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Pared izquierda
  if (ball.x < 0) {
    ball.x = -ball.x;
    ball.vx = Math.abs(ball.vx);
  }
  // Pared derecha
  if (ball.x + BALL.size > WIDTH) {
    ball.x = 2 * (WIDTH - BALL.size) - ball.x;
    ball.vx = -Math.abs(ball.vx);
  }
  // Pared superior (borde inferior de la franja del HUD)
  if (ball.y < HUD_HEIGHT) {
    ball.y = 2 * HUD_HEIGHT - ball.y;
    ball.vy = Math.abs(ball.vy);
  }

  collideBallPaddle();
  collideBallBricks();

  // Sale por abajo: pierde una vida
  if (ball.y > HEIGHT) {
    state.lives -= 1;
    state.screen = state.lives > 0 ? 'serve' : 'gameover';
  }
}

function update(dt) {
  const screen = state.screen;

  // En pausa se descarta el ratón para que la pala no salte al reanudar
  if (screen === 'paused') state.input.mouseX = null;

  // En pausa, fin de juego y victoria todo queda congelado
  if (screen === 'start' || screen === 'serve' || screen === 'playing') {
    updatePaddle(dt);
  }

  if (screen === 'start' || screen === 'serve') {
    attachBallToPaddle();
  } else if (screen === 'playing') {
    updateBall(dt);
  }
}

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const brick of state.bricks) {
    if (brick.alive) drawSprite(ctx, 'block_' + brick.color, brick.x, brick.y, BRICK.w, BRICK.h);
  }

  drawSprite(ctx, 'paddle', state.paddle.x, PADDLE.y, PADDLE.w, PADDLE.h);
  drawSprite(ctx, 'ball', state.ball.x, state.ball.y, BALL.size, BALL.size);

  renderHud();

  switch (state.screen) {
    case 'start':
      renderOverlay('Rompe ladrillos', 'Pulsa Espacio para empezar');
      break;
    case 'paused':
      renderOverlay('Pausa', 'Pulsa P o Esc para continuar');
      break;
    case 'gameover':
      renderOverlay('Fin del juego', `Puntuación final: ${state.score}`, 'Pulsa Espacio para reiniciar');
      break;
    case 'win':
      renderOverlay('¡Ganaste!', `Puntuación final: ${state.score}`, 'Pulsa Espacio para reiniciar');
      break;
  }
}

// Capa semitransparente con un título y líneas de texto centradas
function renderOverlay(title, ...lines) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, HUD_HEIGHT, WIDTH, HEIGHT - HUD_HEIGHT);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const centerY = HEIGHT / 2;
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText(title, WIDTH / 2, centerY - 40);

  ctx.font = '22px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, WIDTH / 2, centerY + 20 + i * 34);
  });
}

function renderHud() {
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.textBaseline = 'middle';

  ctx.textAlign = 'left';
  ctx.fillText(`Puntos: ${state.score}`, 16, HUD_HEIGHT / 2);

  // Vidas: una bola por cada vida restante, alineadas a la derecha
  const lifeSize = BALL.size;
  const lifeGap = 6;
  const lifeY = (HUD_HEIGHT - lifeSize) / 2;
  let lifeX = WIDTH - 16 - lifeSize;
  for (let i = 0; i < state.lives; i++) {
    drawSprite(ctx, 'ball', lifeX, lifeY, lifeSize, lifeSize);
    lifeX -= lifeSize + lifeGap;
  }

  ctx.textAlign = 'right';
  ctx.fillText('Vidas:', lifeX + lifeSize, HUD_HEIGHT / 2);

  // Línea que separa el HUD del área de juego
  ctx.fillStyle = '#444';
  ctx.fillRect(0, HUD_HEIGHT - 1, WIDTH, 1);
}

function loop(time) {
  if (lastTime === null) lastTime = time;
  const dt = Math.min((time - lastTime) / 1000, MAX_DT);
  lastTime = time;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

loadSpritesheet(() => {
  buildBricks();
  attachBallToPaddle();
  requestAnimationFrame(loop);
});
