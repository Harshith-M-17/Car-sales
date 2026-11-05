/**
 * Renders studio-style placeholder photos for demo listings: a side-profile car of the
 * listing's body type and paint colour, with tinted glass, shading and a floor shadow.
 * Development data only (used by seed-demo).
 */
import sharp from 'sharp';
import { BodyType } from '../modules/catalog/catalog.data';

interface Shape {
  /** Body outline in a 120x48 unit box; front of the car faces right. */
  body: string;
  windows: string;
  wheels: [number, number];
  wheelR: number;
  /** x of the B-pillar door line, or null for no door line. */
  door: number | null;
  belt: number;
  /** Bumper x positions, for head/tail lights. */
  front: number;
  rear: number;
  /** Extra details drawn over the body (e.g. a convertible's windscreen and seats). */
  extras?: string;
}

const SMALL_ARCH = (front: number, rear: number) =>
  `L${front + 9} 38 A9 9 0 0 0 ${front - 9} 38 L${rear + 9} 38 A9 9 0 0 0 ${rear - 9} 38`;
const BIG_ARCH = (front: number, rear: number) =>
  `L${front + 10} 38 A10 10 0 0 0 ${front - 10} 38 L${rear + 10} 38 A10 10 0 0 0 ${rear - 10} 38`;

