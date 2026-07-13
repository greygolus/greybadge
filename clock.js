export const CLOCK_FONTS = [
  ["matrix", "Matrix 3 x 5"],
  ["tall", "Tall 3 x 7"],
  ["wide", "Wide 5 x 7"],
  ["segment", "Seven segment"]
];

export const CLOCK_BORDERS = [
  ["none", "No border"],
  ["solid", "Solid frame"],
  ["corners", "Corner brackets"],
  ["dots", "Dotted frame"],
  ["chase", "Chasing lights"]
];

export const CLOCK_ANIMATIONS = [
  ["static", "Steady"],
  ["colon", "Blinking colon"],
  ["pulse", "Soft pulse"],
  ["bounce", "One-pixel bounce"]
];

export const DEFAULT_CLOCK_SETTINGS = Object.freeze({
  font: "tall",
  border: "corners",
  animation: "colon",
  format: "12",
  leadingZero: false,
  marker: true,
  timezone: "local",
  speed: 2,
  syncMinutes: 1,
  sessionMinutes: 0
});

const DISPLAY_WIDTH = 44;
const DISPLAY_HEIGHT = 11;
const FRAME_WIDTH = 48;

const MATRIX = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "A": ["010", "101", "111", "101", "101"],
  "P": ["110", "101", "110", "100", "100"],
  " ": ["000", "000", "000", "000", "000"]
};

const TALL = {
  "0": ["111", "101", "101", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "010", "010", "111"],
  "2": ["111", "001", "001", "111", "100", "100", "111"],
  "3": ["111", "001", "001", "111", "001", "001", "111"],
  "4": ["101", "101", "101", "111", "001", "001", "001"],
  "5": ["111", "100", "100", "111", "001", "001", "111"],
  "6": ["111", "100", "100", "111", "101", "101", "111"],
  "7": ["111", "001", "001", "010", "010", "010", "010"],
  "8": ["111", "101", "101", "111", "101", "101", "111"],
  "9": ["111", "101", "101", "111", "001", "001", "111"],
  "A": ["010", "101", "101", "111", "101", "101", "101"],
  "P": ["110", "101", "101", "110", "100", "100", "100"],
  " ": ["000", "000", "000", "000", "000", "000", "000"]
};

const SEGMENTS = {
  "0": "abcedf", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc",
  "5": "afgcd", "6": "afgecd", "7": "abc", "8": "abcdefg", "9": "abfgcd"
};

const blank = (width = DISPLAY_WIDTH) => Array.from({ length: DISPLAY_HEIGHT }, () => Array(width).fill(false));

function segmentGlyph(character) {
  const rows = Array.from({ length: 7 }, () => Array(5).fill("0"));
  const paint = (x1, y1, x2, y2) => {
    for (let y = y1; y <= y2; y += 1) for (let x = x1; x <= x2; x += 1) rows[y][x] = "1";
  };
  const painters = {
    a: () => paint(1, 0, 3, 0), b: () => paint(4, 1, 4, 2), c: () => paint(4, 4, 4, 5),
    d: () => paint(1, 6, 3, 6), e: () => paint(0, 4, 0, 5), f: () => paint(0, 1, 0, 2), g: () => paint(1, 3, 3, 3)
  };
  for (const segment of SEGMENTS[character] || "") painters[segment]();
  return rows.map((row) => row.join(""));
}

function wideGlyph(character) {
  const source = TALL[character] || TALL[" "];
  return source.map((row) => `${row[0]}${row[0]}${row[1]}${row[2]}${row[2]}`);
}

function glyphFor(character, font) {
  if (font === "matrix") return MATRIX[character] || MATRIX[" "];
  if (font === "wide") return wideGlyph(character);
  if (font === "segment" && /\d/.test(character)) return segmentGlyph(character);
  return TALL[character] || TALL[" "];
}

function normalizeChoice(value, choices, fallback) {
  return choices.some(([id]) => id === value) ? value : fallback;
}

