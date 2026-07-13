import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from "./protocol.js";

export const FRAME_WIDTH = 48;

export const blank = (width = DISPLAY_WIDTH) =>
  Array.from({ length: DISPLAY_HEIGHT }, () => Array(width).fill(false));

const clone = (rows) => rows.map((row) => [...row]);
const set = (rows, x, y, value = true) => {
  if (rows[y] && x >= 0 && x < rows[y].length) rows[y][x] = value;
};
const line = (rows, x0, y0, x1, y1) => {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    set(rows, x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x0 += sx; }
    if (twice <= dx) { error += dx; y0 += sy; }
  }
};
const rect = (rows, x, y, width, height, fill = false) => {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      if (fill || py === y || py === y + height - 1 || px === x || px === x + width - 1) set(rows, px, py);
    }
  }
};
const circle = (rows, cx, cy, radius, fill = false) => {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      const distance = Math.hypot(x - cx, y - cy);
      if (fill ? distance <= radius + .15 : Math.abs(distance - radius) < .65) set(rows, x, y);
    }
  }
};
const drawPattern = (rows, pattern, ox, oy, scale = 1) => {
  pattern.forEach((sourceRow, y) => [...sourceRow].forEach((pixel, x) => {
    if (pixel === "#") rect(rows, ox + x * scale, oy + y * scale, scale, scale, true);
  }));
};
const centeredPattern = (pattern, scale = 1) => {
  const rows = blank();
  const width = pattern[0].length * scale;
  const height = pattern.length * scale;
  drawPattern(rows, pattern, Math.floor((DISPLAY_WIDTH - width) / 2), Math.floor((DISPLAY_HEIGHT - height) / 2), scale);
  return rows;
};
const blit = (target, source, ox, oy = 0) => {
  source.forEach((row, y) => row.forEach((value, x) => { if (value) set(target, ox + x, oy + y); }));
};

export function combineFrames(frames) {
  const output = blank(frames.length * FRAME_WIDTH);
  frames.forEach((frame, index) => blit(output, frame, index * FRAME_WIDTH));
  return output;
}

const animation = (count, painter) => combineFrames(Array.from({ length: count }, (_, index) => {
  const frame = blank(FRAME_WIDTH);
  painter(frame, index, count);
  return frame;
}));

