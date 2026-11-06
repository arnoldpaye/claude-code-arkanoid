// Constantes
const WIDTH = 800;
const HEIGHT = 600;
const HUD_HEIGHT = 40;          // franja superior reservada al HUD
const MAX_DT = 1 / 30;          // límite de dt en segundos

const PADDLE = { w: 60, h: 14, y: 560, speed: 480 };    // speed en px/s
const BALL = { size: 16, speed: 360 };                     // speed en px/s, constante
const MAX_BOUNCE_ANGLE = Math.PI / 3;                      // 60°

const BRICK = { w: 75, h: 30, gap: 4, cols: 10, offsetTop: 80 };
// offsetLeft centra la rejilla en el canvas
const BRICK_OFFSET_LEFT = (WIDTH - (BRICK.cols * BRICK.w + (BRICK.cols - 1) * BRICK.gap)) / 2;

// Puntos por color de bloque (los layouts están en levels.js)
const BRICK_POINTS = {
  red: 60,
  yellow: 50,
  cyan: 40,
  magenta: 30,
  hotpink: 20,
  green: 10,
};

const START_LIVES = 3;

const EXPLOSION_TOTAL = EXPLOSION_DURATION * 4;   // 600 ms: 4 frames de EXPLOSION_DURATION

// Estado mutable
const state = {
  screen: 'start',              // 'start' | 'serve' | 'playing' | 'paused' | 'levelclear' | 'gameover' | 'win'
  score: 0,
  lives: START_LIVES,
  level: 1,                     // 1..LEVELS.length; layout activo: LEVELS[state.level - 1]
  muted: false,                 // tecla M; no se reinicia ni se guarda entre sesiones
  paddle: { x: 340 },           // x = borde izquierdo
  ball: { x: 0, y: 0, vx: 0, vy: 0 },   // x,y = esquina superior izquierda
  bricks: [],                   // { x, y, color, points, alive }
  explosions: [],               // { x, y, color, elapsed } — elapsed en ms
  input: { left: false, right: false, mouseX: null },
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let lastTime = null;

// Audio: cada sonido se precarga una vez y cada reproducción usa un clon,
// así varios sonidos seguidos se solapan sin cortarse.
const SOUND_FILES = {
  bounce: 'assets/sounds/ball-bounce.mp3',
  break: 'assets/sounds/break-sound.mp3',
};

const sounds = {};
for (const [name, src] of Object.entries(SOUND_FILES)) {
  sounds[name] = new Audio(src);
  sounds[name].preload = 'auto';
}

// Un fallo de carga o de reproducción se ignora: el juego sigue sin ese sonido
function playSound(name) {
  if (state.muted) return;
  const sound = sounds[name].cloneNode();
  const playing = sound.play();
  if (playing) playing.catch(() => {});
}

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
    case 'levelclear':
      nextLevel();
      break;
    case 'gameover':
    case 'win':
      resetGame();
      break;
  }
}

// Paso al siguiente nivel: se conservan puntos y vidas
function nextLevel() {
  state.level += 1;
  buildBricks();
  state.explosions = [];
  state.paddle.x = (WIDTH - PADDLE.w) / 2;
  attachBallToPaddle();
  state.screen = 'serve';
}

// P o Esc: playing ⇄ paused
function togglePause() {
  if (state.screen === 'playing') state.screen = 'paused';
  else if (state.screen === 'paused') state.screen = 'playing';
}

// Reinicio completo: nivel 1, 3 vidas, 0 puntos, pelota en la pala
function resetGame() {
  state.score = 0;
  state.lives = START_LIVES;
  state.level = 1;
  state.paddle.x = (WIDTH - PADDLE.w) / 2;
  buildBricks();
  state.explosions = [];
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
    return;
  }
  // M: activa o silencia el sonido en cualquier pantalla
  if (e.code === 'KeyM') {
    e.preventDefault();
    if (!e.repeat) state.muted = !state.muted;
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
  playSound('bounce');
}

