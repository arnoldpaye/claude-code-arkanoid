# SPEC 01 — MVP jugable de Arkanoid

> **Estado:** Borrador
> **Depende de:** Ninguna
> **Fecha:** 2026-11-04
> **Objetivo:** Crear un MVP jugable en navegador con pala, pelota, un nivel de bloques, vidas, puntuación y pausa.

## Alcance

**Entra:**

- `index.html`, `style.css` y `game.js` en la raíz del repo, sin dependencias ni build.
- Canvas lógico fijo de 800×600 centrado en la página.
- Pala controlada con teclado (←/→ y A/D) y con ratón (sigue la X del cursor).
- Pelota que arranca pegada a la pala y se lanza con Espacio o clic.
- Rebote en paredes izquierda, derecha y superior.
- Rebote en la pala con ángulo según el punto de impacto (hasta ±60° respecto a la vertical).
- Un único nivel de 6 filas × 10 columnas de bloques, todos de un golpe.
- Puntuación por fila: filas superiores valen más.
- 3 vidas. Perder la pelota por abajo resta una vida.
- HUD dibujado en el canvas con puntos y vidas.
- Pausa y reanudación con P o Esc.
- Pantallas de inicio, fin del juego y victoria, con reinicio por Espacio o clic.
- Textos del juego en español.

**Fuera de alcance (para specs futuras):**

- Varios niveles o layouts distintos.
- Power-ups.
- Bloques duros (`gray`) que requieren varios golpes.
- Aceleración progresiva de la pelota.
- Canvas responsive o escalado a la ventana.
- Controles táctiles / soporte móvil.
- Cualquier tipo de audio (sonidos, música, mute).
- Animaciones de explosión al romper bloques.
- Persistencia (récords, guardado en `localStorage`).
- Botones HTML o menús DOM.

## Modelo de datos

```js
// Constantes (game.js)
const WIDTH = 800;
const HEIGHT = 600;
const HUD_HEIGHT = 40;          // franja superior reservada al HUD

const PADDLE = { w: 120, h: 14, y: 560, speed: 480 };    // speed en px/s
const BALL = { size: 16, speed: 360 };                     // speed en px/s, constante
const MAX_BOUNCE_ANGLE = Math.PI / 3;                      // 60°

const BRICK = { w: 72, h: 24, gap: 4, cols: 10, offsetTop: 80 };
// offsetLeft se calcula para centrar: (WIDTH - (cols * w + (cols - 1) * gap)) / 2

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
  bricks: [ /* { x, y, color, points, alive } */ ],
  input: { left: false, right: false, mouseX: null },
};
```

Convenciones:

- Coordenadas con origen arriba a la izquierda, en píxeles del canvas lógico.
- Velocidades en px/s. El movimiento se multiplica por `dt` (segundos).
- `dt` se limita a un máximo de `1/30` s para evitar que la pelota atraviese bloques tras cambiar de pestaña.
- La pala se dibuja con `drawSprite(ctx, 'paddle', ...)`, la pelota con `'ball'` y cada bloque con `'block_<color>'`.

Transiciones de `state.screen`:

- `start` → Espacio/clic → `serve`.
- `serve` → Espacio/clic → `playing` (la pelota sale hacia arriba).
- `playing` → pelota sale por abajo → `lives - 1`; si `lives > 0` → `serve`, si no → `gameover`.
- `playing` → último bloque roto → `win`.
- `playing` ⇄ `paused` con P o Esc.
- `gameover` / `win` → Espacio/clic → reinicio completo → `serve`.

## Plan de implementación

1. Crear `index.html` con un `<canvas width="800" height="600">`, `style.css` que lo centra sobre fondo oscuro, y `game.js` vacío. Cargar `assets/spritesheet.js` antes que `game.js`. Prueba manual: abrir con servidor estático y ver el canvas centrado sin errores en consola.
2. En `game.js`, llamar a `loadSpritesheet` e iniciar el bucle con `requestAnimationFrame` y cálculo de `dt` limitado. Dibujar el fondo. Prueba: el bucle corre sin errores.
3. Añadir la pala: entrada por teclado (←/→, A/D) y ratón, límites del canvas, dibujo con sprite. Prueba: la pala se mueve con ambos controles y no sale del canvas.
4. Añadir la pelota en estado `serve` pegada a la pala, lanzamiento con Espacio/clic y rebotes en paredes. Si cae por abajo, vuelve a `serve`. Prueba: lanzar y verla rebotar en paredes.
5. Añadir colisión pelota–pala con ángulo según el punto de impacto. Prueba: golpear con el centro sale vertical; con los bordes sale inclinada.
6. Generar la rejilla de bloques desde `ROWS` y `BRICK`, dibujarla y añadir la colisión pelota–bloque (máximo un bloque por frame, rebote por el eje de menor penetración). Prueba: los bloques desaparecen al golpearlos.
7. Añadir puntuación, vidas y HUD ("Puntos: N", "Vidas: N"). Prueba: romper un bloque rojo suma 60; perder la pelota resta una vida.
8. Añadir las pantallas `start`, `gameover` y `win` con sus textos y el reinicio. Prueba: recorrer el flujo completo inicio → derrota → reinicio.
9. Añadir la pausa con P/Esc y el texto "Pausa". Prueba: en pausa nada se mueve; al reanudar sigue igual.

