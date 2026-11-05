# SPEC 03 — Sonidos y sistema de niveles

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-11-05
> **Objetivo:** Añadir sonidos de rebote y de rotura de bloques, con silencio por tecla M, y una secuencia de 5 niveles con layouts distintos.

## Alcance

**Entra:**

- Sonido `assets/sounds/ball-bounce.mp3` al rebotar la pelota en la pala y en las paredes izquierda, derecha y superior.
- Sonido `assets/sounds/break-sound.mp3` al romper un bloque.
- Los sonidos se solapan: cada reproducción clona un `HTMLAudioElement` precargado.
- Tecla M para activar o silenciar el sonido, en cualquier pantalla.
- Indicador de silencio en el HUD. El silencio no se guarda: al recargar la página el sonido vuelve a estar activo.
- Si un sonido falla al cargar o reproducirse, el juego sigue sin errores visibles.
- Nuevo archivo `levels.js` en la raíz con 5 layouts definidos como rejillas de texto.
- Los puntos de un bloque dependen de su color, no de su fila.
- Nueva pantalla `levelclear` entre niveles: "¡Nivel N superado!", con paso al siguiente por Espacio o clic.
- Entre niveles se conservan puntos y vidas.
- "¡Ganaste!" aparece solo al superar el nivel 5.
- El HUD muestra "Nivel N" centrado.
- El reinicio desde `gameover` o `win` vuelve al nivel 1 con 0 puntos y 3 vidas.

**Fuera de alcance (para specs futuras):**

- Música de fondo.
- Control de volumen o volumen distinto por sonido.
- Persistencia del silencio o de cualquier otro dato (`localStorage`).
- Sonido al perder una vida, al cambiar de pantalla o al pasar de nivel.
- Bloques `gray` o de varios golpes.
- Cambios de velocidad de pelota o pala por nivel.
- Vidas extra al superar un nivel.
- Selector de nivel, editor de niveles o niveles generados por código.
- Récords.

## Modelo de datos

```js
// levels.js (nuevo, script clásico, se carga entre spritesheet.js y game.js)
const BRICK_CODES = {
  r: 'red',
  y: 'yellow',
  c: 'cyan',
  m: 'magenta',
  p: 'hotpink',
  g: 'green',
};
// '.' = hueco sin bloque

const LEVELS = [
  // Nivel 1 — rejilla completa (igual que SPEC 01), 60 bloques
  [
    'rrrrrrrrrr',
    'yyyyyyyyyy',
    'cccccccccc',
    'mmmmmmmmmm',
    'pppppppppp',
    'gggggggggg',
  ],
  // Nivel 2 — pirámide, 40 bloques
  [
    '....rr....',
    '...yyyy...',
    '..cccccc..',
    '.mmmmmmmm.',
    'pppppppppp',
    'gggggggggg',
  ],
  // Nivel 3 — damero, 30 bloques
  [
    'r.r.r.r.r.',
    '.y.y.y.y.y',
    'c.c.c.c.c.',
    '.m.m.m.m.m',
    'p.p.p.p.p.',
    '.g.g.g.g.g',
  ],
  // Nivel 4 — columnas dobles, 48 bloques
  [
    'rr..yy..cc',
    'rr..yy..cc',
    'mm..pp..gg',
    'mm..pp..gg',
    'rr..yy..cc',
    'rr..yy..cc',
    'mm..pp..gg',
    'mm..pp..gg',
  ],
  // Nivel 5 — marcos concéntricos, 52 bloques
  [
    'rrrrrrrrrr',
    'r........r',
    'r.yyyyyy.r',
    'r.y.cc.y.r',
    'r.y.cc.y.r',
    'r.yyyyyy.r',
    'r........r',
    'rrrrrrrrrr',
  ],
];
```

```js
// game.js: sustituye a ROWS
const BRICK_POINTS = {
  red: 60,
  yellow: 50,
  cyan: 40,
  magenta: 30,
  hotpink: 20,
  green: 10,
};

// game.js: audio
const SOUND_FILES = {
  bounce: 'assets/sounds/ball-bounce.mp3',
  break: 'assets/sounds/break-sound.mp3',
};
const sounds = { /* bounce, break: HTMLAudioElement precargados con new Audio(src) */ };

// Estado mutable: campos nuevos en `state`
const state = {
  // ...campos de SPEC 01 y SPEC 02 sin cambios
  screen: 'start',   // añade 'levelclear' a los valores posibles
  level: 1,          // 1..LEVELS.length; el layout activo es LEVELS[state.level - 1]
  muted: false,
};
```

Convenciones:

- Cada layout tiene exactamente `BRICK.cols` (10) caracteres por fila y como máximo 8 filas.
- La fila `r` y la columna `c` de un layout ocupan la misma posición que en SPEC 01: `x = BRICK_OFFSET_LEFT + c * (BRICK.w + BRICK.gap)`, `y = BRICK.offsetTop + r * (BRICK.h + BRICK.gap)`.
- Con 8 filas el último bloque termina en `y = 300`, lejos de la pala (`y = 560`).
- Un carácter que no es `.` ni una clave de `BRICK_CODES` no crea bloque y escribe un `console.warn` con nivel, fila y columna.
- `playSound(name)` no hace nada si `state.muted` es `true`. Si no, clona `sounds[name]` con `cloneNode()` y llama a `play()`. El rechazo de la promesa de `play()` se ignora.
- `state.muted` no se toca en `resetGame()` ni al cambiar de nivel.

Transiciones de `state.screen` que cambian respecto a SPEC 02:

- `playing` → nivel despejado y `state.explosions` vacío → si `state.level < LEVELS.length` → `levelclear`; si no → `win`.
- `levelclear` → Espacio/clic → `state.level + 1`, se construye el nuevo layout, se vacían las explosiones, la pala se centra, la pelota se pega a la pala → `serve`.
- `gameover` / `win` → Espacio/clic → `resetGame()`: `state.level = 1`, 0 puntos, 3 vidas → `serve`.
- La pausa (P/Esc) sigue funcionando solo entre `playing` y `paused`. En `levelclear` no hace nada.
- M alterna `state.muted` en cualquier pantalla, incluida `paused`.

Textos nuevos:

- HUD centrado: `Nivel N`. Con silencio activo: `Nivel N · Sin sonido`.
- Overlay `levelclear`: título `¡Nivel N superado!`, líneas `Puntos: X` y `Pulsa Espacio para continuar`.

## Plan de implementación

1. Crear `levels.js` con `BRICK_CODES` y `LEVELS` tal como están en el modelo de datos. Cargarlo en `index.html` entre `assets/spritesheet.js` y `game.js`. Prueba: en consola `LEVELS.length` vale `5` y el juego funciona igual que antes.
2. En `game.js`, sustituir `ROWS` por `BRICK_POINTS` y añadir `state.level = 1`. Reescribir `buildBricks()` para que lea `LEVELS[state.level - 1]` con `BRICK_CODES` y avise con `console.warn` de caracteres desconocidos. `resetGame()` pone `state.level = 1`. Prueba: el nivel 1 tiene los mismos 60 bloques y puntos que antes.
3. Dibujar `Nivel N` centrado en el HUD dentro de `renderHud()`. Prueba: el HUD muestra "Nivel 1" entre los puntos y las vidas.
4. Añadir la pantalla `levelclear`: cambiar la condición de victoria en `update()`, añadir el caso en `onAction()` que avanza de nivel y vuelve a `serve`, y su overlay en `render()`. Prueba: con un layout temporal de un solo bloque, despejar el nivel 1 muestra "¡Nivel 1 superado!" y Espacio carga la pirámide del nivel 2 con los mismos puntos y vidas.
5. Añadir `SOUND_FILES`, `sounds` y `playSound(name)`. Llamar a `playSound('break')` en `collideBallBricks()` al romper un bloque. Prueba: romper un bloque suena; romper varios seguidos solapa los sonidos.
6. Llamar a `playSound('bounce')` en `collideBallPaddle()` al rebotar y en `updateBall()` en cada rebote con pared izquierda, derecha o superior. Prueba: la pala y las tres paredes suenan; romper un bloque solo suena con `break`.
7. Añadir `state.muted`, la tecla M en el `keydown` (con `preventDefault` e ignorando `e.repeat`) y el texto `· Sin sonido` en el HUD. Prueba: M silencia y reactiva el sonido en juego, en pausa y en las pantallas de inicio y fin.

## Criterios de aceptación

- [ ] El juego carga sin errores en consola.
- [ ] Al rebotar en la pala suena `ball-bounce.mp3`.
- [ ] Al rebotar en las paredes izquierda, derecha y superior suena `ball-bounce.mp3`.
- [ ] Al romper un bloque suena `break-sound.mp3` y no suena `ball-bounce.mp3`.
- [ ] Dos sonidos muy seguidos se oyen los dos; el segundo no corta al primero.
- [ ] Perder la pelota por abajo no reproduce ningún sonido.
- [ ] Pulsar M silencia todos los sonidos y el HUD muestra "Nivel N · Sin sonido".
- [ ] Pulsar M otra vez reactiva el sonido y el indicador desaparece.
- [ ] M funciona en las pantallas `start`, `serve`, `playing`, `paused`, `levelclear`, `gameover` y `win`.
- [ ] Reiniciar la partida no cambia el estado de silencio.
- [ ] Recargar la página deja el sonido activo.
- [ ] Renombrar temporalmente un `.mp3` no rompe el juego ni deja errores no capturados en consola.
- [ ] El nivel 1 tiene 60 bloques en 6 filas: red, yellow, cyan, magenta, hotpink, green.
- [ ] Los niveles 2, 3, 4 y 5 tienen 40, 30, 48 y 52 bloques con los layouts de esta spec.
- [ ] Cada bloque suma según su color: red 60, yellow 50, cyan 40, magenta 30, hotpink 20, green 10.
- [ ] El HUD muestra "Nivel N" centrado en todo momento.
- [ ] Despejar los niveles 1 a 4 muestra "¡Nivel N superado!" solo después de terminar la última explosión.
- [ ] En `levelclear`, Espacio o clic carga el siguiente nivel con la pala centrada y la pelota pegada a ella.
- [ ] Al pasar de nivel se conservan los puntos y las vidas.
- [ ] En `levelclear`, P o Esc no hace nada.
- [ ] "¡Ganaste!" aparece solo al despejar el nivel 5.
- [ ] Desde `gameover` o `win`, Espacio o clic reinicia en el nivel 1 con 0 puntos y 3 vidas.