export function normalizeClockSettings(settings = {}) {
  return {
    ...DEFAULT_CLOCK_SETTINGS,
    ...settings,
    font: normalizeChoice(settings.font, CLOCK_FONTS, DEFAULT_CLOCK_SETTINGS.font),
    border: normalizeChoice(settings.border, CLOCK_BORDERS, DEFAULT_CLOCK_SETTINGS.border),
    animation: normalizeChoice(settings.animation, CLOCK_ANIMATIONS, DEFAULT_CLOCK_SETTINGS.animation),
    format: settings.format === "24" ? "24" : "12",
    timezone: settings.timezone === "utc" ? "utc" : "local",
    leadingZero: Boolean(settings.leadingZero),
    marker: settings.marker !== false,
    speed: Math.min(8, Math.max(1, Number(settings.speed) || DEFAULT_CLOCK_SETTINGS.speed)),
    syncMinutes: [1, 5].includes(Number(settings.syncMinutes)) ? Number(settings.syncMinutes) : DEFAULT_CLOCK_SETTINGS.syncMinutes,
    sessionMinutes: [0, 30, 60, 120, 240].includes(Number(settings.sessionMinutes)) ? Number(settings.sessionMinutes) : DEFAULT_CLOCK_SETTINGS.sessionMinutes
  };
}

export function clockSyncKey(date = new Date(), rawSettings = DEFAULT_CLOCK_SETTINGS) {
  const settings = normalizeClockSettings(rawSettings);
  return Math.floor(date.getTime() / (settings.syncMinutes * 60000));
}

export function secondsUntilClockSync(date = new Date(), rawSettings = DEFAULT_CLOCK_SETTINGS) {
  const settings = normalizeClockSettings(rawSettings);
  const interval = settings.syncMinutes * 60;
  return interval - (Math.floor(date.getTime() / 1000) % interval);
}

export function clockTimeParts(date = new Date(), settings = DEFAULT_CLOCK_SETTINGS) {
  const options = normalizeClockSettings(settings);
  const rawHours = options.timezone === "utc" ? date.getUTCHours() : date.getHours();
  const minutes = options.timezone === "utc" ? date.getUTCMinutes() : date.getMinutes();
  const marker = rawHours >= 12 ? "P" : "A";
  let hours = options.format === "24" ? rawHours : rawHours % 12 || 12;
  let hourText = String(hours).padStart(2, "0");
  if (options.format === "12" && !options.leadingZero && hours < 10) hourText = ` ${hours}`;
  return { hourText, minuteText: String(minutes).padStart(2, "0"), marker };
}

function drawGlyph(rows, glyph, left, top) {
  glyph.forEach((line, y) => [...line].forEach((pixel, x) => {
    if (pixel === "1" && rows[top + y]?.[left + x] !== undefined) rows[top + y][left + x] = true;
  }));
}

function drawBorder(rows, style, phase) {
  if (style === "none") return;
  if (style === "solid") {
    for (let x = 0; x < DISPLAY_WIDTH; x += 1) rows[0][x] = rows[DISPLAY_HEIGHT - 1][x] = true;
    for (let y = 0; y < DISPLAY_HEIGHT; y += 1) rows[y][0] = rows[y][DISPLAY_WIDTH - 1] = true;
  } else if (style === "corners") {
    for (let x = 0; x < 5; x += 1) rows[0][x] = rows[0][DISPLAY_WIDTH - 1 - x] = rows[DISPLAY_HEIGHT - 1][x] = rows[DISPLAY_HEIGHT - 1][DISPLAY_WIDTH - 1 - x] = true;
    for (let y = 0; y < 4; y += 1) rows[y][0] = rows[y][DISPLAY_WIDTH - 1] = rows[DISPLAY_HEIGHT - 1 - y][0] = rows[DISPLAY_HEIGHT - 1 - y][DISPLAY_WIDTH - 1] = true;
  } else {
    const stride = style === "chase" ? 4 : 3;
    const offset = style === "chase" ? phase % stride : 0;
    for (let x = 0; x < DISPLAY_WIDTH; x += 1) if ((x + offset) % stride === 0) rows[0][x] = rows[DISPLAY_HEIGHT - 1][DISPLAY_WIDTH - 1 - x] = true;
    for (let y = 1; y < DISPLAY_HEIGHT - 1; y += 1) if ((y + offset) % stride === 0) rows[y][0] = rows[DISPLAY_HEIGHT - 1 - y][DISPLAY_WIDTH - 1] = true;
  }
}

