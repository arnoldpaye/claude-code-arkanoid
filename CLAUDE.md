# CLAUDE.md

Este archivo guía a Claude Code (claude.ai/code) al trabajar con el código de este repositorio.

## Idioma

Responder siempre al usuario en español en este proyecto.

## Proyecto

Juego de romper ladrillos (estilo Arkanoid) para navegador, hecho con **HTML, CSS y JavaScript puros, sin dependencias**. No hay paso de build, gestor de paquetes, linter ni runner de tests; no introducir ninguno salvo que se pida. El juego **todavía no está implementado**; solo existen los assets.

## Ejecución

Abrir con un servidor estático local (no con `file://`, porque el spritesheet se carga como imagen y se dibuja en un canvas), por ejemplo:

```
npx serve .        # o: python -m http.server
```

Las rutas de los assets son relativas a la raíz del repo (`assets/spritesheet-breakout.png`), así que el HTML de entrada debe estar en la raíz.

## Assets (`assets/`)

- `spritesheet.js` — script clásico (sin módulos ES) que expone globales:
  - `SPRITES` — rectángulos de origen para `paddle`, `ball` y `blocks.{gray,red,yellow,cyan,magenta,hotpink,green}`.
  - `EXPLOSION_FRAMES[color]` — animación de rotura de 4 frames por color de bloque; `EXPLOSION_DURATION = 150` (ms).
  - `loadSpritesheet(cb)` — carga el PNG una sola vez, lo copia a un canvas offscreen y encola callbacks hasta que esté listo. Iniciar el game loop desde su callback.
  - `drawSprite(ctx, name, x, y, w, h)` — `name` es `'paddle'`, `'ball'` o `'block_<color>'`.
  - `drawFrame(ctx, frame, x, y, w, h)` — dibuja un rectángulo de frame crudo (usado para los frames de explosión).
  - Ambas funciones de dibujo no hacen nada (sin error) antes de que cargue el spritesheet.
- `spritesheet-breakout.png` — sheet de 559×337 al que apuntan los rectángulos anteriores.
- `sounds/ball-bounce.mp3`, `sounds/break-sound.mp3`.

## Flujo de trabajo: desarrollo guiado por specs

Las funcionalidades se diseñan e implementan con dos skills del proyecto (`.claude/skills/`, replicadas en `.agents/skills/` para otros agentes; origen registrado en `skills-lock.json`):

- `/spec <descripción de la funcionalidad>` — hace preguntas aclaratorias y luego escribe `specs/NN-slug.md` (número secuencial con dos dígitos) a partir de `.claude/skills/spec/template.md`. No escribe código. Crea `specs/.spec-config.yml` si no existe.
- `/spec-impl <NN-slug | NN | slug>` — implementa una spec aprobada. Primero revisa la línea de estado de la spec, luego crea/cambia a la rama `spec-NN-slug` (automático si `AutoCreateBranch: true` en `specs/.spec-config.yml`, que es el valor por defecto) e implementa paso a paso.

Al implementar, seguir los pasos y la lista de archivos de la spec activa en vez de improvisar la estructura.
