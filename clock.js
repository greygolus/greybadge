export const CLOCK_FONTS = [
  ["matrix", "Matrix 3 x 5"],
  ["tall", "Tall 3 x 7"],
  ["wide", "Wide 5 x 7"],
  ["segment", "Seven segment"],
  ["mini", "Mini 2 x 5"],
  ["block", "Block 4 x 7"],
  ["rounded", "Rounded 5 x 7"]
];

export const CLOCK_BORDERS = [
  ["none", "No border"],
  ["solid", "Solid frame"],
  ["corners", "Corner brackets"],
  ["dots", "Dotted frame"],
  ["rails", "Top & bottom rails"],
  ["brackets", "Side brackets"],
  ["ticks", "Center ticks"],
  ["chase", "Chasing lights"],
  ["marquee", "Cinema marquee"],
  ["orbit", "Orbiting spark"],
  ["custom", "Custom drawn border"]
];

export const CLOCK_ANIMATIONS = [
  ["static", "Steady"],
  ["colon", "Blinking colon"],
  ["pulse", "Soft pulse"],
  ["bounce", "One-pixel bounce"]
];

const DISPLAY_WIDTH = 44;
const DISPLAY_HEIGHT = 11;
const FRAME_WIDTH = 48;

const BORDER_POSITIONS = [
  ...Array.from({ length: DISPLAY_WIDTH }, (_, x) => [x, 0]),
  ...Array.from({ length: DISPLAY_HEIGHT - 2 }, (_, y) => [DISPLAY_WIDTH - 1, y + 1]),
  ...Array.from({ length: DISPLAY_WIDTH }, (_, x) => [DISPLAY_WIDTH - 1 - x, DISPLAY_HEIGHT - 1]),
  ...Array.from({ length: DISPLAY_HEIGHT - 2 }, (_, y) => [0, DISPLAY_HEIGHT - 2 - y])
];

const PERIMETER_PIXEL_COUNT = BORDER_POSITIONS.length;
export const CLOCK_BORDER_PIXEL_COUNT = DISPLAY_WIDTH * DISPLAY_HEIGHT;
const customizableRowsCache = new Map();

export function clockBorderPositionIndex(x, y) {
  return x >= 0 && x < DISPLAY_WIDTH && y >= 0 && y < DISPLAY_HEIGHT ? y * DISPLAY_WIDTH + x : -1;
}

function borderMatches(style, x, y, index = 0) {
  if (style === "solid") return true;
  if (style === "corners") return (y % (DISPLAY_HEIGHT - 1) === 0 && (x < 5 || x >= DISPLAY_WIDTH - 5)) || (x % (DISPLAY_WIDTH - 1) === 0 && (y < 4 || y >= DISPLAY_HEIGHT - 4));
  if (style === "dots") return index % 3 === 0;
  if (style === "rails") return y === 0 || y === DISPLAY_HEIGHT - 1;
  if (style === "brackets") return x === 0 || x === DISPLAY_WIDTH - 1;
  if (style === "ticks") return (y % (DISPLAY_HEIGHT - 1) === 0 && Math.abs(x - (DISPLAY_WIDTH - 1) / 2) < 4) || (x % (DISPLAY_WIDTH - 1) === 0 && Math.abs(y - (DISPLAY_HEIGHT - 1) / 2) < 3);
  return false;
}

export function createClockBorderPattern(style = "corners") {
  const rows = Array.from({ length: DISPLAY_HEIGHT }, () => Array(DISPLAY_WIDTH).fill(false));
  if (style === "solid") rows.forEach((row) => row.fill(true));
  else if (style !== "clear") BORDER_POSITIONS.forEach(([x, y], index) => { rows[y][x] = borderMatches(style, x, y, index); });
  return rows.flat().map((pixel) => pixel ? "1" : "0").join("");
}