function renderFace(date, settings, phase, yOffset = 0) {
  const rows = blank();
  const { hourText, minuteText, marker } = clockTimeParts(date, settings);
  const text = `${hourText}:${minuteText}`;
  const digitGlyph = glyphFor("8", settings.font);
  const digitWidth = digitGlyph[0].length;
  const digitHeight = digitGlyph.length;
  const colonWidth = 1;
  const markerGlyph = glyphFor(marker, settings.font === "matrix" ? "matrix" : "tall");
  const markerWidth = settings.format === "12" && settings.marker ? markerGlyph[0].length + 2 : 0;
  const textWidth = digitWidth * 4 + colonWidth + 4 + markerWidth;
  let left = Math.floor((DISPLAY_WIDTH - textWidth) / 2);
  const usableTop = settings.border === "none" ? 0 : 1;
  const usableHeight = settings.border === "none" ? DISPLAY_HEIGHT : DISPLAY_HEIGHT - 2;
  const top = usableTop + Math.floor((usableHeight - digitHeight) / 2) + yOffset;

  for (const character of text) {
    if (character === ":") {
      if (settings.animation !== "colon" || phase % 2 === 0) {
        rows[top + Math.max(1, Math.floor(digitHeight / 3))][left] = true;
        rows[top + Math.min(digitHeight - 2, Math.ceil(digitHeight * 2 / 3))][left] = true;
      }
      left += colonWidth + 1;
    } else {
      drawGlyph(rows, glyphFor(character, settings.font), left, top);
      left += digitWidth + 1;
    }
  }
  if (markerWidth) drawGlyph(rows, markerGlyph, left + 1, top + Math.max(0, digitHeight - markerGlyph.length));
  drawBorder(rows, settings.border, phase);
  return rows;
}

function dilate(rows, border) {
  const output = rows.map((row) => [...row]);
  for (let y = 1; y < DISPLAY_HEIGHT - 1; y += 1) for (let x = 1; x < DISPLAY_WIDTH - 1; x += 1) {
    if (rows[y][x] && border === "none") continue;
    if (rows[y][x] || rows[y - 1][x] || rows[y + 1][x] || rows[y][x - 1] || rows[y][x + 1]) output[y][x] = true;
  }
  return output;
}

export function createClockFrames(date = new Date(), rawSettings = DEFAULT_CLOCK_SETTINGS) {
  const settings = normalizeClockSettings(rawSettings);
  const animationFrames = settings.animation === "static" ? 1 : settings.animation === "bounce" ? 4 : settings.animation === "pulse" ? 2 : 2;
  const count = settings.border === "chase" ? Math.max(4, animationFrames) : animationFrames;
  const bounce = [0, -1, 0, 1];
  return Array.from({ length: count }, (_, phase) => {
    const frame = renderFace(date, settings, phase, settings.animation === "bounce" ? bounce[phase % bounce.length] : 0);
    return settings.animation === "pulse" && phase % 2 === 1 ? dilate(frame, settings.border) : frame;
  });
}

export function combineClockFrames(frames) {
  const output = blank(frames.length * FRAME_WIDTH);
  frames.forEach((frame, frameIndex) => {
    for (let y = 0; y < DISPLAY_HEIGHT; y += 1) for (let x = 0; x < DISPLAY_WIDTH; x += 1) output[y][frameIndex * FRAME_WIDTH + x] = Boolean(frame[y]?.[x]);
  });
  return output;
}

export function createClockSlot(date = new Date(), rawSettings = DEFAULT_CLOCK_SETTINGS) {
  const settings = normalizeClockSettings(rawSettings);
  const frames = createClockFrames(date, settings);
  const { hourText, minuteText, marker } = clockTimeParts(date, settings);
  return {
    text: "",
    source: "clock",
    title: `Clock ${hourText.trim()}:${minuteText}${settings.format === "12" && settings.marker ? marker : ""}`,
    rows: combineClockFrames(frames),
    speed: settings.speed,
    mode: frames.length > 1 ? 5 : 4,
    blink: false,
    ants: false
  };
}
