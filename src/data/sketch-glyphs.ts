// Small line icons for the sketch scenes' panels, on a 20 × 20 canvas (decorative: the entry's
// name says what it is).
import type { Glyph } from './sketch-scenes.ts';

export const GLYPHS: Record<Glyph, string> = {
  search:
    'M9 4 C 12 4, 14 6, 14 9 C 14 12, 12 14, 9 14 C 6 14, 4 12, 4 9 C 4 6, 6 4, 9 4 Z M13 13 L17 17',
  click: 'M5 3 L5 15 L8 12 L11 17 L13 16 L10 11 L14 11 Z',
  scroll: 'M10 3 L10 17 M6 7 L10 3 L14 7 M6 13 L10 17 L14 13',
  gaze: 'M2 10 C 5 5, 15 5, 18 10 C 15 15, 5 15, 2 10 Z M10 8 C 11 8, 12 9, 12 10 C 12 11, 11 12, 10 12 C 9 12, 8 11, 8 10 C 8 9, 9 8, 10 8 Z',
  laptop: 'M5 4 L15 4 L15 12 L5 12 Z M2 15 L18 15',
  phone: 'M7 2 L13 2 L13 18 L7 18 Z M9 15 L11 15',
  camera: 'M3 6 L14 6 L14 14 L3 14 Z M14 9 L18 7 L18 13 L14 11',
  chip: 'M6 6 L14 6 L14 14 L6 14 Z M8 3 L8 6 M12 3 L12 6 M8 14 L8 17 M12 14 L12 17 M3 8 L6 8 M3 12 L6 12 M14 8 L17 8 M14 12 L17 12',
  sensor: 'M10 18 L10 8 M6 4 L14 4 L14 8 L6 8 Z M16 3 C 18 5, 18 7, 16 9',
  post: 'M3 4 L17 4 L17 16 L3 16 Z M6 8 L10 8 M6 12 L14 12',
};