const ICONS = {
  heart: [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."],
  star: ["...#...", "...#...", "#######", ".#####.", "..###..", ".##.##."],
  smile: [".#####.", "#.....#", "#.#.#.#", "#.....#", "#.#.#.#", "#..#..#", ".#####."],
  wink: [".#####.", "#.....#", "#.###.#", "#.....#", "#.#.#.#", "#..#..#", ".#####."],
  sad: [".#####.", "#.....#", "#.#.#.#", "#.....#", "#..#..#", "#.#.#.#", ".#####."],
  cat: ["#.....#", "##...##", "#.###.#", "#.#.#.#", "#.....#", "#..#..#", ".#####."],
  dog: ["##...##", ".#####.", "#.#.#.#", "#.....#", "#..#..#", "#...#.#", ".#####."],
  alien: ["..###..", ".#####.", "##.#.##", "#######", "..#.#..", ".#...#.", "#.....#"],
  ghost: ["..###..", ".#####.", "##.#.##", "#######", "#######", "##.#.##", "#.#.#.#"],
  skull: [".#####.", "##.#.##", "##.#.##", "#######", ".#.#.#.", "..###..", "..#.#.."],
  music: ["....##.", "...###.", "..#.##.", ".#..##.", "##..##.", "##.###.", ".#..#.."],
  coffee: ["..#.#..", "...#...", ".#####.", ".#...##", ".#...##", ".#####.", "..###.."],
  bolt: ["....##.", "...##..", "..##...", ".#####.", "...##..", "..##...", ".##...."],
  crown: ["#.....#", "##.#.##", "#######", ".#####.", ".#####.", ".#####.", "..###.."],
  flower: [".#...#.", ".##.##.", "..###..", ".#####.", "..###..", "...#...", "..###.."],
  planet: ["..###..", ".#####.", "#########", "..#####..", "#########", ".#####.", "..###.."],
  rocket: ["...#...", "..###..", ".#####.", ".#.#.#.", ".#####.", "##.#.##", "#..#..#"],
  gamepad: ["..###..", ".#####.", "##.#.##", "#######", "##.#.##", "#.....#", ".#...#."],
  camera: [".##....", "#######", "#.....#", "#..#..#", "#.###.#", "#.....#", "#######"],
  mail: ["#######", "##...##", "#.#.#.#", "#..#..#", "#.....#", "#.....#", "#######"],
  check: ["......#", ".....##", "#...##.", "##.##..", ".###...", "..#....", "......."],
  cross: ["#.....#", ".#...#.", "..#.#..", "...#...", "..#.#..", ".#...#.", "#.....#"],
  peace: ["...#...", "...#...", ".#.#.#.", "..###..", ".##.##.", "##.#.##", "#..#..#"],
  infinity: [".......", ".##.##.", "##.#.##", "#..#..#", "##.#.##", ".##.##.", "......."],
  moon: ["..####.", ".####..", "####...", "####...", ".####..", "..####.", "...###."],
  sun: ["...#...", ".#.#.#.", "..###..", "#######", "..###..", ".#.#.#.", "...#..."],
  cloud: [".......", "..##...", ".####..", "#######", "#######", ".#####.", "......."],
  umbrella: ["...#...", ".#####.", "#######", "...#...", "...#...", "#..#...", ".##...."],
  fish: [".......", ".#...#.", "..#.##.", "#######", "..#.##.", ".#...#.", "......."],
  butterfly: ["##...##", "###.###", ".#####.", "...#...", ".#####.", "###.###", "##...##"],
  lock: ["..###..", ".#...#.", ".#...#.", "#######", "##.#.##", "##.#.##", "#######"],
  key: [".###...", "#...#..", "#...###", ".###.#.", "....###", ".....#.", ".....##"],
  bell: ["...#...", "..###..", ".#####.", ".#####.", "#######", "..###..", "...#..."],
  diamond: ["...#...", "..#.#..", ".#...#.", "#.....#", ".#...#.", "..#.#..", "...#..."],
  warning: ["...#...", "..###..", ".##.##.", ".##.##.", "##...##", "##.#.##", "#######"]
};

const iconMeta = [
  ["heart", "Heart", "Love"], ["star", "Star", "Symbols"], ["smile", "Happy face", "Faces"],
  ["wink", "Winking face", "Faces"], ["sad", "Sad face", "Faces"], ["cat", "Cat", "Creatures"],
  ["dog", "Dog", "Creatures"], ["alien", "Alien", "Creatures"], ["ghost", "Ghost", "Creatures"],
  ["skull", "Skull", "Symbols"], ["music", "Music note", "Music"], ["coffee", "Coffee", "Objects"],
  ["bolt", "Lightning", "Weather"], ["crown", "Crown", "Symbols"], ["flower", "Flower", "Nature"],
  ["planet", "Ringed planet", "Space"], ["rocket", "Rocket", "Space"], ["gamepad", "Game controller", "Objects"],
  ["camera", "Camera", "Objects"], ["mail", "Envelope", "Objects"], ["check", "Check mark", "Symbols"],
  ["cross", "Cross mark", "Symbols"], ["peace", "Peace sign", "Symbols"], ["infinity", "Infinity", "Symbols"],
  ["moon", "Moon", "Space"], ["sun", "Sun", "Weather"], ["cloud", "Cloud", "Weather"],
  ["umbrella", "Umbrella", "Weather"], ["fish", "Fish", "Creatures"], ["butterfly", "Butterfly", "Creatures"],
  ["lock", "Lock", "Objects"], ["key", "Key", "Objects"], ["bell", "Bell", "Objects"],
  ["diamond", "Diamond", "Symbols"], ["warning", "Warning", "Symbols"]
];

const iconEntries = iconMeta.map(([id, name, tag]) => ({
  id: `icon-${id}`, name, category: "Icons", tags: `${tag} pixel art static`, kind: "still", speed: 4, mode: 4,
  description: `${tag} pixel icon`, generate: () => centeredPattern(ICONS[id])
}));

const animationEntries = [
  { id: "anim-heartbeat", name: "Heartbeat", tags: "love pulse heart", generate: () => animation(8, (f, i) => drawPattern(f, ICONS.heart, 20 - (i % 4 === 1 ? 1 : 0), i % 4 === 1 ? 1 : 2, i % 4 === 1 ? 1 : 1)) },
  { id: "anim-bounce", name: "Bouncing ball", tags: "ball bounce sport", generate: () => animation(12, (f, i, n) => circle(f, 3 + Math.round(i * 40 / (n - 1)), 8 - Math.round(Math.abs(Math.sin(i / (n - 1) * Math.PI * 2)) * 7), 2, true)) },
  { id: "anim-equalizer", name: "Equalizer", tags: "music audio bars", generate: () => animation(10, (f, i) => { for (let x = 1; x < 47; x += 4) { const h = 1 + ((x * 3 + i * 5 + Math.round(Math.sin(x + i) * 3)) % 10 + 10) % 10; rect(f, x, 11 - h, 2, h, true); } }) },
  { id: "anim-rain", name: "Pixel rain", tags: "weather rain storm", generate: () => animation(8, (f, i) => { for (let x = 2; x < 48; x += 7) { const y = (x * 2 + i * 2) % 13 - 2; set(f, x, y); set(f, x - 1, y + 1); } }) },
  { id: "anim-fire", name: "Fire line", tags: "flame hot pulse", generate: () => animation(8, (f, i) => { for (let x = 0; x < 48; x += 1) { const h = 2 + ((x * 7 + i * 3) % 7); for (let y = 10; y > 10 - h; y -= 1) if ((x + y + i) % 3) set(f, x, y); } }) },
  { id: "anim-wave", name: "Sine wave", tags: "abstract ocean smooth", generate: () => animation(12, (f, i) => { for (let x = 0; x < 48; x += 1) set(f, x, 5 + Math.round(Math.sin(x / 4 + i / 2) * 4)); }) },
  { id: "anim-orbit", name: "Orbit", tags: "space planet circle", generate: () => animation(12, (f, i, n) => { circle(f, 23, 5, 3, true); const a = i / n * Math.PI * 2; circle(f, 23 + Math.round(Math.cos(a) * 15), 5 + Math.round(Math.sin(a) * 5), 1, true); }) },
  { id: "anim-loader", name: "Loading dots", tags: "utility wait dots", generate: () => animation(8, (f, i) => { for (let x = 0; x < 5; x += 1) circle(f, 16 + x * 4, 5, x === i % 5 ? 2 : 1, true); }) },
  { id: "anim-chevrons", name: "Chevrons", tags: "arrow direction speed", generate: () => animation(6, (f, i) => { for (let base = -8 + i * 3; base < 52; base += 12) { line(f, base, 1, base + 5, 5); line(f, base + 5, 5, base, 9); } }) },
  { id: "anim-scanner", name: "Scanner beam", tags: "tech laser scan", generate: () => animation(12, (f, i, n) => { const x = Math.round(i * 47 / (n - 1)); for (let y = 0; y < 11; y += 1) set(f, x, y); if (x > 0) { set(f, x - 1, 4); set(f, x - 1, 5); set(f, x - 1, 6); } }) },
  { id: "anim-border", name: "Chasing border", tags: "frame ants marquee", generate: () => animation(8, (f, i) => { for (let x = 0; x < 48; x += 1) if ((x + i) % 4 < 2) { set(f, x, 0); set(f, 47 - x, 10); } for (let y = 1; y < 10; y += 1) if ((y + i) % 4 < 2) { set(f, 0, y); set(f, 47, 10 - y); } }) },
  { id: "anim-eyes", name: "Blinking eyes", tags: "face spooky look", generate: () => animation(10, (f, i) => { const closed = i === 7 || i === 8; [15, 33].forEach((x) => closed ? line(f, x - 5, 5, x + 5, 5) : circle(f, x, 5, 4)); if (!closed) { circle(f, 15 + (i < 5 ? -1 : 1), 5, 1, true); circle(f, 33 + (i < 5 ? -1 : 1), 5, 1, true); } }) },
  { id: "anim-rocket", name: "Rocket launch", tags: "space ship launch", generate: () => animation(10, (f, i) => { const x = i * 5 - 6; drawPattern(f, ICONS.rocket, x, 2); for (let t = 1; t < 8; t += 2) set(f, x - t, 7 + (t % 3)); }) },
  { id: "anim-snow", name: "Falling snow", tags: "weather winter snow", generate: () => animation(10, (f, i) => { for (let x = 2; x < 48; x += 6) { const y = (x + i * 2 + Math.floor(x / 6) * 3) % 13 - 1; set(f, x, y); set(f, x - 1, y); set(f, x + 1, y); set(f, x, y - 1); set(f, x, y + 1); } }) },
  { id: "anim-pulse", name: "Pulse rings", tags: "abstract radar ripple", generate: () => animation(8, (f, i) => { const r = 1 + i; circle(f, 23, 5, Math.min(r, 10)); if (r > 5) circle(f, 23, 5, r - 5); }) },
  { id: "anim-snake", name: "Pixel snake", tags: "game creature retro", generate: () => animation(12, (f, i) => { for (let x = 0; x < 19; x += 1) { const px = (i * 4 - x + 55) % 55 - 5; set(f, px, 5 + Math.round(Math.sin((px + i) / 4) * 3)); } circle(f, (i * 4 + 55) % 55 - 5, 5 + Math.round(Math.sin(((i * 4 + 55) % 55 - 5 + i) / 4) * 3), 1, true); }) },
  { id: "anim-battery", name: "Charging battery", tags: "utility power battery", generate: () => animation(8, (f, i) => { rect(f, 9, 1, 29, 9); rect(f, 38, 4, 3, 3, true); const fill = Math.min(25, (i + 1) * 4); rect(f, 11, 3, fill, 5, true); }) },
  { id: "anim-signal", name: "Signal bars", tags: "utility wifi network", generate: () => animation(8, (f, i) => { for (let b = 0; b < 5; b += 1) if (b <= i % 6) rect(f, 12 + b * 5, 9 - b * 2, 3, b * 2 + 2, true); }) },
  { id: "anim-comet", name: "Comet", tags: "space star trail", generate: () => animation(12, (f, i) => { const x = i * 5 - 5; circle(f, x, 5, 2, true); for (let t = 2; t < 17; t += 2) set(f, x - t, 5 + ((t / 2) % 3 - 1)); }) },
  { id: "anim-confetti", name: "Confetti", tags: "party celebration sparkle", generate: () => animation(8, (f, i) => { for (let p = 0; p < 24; p += 1) set(f, (p * 13 + i * (p % 3 + 1)) % 48, (p * 7 + i * 2) % 11); }) },
  { id: "anim-hourglass", name: "Hourglass", tags: "utility time wait", generate: () => animation(8, (f, i) => { line(f, 18, 1, 30, 1); line(f, 18, 9, 30, 9); line(f, 18, 1, 30, 9); line(f, 30, 1, 18, 9); for (let y = 2; y < 9; y += 1) for (let x = 19; x < 30; x += 1) if ((i < 4 ? y < 5 - i : y > 8 - (i - 4)) && x > 18 + Math.abs(5 - y) && x < 30 - Math.abs(5 - y)) set(f, x, y); }) },
  { id: "anim-spinner", name: "Orbit spinner", tags: "utility loading wait", generate: () => animation(12, (f, i, n) => { for (let p = 0; p < 8; p += 1) { const a = (p + i) / n * Math.PI * 2; if (p < 4) circle(f, 23 + Math.round(Math.cos(a) * 8), 5 + Math.round(Math.sin(a) * 4), p === 0 ? 2 : 1, true); } }) },
  { id: "anim-dna", name: "DNA helix", tags: "science abstract wave", generate: () => animation(10, (f, i) => { for (let x = 0; x < 48; x += 2) { const y1 = 5 + Math.round(Math.sin(x / 5 + i / 2) * 4); const y2 = 10 - y1; set(f, x, y1); set(f, x, y2); if (x % 6 === 0) line(f, x, y1, x, y2); } }) },
  { id: "anim-city", name: "City lights", tags: "scene buildings night", generate: () => animation(8, (f, i) => { for (let x = 0; x < 48; x += 6) { const h = 4 + (x * 3 % 7); rect(f, x, 11 - h, 5, h, true); for (let y = 12 - h; y < 10; y += 2) for (let wx = x + 1; wx < x + 5; wx += 2) if ((wx + y + i) % 4) set(f, wx, y, false); } }) },
  { id: "anim-ocean", name: "Ocean drift", tags: "scene water fish calm", generate: () => animation(12, (f, i) => { for (let x = 0; x < 48; x += 1) set(f, x, 8 + Math.round(Math.sin(x / 5 + i / 3))); drawPattern(f, ICONS.fish, (i * 4) % 55 - 7, 0); }) }
].map((item) => ({ ...item, category: "Animations", kind: "animation", description: "Self-playing frame animation", speed: 5, mode: 5 }));

const patternEntries = [
  ["checker", "Checkerboard", (r) => { for (let y = 0; y < 11; y += 1) for (let x = 0; x < 44; x += 1) if ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0) set(r, x, y); }],
  ["diagonal", "Diagonal stripes", (r) => { for (let y = 0; y < 11; y += 1) for (let x = 0; x < 44; x += 1) if ((x + y * 2) % 7 < 2) set(r, x, y); }],
  ["diamonds", "Diamond field", (r) => { for (let cx = 3; cx < 44; cx += 8) for (let y = 0; y < 11; y += 1) { const d = Math.abs(y - 5); set(r, cx - (5 - d), y); set(r, cx + (5 - d), y); } }],
  ["dots", "Halftone dots", (r) => { for (let y = 1; y < 11; y += 3) for (let x = (y % 2 ? 2 : 0); x < 44; x += 4) set(r, x, y); }],
  ["zigzag", "Zigzag", (r) => { for (let x = 0; x < 44; x += 1) set(r, x, Math.abs((x % 16) - 8) + 1); }],
  ["circuit", "Circuit board", (r) => { for (let y = 1; y < 11; y += 3) { line(r, 0, y, 10 + y, y); line(r, 10 + y, y, 15 + y, y + 2); line(r, 15 + y, y + 2, 43, y + 2); circle(r, 8 + y, y, 1, true); } }],
  ["bubbles", "Bubbles", (r) => { [[4,3,2],[12,7,3],[22,3,2],[31,6,4],[41,2,2]].forEach(([x,y,s]) => circle(r,x,y,s)); }],
  ["starfield", "Star field", (r) => { for (let p = 0; p < 28; p += 1) set(r, (p * 17) % 44, (p * 7) % 11); }],
  ["frame", "Double frame", (r) => { rect(r,0,0,44,11); rect(r,3,2,38,7); }],
  ["arrows", "Arrow lane", (r) => { for (let x = -2; x < 44; x += 9) { line(r,x,1,x+4,5); line(r,x+4,5,x,9); } }]
].map(([id, name, painter]) => ({
  id: `pattern-${id}`, name, category: "Patterns", tags: "abstract texture background", kind: "still", description: "Full-display pixel pattern", speed: 4, mode: 4,
  generate: () => { const rows = blank(); painter(rows); return rows; }
}));