// Bloques: se construyen desde el layout del nivel actual.
// '.' es un hueco; un carácter desconocido no crea bloque y avisa por consola.
function buildBricks() {
  const bricks = [];
  const layout = LEVELS[state.level - 1];
  layout.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const code = row[c];
      if (code === '.') continue;
      const color = BRICK_CODES[code];
      if (!color) {
        console.warn(`Carácter de bloque desconocido '${code}' en nivel ${state.level}, fila ${r}, columna ${c}`);
        continue;
      }
      bricks.push({
        x: BRICK_OFFSET_LEFT + c * (BRICK.w + BRICK.gap),
        y: BRICK.offsetTop + r * (BRICK.h + BRICK.gap),
        color,
        points: BRICK_POINTS[color],
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
    state.explosions.push({ x: brick.x, y: brick.y, color: brick.color, elapsed: 0 });
    playSound('break');
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
    playSound('bounce');
  }
  // Pared derecha
  if (ball.x + BALL.size > WIDTH) {
    ball.x = 2 * (WIDTH - BALL.size) - ball.x;
    ball.vx = -Math.abs(ball.vx);
    playSound('bounce');
  }
  // Pared superior (borde inferior de la franja del HUD)
  if (ball.y < HUD_HEIGHT) {
    ball.y = 2 * HUD_HEIGHT - ball.y;
    ball.vy = Math.abs(ball.vy);
    playSound('bounce');
  }

  collideBallPaddle();
  collideBallBricks();

  // Sale por abajo: pierde una vida
  if (ball.y > HEIGHT) {
    state.lives -= 1;
    state.screen = state.lives > 0 ? 'serve' : 'gameover';
  }
}

// Nivel despejado: no queda ningún bloque vivo (las explosiones no cuentan)
function isLevelCleared() {
  return state.bricks.every((b) => !b.alive);
}

// Avanza las explosiones y elimina las terminadas (antes de dibujar, así el frame nunca llega a 4)
function updateExplosions(dt) {
  for (const explosion of state.explosions) explosion.elapsed += dt * 1000;
  state.explosions = state.explosions.filter((e) => e.elapsed < EXPLOSION_TOTAL);
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
  } else if (screen === 'playing' && !isLevelCleared()) {
    // Con el nivel despejado la pelota queda parada mientras termina la última explosión
    updateBall(dt);
  }

  // Las explosiones avanzan en juego y en saque; en pausa y fin de juego se congelan
  if (screen === 'playing' || screen === 'serve') {
    updateExplosions(dt);
  }

  // Nivel despejado y sin explosiones: siguiente nivel o victoria tras el último
  if (screen === 'playing' && isLevelCleared() && state.explosions.length === 0) {
    state.screen = state.level < LEVELS.length ? 'levelclear' : 'win';
  }
}

function render() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const brick of state.bricks) {
    if (brick.alive) drawSprite(ctx, 'block_' + brick.color, brick.x, brick.y, BRICK.w, BRICK.h);
  }

  renderExplosions();

  drawSprite(ctx, 'paddle', state.paddle.x, PADDLE.y, PADDLE.w, PADDLE.h);
  // Con el nivel despejado la pelota se oculta
  if (!isLevelCleared()) {
    drawSprite(ctx, 'ball', state.ball.x, state.ball.y, BALL.size, BALL.size);
  }

  renderHud();

  switch (state.screen) {
    case 'start':
      renderOverlay('Rompe ladrillos', 'Pulsa Espacio para empezar');
      break;
    case 'paused':
      renderOverlay('Pausa', 'Pulsa P o Esc para continuar');
      break;
    case 'levelclear':
      renderOverlay(`¡Nivel ${state.level} superado!`, `Puntos: ${state.score}`, 'Pulsa Espacio para continuar');
      break;
    case 'gameover':
      renderOverlay('Fin del juego', `Puntuación final: ${state.score}`, 'Pulsa Espacio para reiniciar');
      break;
    case 'win':
      renderOverlay('¡Ganaste!', `Puntuación final: ${state.score}`, 'Pulsa Espacio para reiniciar');
      break;
  }
}

// Frame actual (0..3) de cada explosión, al tamaño del bloque roto
function renderExplosions() {
  for (const explosion of state.explosions) {
    const frame = Math.floor(explosion.elapsed / EXPLOSION_DURATION);
    drawFrame(ctx, EXPLOSION_FRAMES[explosion.color][frame], explosion.x, explosion.y, BRICK.w, BRICK.h);
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

  // Nivel actual, centrado; con silencio activo se añade el indicador
  ctx.textAlign = 'center';
  const levelText = state.muted ? `Nivel ${state.level} · Sin sonido` : `Nivel ${state.level}`;
  ctx.fillText(levelText, WIDTH / 2, HUD_HEIGHT / 2);

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