const SHAPES: Record<BodyType, Shape> = {
  sedan: {
    body: `M6 35 C6 30 8 27 14 26 L30 24 L42 14 C45 12 48 11 53 11 L75 11 C80 11 83 12 86 15 L96 24 L108 26 C113 27 115 29 115 33 L115 35 C115 37 114 38 112 38 ${SMALL_ARCH(92, 28)} L9 38 C7 38 6 37 6 35 Z`,
    windows:
      'M36 23 L45 15 C47 13.5 49 13 53 13 L62 13 L62 23 Z M65 13 L75 13 C79 13 81.5 14 84 16.5 L91 23 L65 23 Z',
    wheels: [28, 92],
    wheelR: 7.5,
    door: 63.5,
    belt: 23,
    front: 115,
    rear: 6,
  },
  hatchback: {
    body: `M16 35 C16 30 17 26 19 22 L25 13 C27 11 30 10 34 10 L66 10 C71 10 74 11 77 14 L88 24 L100 26 C105 27 107 29 107 33 L107 35 C107 37 106 38 104 38 ${SMALL_ARCH(88, 34)} L19 38 C17 38 16 37 16 35 Z`,
    windows:
      'M22 22 L27 14 C29 12.5 31 12 34 12 L50 12 L50 22 Z M53 12 L66 12 C70 12 72.5 13 75 15.5 L82 22 L53 22 Z',
    wheels: [34, 88],
    wheelR: 7.5,
    door: 51.5,
    belt: 22,
    front: 107,
    rear: 16,
  },
  suv: {
    body: `M6 34 C6 28 7 24 12 23 L26 21 L36 9 C38 7 40 6 44 6 L88 6 C92 6 94 7 96 10 L104 21 L110 22.5 C114 23.5 115 26 115 30 L115 35 C115 37 114 38 112 38 ${BIG_ARCH(92, 28)} L9 38 C7 38 6 37 6 35 Z`,
    windows:
      'M30 20 L38 10 C39.5 8.5 41 8 44 8 L64 8 L64 20 Z M67 8 L88 8 C91 8 92.5 9 94 11 L101 20 L67 20 Z',
    wheels: [28, 92],
    wheelR: 8.5,
    door: 65.5,
    belt: 20,
    front: 115,
    rear: 6,
  },
  muv: {
    body: `M5 34 C5 27 6 22 9 18 L17 9 C19 7 21 6 25 6 L86 6 C90 6 92.5 7 94.5 10 L104 21 L110 22.5 C114 23.5 115 26 115 30 L115 35 C115 37 114 38 112 38 ${BIG_ARCH(92, 28)} L8 38 C6 38 5 37 5 35 Z`,
    windows:
      'M11 19 L19 9.5 C20.5 8.5 22 8 25 8 L44 8 L44 19 Z M47 8 L66 8 L66 19 L47 19 Z M69 8 L86 8 C89 8 91 9 92.5 11 L100 19 L69 19 Z',
    wheels: [28, 92],
    wheelR: 8.5,
    door: 67.5,
    belt: 19,
    front: 115,
    rear: 5,
  },
  pickup: {
    body: `M5 35 L5 22 C5 20.5 6 20 7.5 20 L58 20 L60 9 C60.5 7 62 6 64 6 L86 6 C90 6 92.5 7 94.5 10 L104 21 L110 22.5 C114 23.5 115 26 115 30 L115 35 C115 37 114 38 112 38 ${BIG_ARCH(92, 28)} L8 38 C6 38 5 37 5 35 Z`,
    windows: 'M62.5 8 L72 8 L72 19 L60.8 19 Z M75 8 L86 8 C89 8 91 9 92.5 11 L100 19 L75 19 Z',
    wheels: [28, 92],
    wheelR: 8.5,
    door: 73.5,
    belt: 19,
    front: 115,
    rear: 5,
  },
  coupe: {
    body: `M6 35 C6 31 8 28 14 27 L34 25 L48 15 C52 13 56 12 62 12 L74 12 C80 12 84 14 88 18 L96 25 L108 27 C113 28 115 30 115 33 L115 35 C115 37 114 38 112 38 ${SMALL_ARCH(92, 28)} L9 38 C7 38 6 37 6 35 Z`,
    windows:
      'M42 24 L51 17 C54 15 57 14 62 14 L68 14 L68 24 Z M71 14 L74 14 C79 14 82 15.5 85.5 19 L90 24 L71 24 Z',
    wheels: [28, 92],
    wheelR: 7.5,
    door: null,
    belt: 24,
    front: 115,
    rear: 6,
  },
  convertible: {
    body: `M6 35 C6 31 8 28 14 27 C30 25.5 60 25 78 25.2 L108 27 C113 28 115 30 115 33 L115 35 C115 37 114 38 112 38 ${SMALL_ARCH(92, 28)} L9 38 C7 38 6 37 6 35 Z`,
    windows: 'M77.5 25.3 L82.8 18.2 C83.2 17.7 84 17.7 84.3 18.2 L80.6 25.4 Z',
    wheels: [28, 92],
    wheelR: 7.5,
    door: null,
    belt: 26,
    front: 115,
    rear: 6,
    extras:
      '<path d="M44 25.4 C44 21.5 46 19.5 49 19.5 C52 19.5 53 21.5 53 25.3 Z M58 25.3 C58 21.5 60 19.5 63 19.5 C66 19.5 67 21.5 67 25.3 Z" fill="#2b2f36"/>',
  },
  van: {
    body: `M5 35 L5 12 C5 8 7 6 11 6 L92 6 C96 6 98.5 7.5 100 10.5 L106 22 L111 23.5 C114 24.5 115 27 115 30 L115 35 C115 37 114 38 112 38 ${BIG_ARCH(92, 28)} L8 38 C6 38 5 37 5 35 Z`,
    windows:
      'M10 9 L40 9 L40 19 L10 19 Z M43 9 L70 9 L70 19 L43 19 Z M73 9 L92 9 C94.5 9 96 10 97 12 L102 19 L73 19 Z',
    wheels: [28, 92],
    wheelR: 8.5,
    door: 71.5,
    belt: 19,
    front: 115,
    rear: 5,
  },
  wagon: {
    body: `M6 35 C6 30 7 26 10 23 L18 12 C20 10.5 22 10 26 10 L76 10 C81 10 84 11.5 87 14.5 L96 24 L108 26 C113 27 115 29 115 33 L115 35 C115 37 114 38 112 38 ${SMALL_ARCH(92, 28)} L9 38 C7 38 6 37 6 35 Z`,
    windows:
      'M14 22 L20 13.5 C21.5 12.5 23 12 26 12 L46 12 L46 22 Z M49 12 L66 12 L66 22 L49 22 Z M69 12 L76 12 C80 12 82.5 13.2 85 15.7 L91 22 L69 22 Z',
    wheels: [28, 92],
    wheelR: 7.5,
    door: 67.5,
    belt: 22,
    front: 115,
    rear: 6,
  },
};

