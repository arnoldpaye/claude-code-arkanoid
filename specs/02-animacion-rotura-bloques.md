# SPEC 02 — Animación de rotura de bloques

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-05
> **Objetivo:** Reproducir la animación de explosión de 4 frames del spritesheet en el lugar de cada bloque que se rompe.

## Alcance

**Entra:**

- Al romper un bloque se crea una explosión en su posición y con su color.
- La explosión usa `EXPLOSION_FRAMES[color]` y se dibuja con `drawFrame` al tamaño del bloque (`BRICK.w` × `BRICK.h`).
- Cada frame dura `EXPLOSION_DURATION` (150 ms); la animación completa dura 600 ms.
- Varias explosiones pueden estar activas a la vez.
- Las explosiones avanzan con el `dt` del juego en `playing` y `serve`.
- Las explosiones se congelan en `paused` y en `gameover`.
- `resetGame()` borra todas las explosiones activas.
- Al romper el último bloque, la pelota se detiene y se oculta; la pantalla pasa a `win` cuando termina la última explosión.

**Fuera de alcance (para specs futuras):**

- Sonido de rotura (`break-sound.mp3`) o cualquier otro audio.
- Partículas, sacudida de pantalla u otros efectos visuales.
- Animaciones para bloques `gray` o bloques de varios golpes.
- Animaciones de la pala, la pelota o al perder una vida.
- Cambios en la puntuación, las colisiones o el layout de bloques.

## Modelo de datos

```js
// Constante nueva (game.js), derivada de spritesheet.js
const EXPLOSION_TOTAL = EXPLOSION_DURATION * 4;   // 600 ms

// Estado mutable: campo nuevo en `state`
const state = {
  // ...campos de SPEC 01 sin cambios
  explosions: [ /* { x, y, color, elapsed } */ ],
};
```

Convenciones:

- `x`, `y` son la esquina superior izquierda del bloque roto, en píxeles del canvas lógico.
- `color` es el color del bloque (`'red'`, `'yellow'`, …) y la clave de `EXPLOSION_FRAMES`.
- `elapsed` está en milisegundos y empieza en `0`. Se incrementa con `dt * 1000`.
- Frame a dibujar: `Math.floor(elapsed / EXPLOSION_DURATION)`, de `0` a `3`.
- Una explosión se elimina del array cuando `elapsed >= EXPLOSION_TOTAL`.
- El bloque roto sigue con `alive = false` igual que en SPEC 01. Las colisiones y el conteo de bloques vivos no miran `state.explosions`.
- "Nivel despejado" = todos los bloques con `alive = false`. En ese estado, dentro de `playing`, la pelota no se actualiza ni se dibuja.

Transiciones de `state.screen` que cambian respecto a SPEC 01:

- `playing` → último bloque roto → (pelota parada y oculta, sigue en `playing`) → `state.explosions` vacío → `win`.
- La pausa sigue funcionando durante esa espera y congela la explosión final.

## Plan de implementación

1. Añadir `EXPLOSION_TOTAL` y `state.explosions = []` en `game.js`. Vaciar `state.explosions` en `resetGame()`. Prueba: el juego funciona igual que antes, sin errores en consola.
2. En `collideBallBricks()`, al romper un bloque, añadir `{ x, y, color, elapsed: 0 }` a `state.explosions`. Crear `updateExplosions(dt)` que incrementa `elapsed` y elimina las terminadas. Llamarla en `update()` solo cuando la pantalla es `playing` o `serve`. Prueba: con `console.log` temporal, el array crece al romper y se vacía a los 600 ms.
3. Crear `renderExplosions()` que dibuja el frame actual de cada explosión con `drawFrame(ctx, EXPLOSION_FRAMES[color][i], x, y, BRICK.w, BRICK.h)`. Llamarla en `render()` justo después de los bloques y antes de la pala. Prueba: al romper un bloque se ve la animación de 4 frames en su lugar.
4. Cambiar la victoria: quitar el cambio a `win` de `collideBallBricks()`. En `update()`, en `playing`, si el nivel está despejado no llamar a `updateBall()`; si además `state.explosions` está vacío, pasar a `win`. En `render()`, no dibujar la pelota si el nivel está despejado. Prueba: al romper el último bloque la pelota desaparece, se ve su explosión y luego aparece "¡Ganaste!".

## Criterios de aceptación

- [ ] Romper un bloque muestra en su posición la animación de 4 frames del color de ese bloque.
- [ ] La animación se dibuja con el tamaño del bloque (72×24).
- [ ] Cada frame dura 150 ms y la animación desaparece a los 600 ms.
- [ ] Romper varios bloques seguidos muestra varias explosiones a la vez, cada una con su propio avance.
- [ ] Pausar con P/Esc congela las explosiones; al reanudar continúan desde el mismo frame.
- [ ] Perder la pelota justo después de romper un bloque deja que su explosión termine en la pantalla `serve`.
- [ ] Reiniciar desde `gameover` o `win` empieza sin explosiones visibles.
- [ ] Al romper el último bloque, la pelota se detiene y deja de verse.
- [ ] "¡Ganaste!" aparece solo cuando termina la explosión del último bloque.
- [ ] Durante la explosión del último bloque no se puede perder una vida.
- [ ] La puntuación de cada bloque se suma al romperlo, no al terminar su animación.
- [ ] El juego no reproduce ningún sonido.
- [ ] El juego carga sin errores en consola.

## Decisiones

- **Sí:** 150 ms por frame (600 ms en total). A 60 fps cada sprite se ve unos 9 frames de pantalla; con 150 ms en total sería un parpadeo.
- **No:** interpretar `EXPLOSION_DURATION` como duración total. Demasiado rápida para apreciarse.
- **Sí:** las explosiones avanzan con el `dt` del juego. Así se congelan en pausa, coherente con SPEC 01.
- **No:** reloj real (`performance.now()`). Seguiría animando en pausa.
- **Sí:** avanzar en `playing` y `serve`. Una explosión no se queda a medias al perder una vida.
- **Sí:** `state.explosions` como array aparte. Separa el estado de colisión (`alive`) del de animación.
- **No:** guardar el avance en cada bloque (`brick.explodeElapsed`). Mezcla responsabilidades.
- **Sí:** esperar a la última explosión antes de `win`, sin pantalla nueva. Se reutiliza `playing` con la pelota parada.
- **Sí:** ocultar la pelota en esa espera. Evita perder una vida en esos 600 ms y deja claro que el nivel terminó.
- **No:** pasar a `win` al instante. El overlay taparía la explosión del último bloque.
- **No:** sonido de rotura. El audio va en su propia spec junto al de rebote.
- **Sí:** esta spec sustituye el criterio de SPEC 01 "Un bloque roto desaparece al instante, sin animación". No se edita SPEC 01.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `elapsed` llega justo a 600 y el índice de frame sale `4` (fuera del array) | La explosión se elimina en `updateExplosions` antes de dibujar cuando `elapsed >= EXPLOSION_TOTAL`. |
| El jugador pausa durante la explosión final y la victoria nunca llega | La pausa solo congela; al reanudar la explosión termina y se pasa a `win`. |
| Explosiones de la partida anterior aparecen tras reiniciar | `resetGame()` vacía `state.explosions`. |

## Lo que **no** está en esta spec

- Sonido de rotura o cualquier audio.
- Partículas, sacudida de pantalla u otros efectos.
- Bloques `gray` o de varios golpes.
- Animaciones de pala, pelota o pérdida de vida.

Cada uno de estos, si llega, va en su propia spec.