export function clockBorderRows(pattern = "") {
  const rows = Array.from({ length: DISPLAY_HEIGHT }, () => Array(DISPLAY_WIDTH).fill(false));
  if (typeof pattern === "string" && pattern.length === PERIMETER_PIXEL_COUNT && /^[01]+$/.test(pattern)) {
    BORDER_POSITIONS.forEach(([x, y], index) => { rows[y][x] = pattern[index] === "1"; });
    return rows;
  }
  const safePattern = typeof pattern === "string" && pattern.length === CLOCK_BORDER_PIXEL_COUNT && /^[01]+$/.test(pattern) ? pattern : createClockBorderPattern("corners");
  for (let y = 0; y < DISPLAY_HEIGHT; y += 1) for (let x = 0; x < DISPLAY_WIDTH; x += 1) rows[y][x] = safePattern[clockBorderPositionIndex(x, y)] === "1";
  return rows;
}

function normalizeCustomBorder(pattern) {
  return clockBorderRows(pattern).flat().map((pixel) => pixel ? "1" : "0").join("");
}

export const DEFAULT_CLOCK_SETTINGS = Object.freeze({
  font: "tall",
  border: "corners",
  customBorder: createClockBorderPattern("corners"),
  animation: "colon",
  format: "12",
  leadingZero: false,
  marker: true,
  timezone: "local",
  speed: 2,
  syncMinutes: 1,
  sessionMinutes: 0
});

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

const MINI = {
  "0": ["11", "10", "10", "01", "11"],
  "1": ["01", "11", "01", "01", "11"],
  "2": ["11", "01", "11", "10", "11"],
  "3": ["11", "01", "11", "01", "11"],
  "4": ["11", "11", "11", "01", "01"],
  "5": ["11", "10", "11", "01", "11"],
  "6": ["11", "10", "11", "11", "11"],
  "7": ["11", "01", "01", "01", "01"],
  "8": ["11", "10", "11", "01", "11"],
  "9": ["11", "11", "11", "01", "11"],
  " ": ["00", "00", "00", "00", "00"]
};

