import React from 'react';

const P = {
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  sun: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  pin: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 7a3 3 0 100 6 3 3 0 000-6z',
  power: 'M12 3v9M6.4 6.4a8 8 0 1011.2 0',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z',
  thermo: 'M10 14V5a2 2 0 114 0v9a4 4 0 11-4 0z',
  scene: 'M4 5h16v14H4zM4 9h16M8 5l2 4M13 5l2 4',
  bell: 'M6 16v-5a6 6 0 1112 0v5l2 2H4zM10 21h4',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  hourglass: 'M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9',
  branch: 'M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9c0 6-12 3-12 6',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3',
  stop: 'M6 6h12v12H6z',
  toggle: 'M7 7h10a5 5 0 010 10H7A5 5 0 017 7zM7 10a2 2 0 100 4 2 2 0 000-4z',
  group: 'M4 4h7v7H4zM13 13h7v7h-7zM13 4h7v4h-7zM4 15h7v5H4z',
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  play: 'M7 4l13 8-13 8z',
  save: 'M5 3h12l4 4v14H5zM8 3v6h8M8 21v-7h8',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
  close: 'M6 6l12 12M18 6L6 18',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  sparkle: 'M12 2l2.2 6.3L21 10l-6.8 1.7L12 18l-2.2-6.3L3 10l6.8-1.7zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  back: 'M15 6l-6 6 6 6',
  cover: 'M4 4h16v16H4zM4 9h16M4 14h16',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 118 0v4',
  person: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  media: 'M3 5h18v12H3zM8 21h8',
  fan: 'M12 12a3 3 0 100 .1M12 9c0-4 3-6 5-5s0 5-5 5M15 12c4 0 6 3 5 5s-5 0-5-5M12 15c0 4-3 6-5 5s0-5 5-5M9 12c-4 0-6-3-5-5s5 0 5 5',
  dot: 'M12 8a4 4 0 100 8 4 4 0 000-8z',
  check: 'M5 12l5 5 9-10',
  warn: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  minus: 'M5 12h14',
  door: 'M5 21h14M7 21V3h10v18M14 12h.01',
  motion: 'M13 4a1.5 1.5 0 100 .1M10 21l2-6 3 3v3M12 15l-1-5 4 2 3-1M11 10l-4 2-1 4',
  plug: 'M9 3v5M15 3v5M6 8h12v4a6 6 0 01-12 0zM12 18v3',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
};

export default function Icon({ name, size = 18, className = '', stroke = 1.8 }) {
  return (
    <svg className={`ico ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] || P.dot} />
    </svg>
  );
}
