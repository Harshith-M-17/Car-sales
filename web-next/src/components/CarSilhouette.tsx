import { cn } from './ui';

/** Side-profile outlines on a 120x48 grid (front faces right). Mirrors the demo-photo renderer. */
const arch = (cx: number, r: number) => `L${cx + r} 38 A${r} ${r} 0 0 0 ${cx - r} 38`;
const small = `${arch(92, 9)} ${arch(28, 9)}`;
const big = `${arch(92, 10)} ${arch(28, 10)}`;

const SHAPES: Record<string, { body: string; windows: string; wheels: [number, number]; r: number }> = {
  hatchback: {
    body: `M16 35 C16 30 17 26 19 22 L25 13 C27 11 30 10 34 10 L66 10 C71 10 74 11 77 14 L88 24 L100 26 C105 27 107 29 107 33 L107 35 C107 37 106 38 104 38 ${arch(88, 9)} ${arch(34, 9)} L19 38 C17 38 16 37 16 35 Z`,
    windows: 'M22 22 L27 14 C29 12.5 31 12 34 12 L50 12 L50 22 Z M53 12 L66 12 C70 12 72.5 13 75 15.5 L82 22 L53 22 Z',
    wheels: [34, 88],
    r: 7.5,
  },
  sedan: {
    body: `M6 35 C6 30 8 27 14 26 L30 24 L42 14 C45 12 48 11 53 11 L75 11 C80 11 83 12 86 15 L96 24 L108 26 C113 27 115 29 115 33 L115 35 C115 37 114 38 112 38 ${small} L9 38 C7 38 6 37 6 35 Z`,
    windows: 'M36 23 L45 15 C47 13.5 49 13 53 13 L62 13 L62 23 Z M65 13 L75 13 C79 13 81.5 14 84 16.5 L91 23 L65 23 Z',
    wheels: [28, 92],
    r: 7.5,
  },
  suv: {
    body: `M6 34 C6 28 7 24 12 23 L26 21 L36 9 C38 7 40 6 44 6 L88 6 C92 6 94 7 96 10 L104 21 L110 22.5 C114 23.5 115 26 115 30 L115 35 C115 37 114 38 112 38 ${big} L9 38 C7 38 6 37 6 35 Z`,
    windows: 'M30 20 L38 10 C39.5 8.5 41 8 44 8 L64 8 L64 20 Z M67 8 L88 8 C91 8 92.5 9 94 11 L101 20 L67 20 Z',
    wheels: [28, 92],
    r: 8.5,
  },
  muv: {
    body: `M5 34 C5 27 6 22 9 18 L17 9 C19 7 21 6 25 6 L86 6 C90 6 92.5 7 94.5 10 L104 21 L110 22.5 C114 23.5 115 26 115 30 L115 35 C115 37 114 38 112 38 ${big} L8 38 C6 38 5 37 5 35 Z`,
    windows: 'M11 19 L19 9.5 C20.5 8.5 22 8 25 8 L44 8 L44 19 Z M47 8 L66 8 L66 19 L47 19 Z M69 8 L86 8 C89 8 91 9 92.5 11 L100 19 L69 19 Z',
    wheels: [28, 92],
    r: 8.5,
  },
  coupe: {
    body: `M6 35 C6 31 8 28 14 27 L34 25 L48 15 C52 13 56 12 62 12 L74 12 C80 12 84 14 88 18 L96 25 L108 27 C113 28 115 30 115 33 L115 35 C115 37 114 38 112 38 ${small} L9 38 C7 38 6 37 6 35 Z`,
    windows: 'M42 24 L51 17 C54 15 57 14 62 14 L68 14 L68 24 Z M71 14 L74 14 C79 14 82 15.5 85.5 19 L90 24 L71 24 Z',
    wheels: [28, 92],
    r: 7.5,
  },
  convertible: {
    body: `M6 35 C6 31 8 28 14 27 C30 25.5 60 25 78 25.2 L108 27 C113 28 115 30 115 33 L115 35 C115 37 114 38 112 38 ${small} L9 38 C7 38 6 37 6 35 Z`,
    windows: 'M77.5 25.3 L82.8 18.2 C83.2 17.7 84 17.7 84.3 18.2 L80.6 25.4 Z',
    wheels: [28, 92],
    r: 7.5,
  },
  pickup: {
    body: `M5 35 L5 22 C5 20.5 6 20 7.5 20 L58 20 L60 9 C60.5 7 62 6 64 6 L86 6 C90 6 92.5 7 94.5 10 L104 21 L110 22.5 C114 23.5 115 26 115 30 L115 35 C115 37 114 38 112 38 ${big} L8 38 C6 38 5 37 5 35 Z`,
    windows: 'M62.5 8 L72 8 L72 19 L60.8 19 Z M75 8 L86 8 C89 8 91 9 92.5 11 L100 19 L75 19 Z',
    wheels: [28, 92],
    r: 8.5,
  },
  van: {
    body: `M5 35 L5 12 C5 8 7 6 11 6 L92 6 C96 6 98.5 7.5 100 10.5 L106 22 L111 23.5 C114 24.5 115 27 115 30 L115 35 C115 37 114 38 112 38 ${big} L8 38 C6 38 5 37 5 35 Z`,
    windows: 'M10 9 L40 9 L40 19 L10 19 Z M43 9 L70 9 L70 19 L43 19 Z M73 9 L92 9 C94.5 9 96 10 97 12 L102 19 L73 19 Z',
    wheels: [28, 92],
    r: 8.5,
  },
  wagon: {
    body: `M6 35 C6 30 7 26 10 23 L18 12 C20 10.5 22 10 26 10 L76 10 C81 10 84 11.5 87 14.5 L96 24 L108 26 C113 27 115 29 115 33 L115 35 C115 37 114 38 112 38 ${small} L9 38 C7 38 6 37 6 35 Z`,
    windows: 'M14 22 L20 13.5 C21.5 12.5 23 12 26 12 L46 12 L46 22 Z M49 12 L66 12 L66 22 L49 22 Z M69 12 L76 12 C80 12 82.5 13.2 85 15.7 L91 22 L69 22 Z',
    wheels: [28, 92],
    r: 7.5,
  },
};

/** Decorative car outline in `currentColor` (windows and hubs use the background colour). */
export function CarSilhouette({ type = 'sedan', className }: { type?: string; className?: string }) {
  const s = SHAPES[type] ?? SHAPES.sedan;
  return (
    <svg viewBox="0 0 120 46" className={cn('fill-current', className)} aria-hidden>
      <path d={s.body} />
      <path d={s.windows} className="fill-white/55" />
      {s.wheels.map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={36} r={s.r} />
          <circle cx={cx} cy={36} r={s.r * 0.45} className="fill-white/70" />
        </g>
      ))}
    </svg>
  );
}