## Decisiones

- **Sí:** una sola spec para sonidos y niveles, por decisión del usuario. Se propuso dividirla en dos y se descartó.
- **Sí:** `ball-bounce.mp3` en pala y paredes. Da feedback de cada rebote.
- **No:** `ball-bounce.mp3` al romper un bloque. Ahí ya suena `break-sound.mp3`; los dos juntos ensucian el sonido.
- **Sí:** clonar el `HTMLAudioElement` en cada reproducción. Los sonidos se solapan sin cortarse y no hace falta código extra.
- **No:** reiniciar el mismo `Audio` con `currentTime = 0`. Un rebote cortaría el anterior.
- **No:** Web Audio API. Más código para una ganancia de latencia que este juego no necesita.
- **Sí:** el audio vive en `game.js`. Son pocas líneas y no justifican un archivo.
- **Sí:** silencio con M, sin persistir. Cubre la necesidad sin introducir `localStorage`.
- **No:** guardar el silencio en `localStorage`. La persistencia va en otra spec si llega.
- **Sí:** volumen por defecto del navegador. No se pidió control de volumen.
- **Sí:** no esperar a que carguen los sonidos para arrancar. El juego solo depende del spritesheet; un sonido que no carga solo se pierde.
- **Sí:** 5 niveles como rejillas de texto en `levels.js`. Se leen y editan a simple vista y separan datos de lógica.
- **No:** niveles generados por código. Menos legibles y más difíciles de ajustar.
- **Sí:** los layouts de los niveles 2 a 5 los propone esta spec. El usuario los revisa al aprobarla.
- **Sí:** puntos por color con los mismos valores de SPEC 01. El nivel 1 puntúa igual que antes y los layouts no dependen de la fila.
- **No:** puntos por fila. Obligaría a que cada layout tenga 6 filas con colores fijos.
- **Sí:** pantalla `levelclear` con Espacio/clic. El jugador decide cuándo empieza el siguiente nivel.
- **No:** paso automático al siguiente nivel. El cambio sería brusco y sin aviso.
- **Sí:** solo cambia el layout entre niveles. Velocidades, vidas extra y bloques `gray` quedan fuera.
- **Sí:** centrar la pala al empezar cada nivel, igual que en `resetGame()`.
- **Sí:** el reinicio vuelve al nivel 1 con 0 puntos y 3 vidas, como en SPEC 01.
- **Sí:** esta spec sustituye los criterios "El juego no reproduce ningún sonido" de SPEC 01 y SPEC 02, y "Al romper todos los bloques aparece ¡Ganaste!" de SPEC 01. No se editan esas specs.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El navegador bloquea `play()` antes de una interacción del usuario | Los sonidos solo suenan después de Espacio o clic. La promesa rechazada de `play()` se ignora. |
| Muchos clones de `Audio` simultáneos | Como máximo un bloque por frame y pocos rebotes por segundo. Los clones terminados los libera el recolector. |
| Un `.mp3` falta o no carga | `playSound` ignora el error y el juego sigue sin sonido. |
| Un layout con un carácter erróneo o una fila de longitud distinta | `buildBricks()` ignora el carácter y escribe un `console.warn` con nivel, fila y columna. |
| Probar los niveles 4 y 5 lleva mucho tiempo | Durante el desarrollo se puede reducir temporalmente un layout a un bloque; no se deja así en el commit. |
| Explosiones del nivel anterior aparecen en el siguiente | El paso de nivel vacía `state.explosions`, igual que `resetGame()`. |

## Lo que **no** está en esta spec

- Música, control de volumen o persistencia del silencio.
- Sonidos de vida perdida, cambio de pantalla o paso de nivel.
- Bloques `gray` o de varios golpes.
- Dificultad por nivel (velocidad, vidas extra).
- Selector o editor de niveles.
- Récords o cualquier persistencia.

Cada uno de estos, si llega, va en su propia spec.