const STUDIOS: [string, string, string][] = [
  ['#f4f6f9', '#dfe4eb', '#cfd6df'], // cool grey
  ['#f7f4ef', '#e7e0d6', '#d6cdc0'], // warm
  ['#f1f5fa', '#dbe5f0', '#c8d5e4'], // soft blue
];

function mix(hex: string, target: number, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => {
    const c = (n >> shift) & 255;
    return Math.round(c + (target - c) * amount);
  };
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`;
}

export function renderDemoCar(bodyType: BodyType, paint: string, studio: number): Promise<Buffer> {
  const s = SHAPES[bodyType];
  const [wallTop, wallBottom, floor] = STUDIOS[studio % STUDIOS.length];
  const light = mix(paint, 255, 0.35);
  const dark = mix(paint, 0, 0.35);
  const archR = s.wheelR > 8 ? 10 : 9;
  const wheel = (cx: number) => `
    <path d="M${cx + archR} 38 A${archR} ${archR} 0 0 0 ${cx - archR} 38 Z" fill="#14161a"/>
    <circle cx="${cx}" cy="36" r="${s.wheelR}" fill="#15171b"/>
    <circle cx="${cx}" cy="36" r="${s.wheelR * 0.62}" fill="url(#rim)"/>
    <circle cx="${cx}" cy="36" r="${s.wheelR * 0.62}" fill="none" stroke="#2b2f36" stroke-width="0.35"/>
    <circle cx="${cx}" cy="36" r="${s.wheelR * 0.18}" fill="#3f4650"/>`;

  // 120x48 unit car drawn at 8x, centred, wheels resting on the floor line.
  const svg = `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wallTop}"/><stop offset="1" stop-color="${wallBottom}"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wallBottom}"/><stop offset="1" stop-color="${floor}"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.55"><stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <linearGradient id="paint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.55" stop-color="${paint}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b4654"/><stop offset="0.5" stop-color="#1c2430"/><stop offset="1" stop-color="#2f3a48"/></linearGradient>
    <radialGradient id="rim" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#f1f3f5"/><stop offset="1" stop-color="#6b7280"/></radialGradient>
    <clipPath id="bodyClip"><path d="${s.body}"/></clipPath>
    <filter id="soft" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="16"/></filter>
  </defs>
  <rect width="1200" height="800" fill="url(#wall)"/>
  <rect y="560" width="1200" height="240" fill="url(#floor)"/>
  <rect width="1200" height="800" fill="url(#glow)"/>
  <ellipse cx="600" cy="598" rx="470" ry="30" fill="#000" fill-opacity="0.32" filter="url(#soft)"/>
  <g transform="translate(120 244) scale(8)">
    <path d="${s.body}" fill="url(#paint)" stroke="#000" stroke-opacity="0.22" stroke-width="0.35"/>
    <g clip-path="url(#bodyClip)">
      <rect x="0" y="${s.belt + 2}" width="120" height="2.2" fill="#fff" fill-opacity="0.18"/>
      <rect x="0" y="33" width="120" height="6" fill="#000" fill-opacity="0.12"/>
    </g>
    ${s.windows ? `<path d="${s.windows}" fill="url(#glass)"/>` : ''}
    ${s.door !== null ? `<path d="M${s.door} ${s.belt} L${s.door} 33" stroke="#000" stroke-opacity="0.22" stroke-width="0.3"/>` : ''}
    ${s.extras ?? ''}
    <ellipse cx="${s.front - 2}" cy="${s.belt + 4.5}" rx="1.6" ry="1" fill="#fff7d6"/>
    <rect x="${s.rear - 0.6}" y="${s.belt + 3}" width="1.6" height="2.4" rx="0.6" fill="#c81e1e"/>
    ${wheel(s.wheels[0])}${wheel(s.wheels[1])}
  </g>
  <text x="1170" y="770" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="20" letter-spacing="3" fill="#64748b" fill-opacity="0.75">DEMO PHOTO</text>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}