export const CONTENT_LIBRARY = [...animationEntries, ...iconEntries, ...patternEntries];

export const SHOWS = [
  { id: "show-party", name: "Party pack", description: "Equalizer, confetti, smile, star, and waves", entries: ["anim-equalizer", "anim-confetti", "icon-smile", "icon-star", "anim-wave"] },
  { id: "show-space", name: "Space trip", description: "Rocket, comet, orbit, planet, and moon", entries: ["anim-rocket", "anim-comet", "anim-orbit", "icon-planet", "icon-moon"] },
  { id: "show-spooky", name: "Spooky loop", description: "Ghosts, blinking eyes, skulls, and moonlight", entries: ["icon-ghost", "anim-eyes", "icon-skull", "icon-moon", "anim-pulse"] },
  { id: "show-arcade", name: "Retro arcade", description: "Alien, snake, game controller, scanner, and loader", entries: ["icon-alien", "anim-snake", "icon-gamepad", "anim-scanner", "anim-loader"] },
  { id: "show-weather", name: "Weather station", description: "Sun, clouds, rain, lightning, and snow", entries: ["icon-sun", "icon-cloud", "anim-rain", "icon-bolt", "anim-snow"] },
  { id: "show-love", name: "Love loop", description: "Hearts, flowers, stars, and soft pulses", entries: ["anim-heartbeat", "icon-flower", "icon-heart", "anim-pulse", "icon-star"] },
  { id: "show-chill", name: "Chill mode", description: "Ocean, moon, stars, orbit, and gentle waves", entries: ["anim-ocean", "icon-moon", "pattern-starfield", "anim-orbit", "anim-wave"] },
  { id: "show-signal", name: "Status board", description: "Battery, signal, check, warning, and scanner", entries: ["anim-battery", "anim-signal", "icon-check", "icon-warning", "anim-scanner"] }
];