const ROUNDED = {
  "0": ["01110", "11011", "10101", "10101", "10101", "11011", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["10010", "10010", "10010", "11111", "00010", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
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

function blockGlyph(character) {
  const source = TALL[character] || TALL[" "];
  return source.map((row) => `${row[0]}${row[1]}${row[1]}${row[2]}`);
}

function glyphFor(character, font) {
  if (font === "matrix") return MATRIX[character] || MATRIX[" "];
  if (font === "mini") return MINI[character] || MINI[" "];
  if (font === "block") return blockGlyph(character);
  if (font === "rounded") return ROUNDED[character] || ROUNDED[" "];
  if (font === "wide") return wideGlyph(character);
  if (font === "segment" && /\d/.test(character)) return segmentGlyph(character);
  return TALL[character] || TALL[" "];
}

function normalizeChoice(value, choices, fallback) {
  return choices.some(([id]) => id === value) ? value : fallback;
}

export function normalizeClockSettings(settings = {}) {
  const validCustomBorder = typeof settings.customBorder === "string" && [PERIMETER_PIXEL_COUNT, CLOCK_BORDER_PIXEL_COUNT].includes(settings.customBorder.length) && /^[01]+$/.test(settings.customBorder);
  const customBorder = validCustomBorder ? normalizeCustomBorder(settings.customBorder) : DEFAULT_CLOCK_SETTINGS.customBorder;
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
    customBorder,
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

function drawBorder(rows, settings, phase) {
  const style = settings.border;
  if (style === "none") return;
  if (style === "custom") {
    const borderRows = clockBorderRows(settings.customBorder);
    const customizable = clockCustomizableRows(settings);
    for (let y = 0; y < DISPLAY_HEIGHT; y += 1) for (let x = 0; x < DISPLAY_WIDTH; x += 1) rows[y][x] ||= borderRows[y][x] && customizable[y][x];
    return;
  }
  BORDER_POSITIONS.forEach(([x, y], index) => {
    if (borderMatches(style, x, y, index)) rows[y][x] = true;
    if (style === "chase" && (index + phase) % 4 === 0) rows[y][x] = true;
    if (style === "marquee" && (Math.floor((index + phase * 2) / 2) % 2 === 0)) rows[y][x] = true;
    if (style === "orbit" && ((index - phase * 7 + PERIMETER_PIXEL_COUNT) % PERIMETER_PIXEL_COUNT) < 5) rows[y][x] = true;
  });
}

function renderFace(date, settings, phase, yOffset = 0, includeBorder = true) {
  const rows = blank();
  const { hourText, minuteText, marker } = clockTimeParts(date, settings);
  const displayHour = hourText.startsWith(" ") ? hourText.trimStart() : hourText;
  const text = `${displayHour}:${minuteText}`;
  const digitGlyph = glyphFor("8", settings.font);
  const digitWidth = digitGlyph[0].length;
  const digitHeight = digitGlyph.length;
  const colonWidth = 1;
  const markerGlyph = glyphFor(marker, settings.font === "matrix" ? "matrix" : "tall");
  const markerWidth = settings.format === "12" && settings.marker ? markerGlyph[0].length + 2 : 0;
  const digitCount = [...text].filter((character) => /\d/.test(character)).length;
  const textWidth = digitWidth * digitCount + colonWidth + text.length - 1 + markerWidth;
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
  if (includeBorder) drawBorder(rows, settings, phase);
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

function clockPhaseCount(settings) {
  return settings.animation === "bounce" ? 4 : settings.animation === "static" ? 1 : 2;
}

function dateForClockValue(hour, minute, timezone) {
  const date = new Date(0);
  if (timezone === "utc") {
    date.setUTCFullYear(2026, 0, 1);
    date.setUTCHours(hour, minute, 0, 0);
  } else {
    date.setFullYear(2026, 0, 1);
    date.setHours(hour, minute, 0, 0);
  }
  return date;
}

export function clockCustomizableRows(rawSettings = DEFAULT_CLOCK_SETTINGS) {
  const settings = normalizeClockSettings(rawSettings);
  const cacheKey = JSON.stringify({
    font: settings.font,
    format: settings.format,
    leadingZero: settings.leadingZero,
    marker: settings.marker,
    animation: settings.animation,
    timezone: settings.timezone,
    framed: settings.border !== "none"
  });
  if (customizableRowsCache.has(cacheKey)) return customizableRowsCache.get(cacheKey);
  const reserved = blank();
  const bounce = [0, -1, 0, 1];
  const phaseCount = clockPhaseCount(settings);
  for (let hour = 0; hour < 24; hour += 1) for (let minute = 0; minute < 60; minute += 1) {
    const date = dateForClockValue(hour, minute, settings.timezone);
    for (let phase = 0; phase < phaseCount; phase += 1) {
      let frame = renderFace(date, settings, phase, settings.animation === "bounce" ? bounce[phase] : 0, false);
      if (settings.animation === "pulse" && phase % 2 === 1) frame = dilate(frame, settings.border);
      for (let y = 0; y < DISPLAY_HEIGHT; y += 1) for (let x = 0; x < DISPLAY_WIDTH; x += 1) reserved[y][x] ||= frame[y][x];
    }
  }
  const customizable = reserved.map((row) => row.map((pixel) => !pixel));
  customizableRowsCache.set(cacheKey, customizable);
  return customizable;
}

export function createClockFrames(date = new Date(), rawSettings = DEFAULT_CLOCK_SETTINGS) {
  const settings = normalizeClockSettings(rawSettings);
  const animationFrames = clockPhaseCount(settings);
  const count = ["chase", "marquee", "orbit"].includes(settings.border) ? Math.max(4, animationFrames) : animationFrames;
  const bounce = [0, -1, 0, 1];
  return Array.from({ length: count }, (_, phase) => {
    let frame = renderFace(date, settings, phase, settings.animation === "bounce" ? bounce[phase % bounce.length] : 0, false);
    if (settings.animation === "pulse" && phase % 2 === 1) frame = dilate(frame, settings.border);
    drawBorder(frame, settings, phase);
    return frame;
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
