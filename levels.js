// Niveles del juego (script clásico, se carga entre spritesheet.js y game.js).
// Cada layout es una rejilla de BRICK.cols (10) caracteres por fila y como máximo 8 filas.
// Cada letra es un color de bloque; '.' es un hueco sin bloque.
const BRICK_CODES = {
  r: 'red',
  y: 'yellow',
  c: 'cyan',
  m: 'magenta',
  p: 'hotpink',
  g: 'green',
};

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