export function getLibraryEntry(id) {
  return CONTENT_LIBRARY.find((entry) => entry.id === id);
}

function cropToFrame(rows) {
  const frame = blank(FRAME_WIDTH);
  const width = rows[0]?.length || 1;
  const sourceX = Math.max(0, Math.floor((width - DISPLAY_WIDTH) / 2));
  const targetX = Math.max(0, Math.floor((DISPLAY_WIDTH - width) / 2));
  for (let y = 0; y < DISPLAY_HEIGHT; y += 1) for (let x = 0; x < Math.min(width, DISPLAY_WIDTH); x += 1) if (rows[y]?.[sourceX + x]) set(frame, targetX + x, y);
  return frame;
}

const transformFrame = (base, effect, index, count) => {
  const frame = blank(FRAME_WIDTH);
  const phase = count <= 1 ? 0 : index / (count - 1);
  let dx = 2, dy = 0;
  if (effect === "bounce-x") dx = 2 + Math.round(Math.sin(phase * Math.PI * 2) * 2);
  if (effect === "bounce-y") dy = Math.round(Math.sin(phase * Math.PI * 2) * 2);
  if (effect === "shake") dx = 2 + [-2, 1, -1, 2, 0][index % 5];
  blit(frame, base, dx, dy);
  if (effect === "blink" && index % 3 === 2) return blank(FRAME_WIDTH);
  if (effect === "wipe") for (let y = 0; y < 11; y += 1) for (let x = Math.floor(phase * 48); x < 48; x += 1) frame[y][x] = false;
  if (effect === "sparkle") for (let p = 0; p < 10; p += 1) set(frame, (p * 17 + index * 5) % 48, (p * 7 + index * 3) % 11);
  if (effect === "split") {
    const shift = Math.round(Math.abs(Math.sin(phase * Math.PI * 2)) * 6);
    const copy = clone(frame);
    for (let y = 0; y < 11; y += 1) for (let x = 0; x < 48; x += 1) frame[y][x] = copy[y][x < 24 ? x + shift : x - shift] || false;
  }
  if (effect === "flip") {
    const compressed = Math.max(1, Math.round(Math.abs(Math.cos(phase * Math.PI)) * DISPLAY_HEIGHT));
    const copy = clone(frame);
    for (let y = 0; y < 11; y += 1) for (let x = 0; x < 48; x += 1) frame[y][x] = false;
    for (let y = 0; y < compressed; y += 1) {
      const sy = Math.floor(y / compressed * 11);
      for (let x = 0; x < 48; x += 1) frame[Math.floor((11 - compressed) / 2) + y][x] = copy[sy][x];
    }
  }
  return frame;
};

export const CUSTOM_EFFECTS = [
  ["bounce-x", "Side bounce"], ["bounce-y", "Vertical bounce"], ["shake", "Shake"],
  ["blink", "Strobe"], ["wipe", "Progressive wipe"], ["sparkle", "Sparkle overlay"],
  ["split", "Split apart"], ["flip", "Vertical flip"]
];

export function createCustomAnimation(rows, effect, frameCount = 8) {
  const base = cropToFrame(rows);
  return combineFrames(Array.from({ length: frameCount }, (_, index) => transformFrame(base, effect, index, frameCount)));
}