## Criterios de aceptación

- [ ] Abrir `index.html` desde un servidor estático carga el juego sin errores en consola.
- [ ] La pantalla inicial muestra "Pulsa Espacio para empezar".
- [ ] ←/→ y A/D mueven la pala; mover el ratón sobre el canvas también la mueve.
- [ ] La pala nunca sale de los límites del canvas.
- [ ] La pelota queda pegada a la pala hasta pulsar Espacio o hacer clic.
- [ ] La pelota rebota en las paredes izquierda, derecha y superior.
- [ ] Golpear la pelota con el centro de la pala la devuelve casi vertical; con un borde, la devuelve inclinada hacia ese lado.
- [ ] La velocidad de la pelota es la misma durante toda la partida.
- [ ] Al empezar hay 60 bloques en 6 filas de colores: red, yellow, cyan, magenta, hotpink, green.
- [ ] Cada bloque desaparece al primer golpe y suma 60, 50, 40, 30, 20 o 10 puntos según su fila.
- [ ] El HUD muestra los puntos y las vidas actuales en todo momento.
- [ ] Perder la pelota resta una vida y vuelve a pegarla a la pala.
- [ ] Al perder la tercera vida aparece "Fin del juego" con la puntuación final.
- [ ] Al romper todos los bloques aparece "¡Ganaste!" con la puntuación final.
- [ ] En las pantallas de fin y victoria, Espacio o clic reinicia con 3 vidas, 0 puntos y 60 bloques.
- [ ] P o Esc pausa el juego, muestra "Pausa" y congela todo; pulsarlo otra vez lo reanuda.
- [ ] Un bloque roto desaparece al instante, sin animación.
- [ ] El juego no reproduce ningún sonido.

## Decisiones

- **Sí:** tres archivos (`index.html`, `style.css`, `game.js`) como scripts clásicos. Suficiente para un MVP y compatible con `spritesheet.js`, que expone globales.
- **No:** varios scripts en `src/`. Modularidad prematura para este tamaño.
- **No:** módulos ES. Obligarían a adaptar `spritesheet.js`.
- **Sí:** canvas fijo de 800×600. Simplifica colisiones y layout.
- **No:** canvas responsive. Queda para otra spec.
- **Sí:** movimiento con delta-time en px/s y `dt` limitado. Velocidad igual con cualquier tasa de refresco.
- **Sí:** velocidad de pelota constante. La aceleración progresiva queda fuera.
- **Sí:** ángulo de rebote según el punto de impacto en la pala, máximo ±60°. Da control al jugador.
- **No:** reflexión simple en la pala. Hace el juego predecible.
- **Sí:** 6×10 bloques de un golpe con puntos por fila (60 a 10).
- **No:** bloques `gray` duros. Añaden reglas; van en otra spec.
- **Sí:** HUD dibujado en el canvas y pausa con P/Esc.
- **No:** HUD o botones en el DOM. Todo vive en el canvas.
- **Sí:** flujo por Espacio/clic en todas las pantallas.
- **No:** animaciones de explosión. El bloque desaparece al instante; `EXPLOSION_FRAMES` y `drawFrame` quedan sin usar.
- **No:** audio de ningún tipo. El MVP no lo necesita; los `.mp3` de `assets/sounds/` quedan sin usar.
- **Sí:** textos del juego y spec en español.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La pelota atraviesa bloques con `dt` grande (pestaña en segundo plano) | `dt` limitado a `1/30` s. |
| La pelota golpea dos bloques en el mismo frame y rebota mal | Se procesa como máximo una colisión con bloque por frame. |
| Abrir con `file://` falla al cargar el spritesheet | Documentado en `CLAUDE.md`: usar servidor estático. |
| La pelota queda atrapada en un ángulo casi horizontal | El rebote en la pala fija el ángulo a ±60° como máximo respecto a la vertical. |

## Lo que **no** está en esta spec

- Varios niveles.
- Power-ups.
- Bloques duros.
- Aceleración de la pelota.
- Canvas responsive y soporte táctil.
- Audio (sonidos, música, mute).
- Animaciones de explosión.
- Récords o cualquier persistencia.

Cada uno de estos, si llega, va en su propia spec.
