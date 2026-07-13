export const BADGE_VENDOR_ID = 0x0416;
export const BADGE_PRODUCT_ID = 0x5020;
export const DISPLAY_WIDTH = 44;
export const DISPLAY_HEIGHT = 11;
export const MAX_BYTES = 8192;

export const MODES = [
  "Scroll left",
  "Scroll right",
  "Scroll up",
  "Scroll down",
  "Still / centered",
  "Frame animation",
  "Drop down",
  "Curtain",
  "Laser"
];

const HEADER_TEMPLATE = [
  0x77, 0x61, 0x6e, 0x67, 0x00, 0x00, 0x00, 0x00,
  0x40, 0x40, 0x40, 0x40, 0x40, 0x40, 0x40, 0x40,
  ...new Array(48).fill(0)
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));

export function createHeader(slots, brightness = 100, date = new Date()) {
  if (!slots.length || slots.length > 8) throw new RangeError("Use between 1 and 8 message slots.");
  const header = [...HEADER_TEMPLATE];
  const level = clamp(brightness, 1, 100);
  header[5] = level <= 25 ? 0x40 : level <= 50 ? 0x20 : level <= 75 ? 0x10 : 0x00;

  slots.forEach((slot, index) => {
    const columns = clamp(slot.columns, 0, 0xffff);
    const speed = clamp(slot.speed ?? 4, 1, 8) - 1;
    const mode = clamp(slot.mode ?? 0, 0, 8);
    if (slot.blink) header[6] |= 1 << index;
    if (slot.ants) header[7] |= 1 << index;
    header[8 + index] = speed * 16 + mode;
    header[16 + index * 2] = Math.floor(columns / 256);
    header[17 + index * 2] = columns % 256;
  });

  // The badge expects unused effect bytes to repeat the last configured slot.
  const last = slots.at(-1);
  for (let index = slots.length; index < 8; index += 1) {
    const speed = clamp(last.speed ?? 4, 1, 8) - 1;
    const mode = clamp(last.mode ?? 0, 0, 8);
    header[8 + index] = speed * 16 + mode;
  }

  header[38] = date.getFullYear() % 100;
  header[39] = date.getMonth() + 1;
  header[40] = date.getDate();
  header[41] = date.getHours();
  header[42] = date.getMinutes();
  header[43] = date.getSeconds();
  return Uint8Array.from(header);
}

export function pixelsToBadgeBytes(rows) {
  if (!Array.isArray(rows) || rows.length !== DISPLAY_HEIGHT) {
    throw new TypeError(`Bitmap must contain exactly ${DISPLAY_HEIGHT} rows.`);
  }
  const width = Math.max(1, ...rows.map((row) => row.length));
  const columns = Math.ceil(width / 8);
  const bytes = new Uint8Array(columns * DISPLAY_HEIGHT);
  for (let column = 0; column < columns; column += 1) {
    for (let y = 0; y < DISPLAY_HEIGHT; y += 1) {
      let value = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        if (rows[y][column * 8 + bit]) value |= 1 << (7 - bit);
      }
      bytes[column * DISPLAY_HEIGHT + y] = value;
    }
  }
  return { bytes, columns, width };
}

export function buildPayload(slots, brightness = 100, date = new Date()) {
  const prepared = slots.map((slot) => {
    const encoded = pixelsToBadgeBytes(slot.rows);
    return { ...slot, ...encoded };
  });
  const rawLength = 64 + prepared.reduce((sum, slot) => sum + slot.bytes.length, 0);
  const paddedLength = Math.ceil(rawLength / 64) * 64;
  if (paddedLength > MAX_BYTES) {
    throw new RangeError(`Design needs ${paddedLength} bytes; badge limit is ${MAX_BYTES}.`);
  }
  const payload = new Uint8Array(paddedLength);
  payload.set(createHeader(prepared, brightness, date), 0);
  let offset = 64;
  for (const slot of prepared) {
    payload.set(slot.bytes, offset);
    offset += slot.bytes.length;
  }
  return { payload, prepared, usedBytes: rawLength, paddedBytes: paddedLength };
}

export async function writePayload(device, payload, onProgress = () => {}) {
  if (!device.opened) await device.open();
  const packets = payload.length / 64;
  for (let index = 0; index < packets; index += 1) {
    await device.sendReport(0, payload.slice(index * 64, index * 64 + 64));
    onProgress((index + 1) / packets);
  }
}
