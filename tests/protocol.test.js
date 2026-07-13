import test from "node:test";
import assert from "node:assert/strict";
import { buildPayload, createHeader, pixelsToBadgeBytes } from "../protocol.js";

const date = new Date(2022, 10, 13, 17, 38, 24);

test("header matches the documented CH546 protocol", () => {
  const header = createHeader([
    { columns: 6, speed: 5, mode: 6, blink: false, ants: true },
    { columns: 7, speed: 3, mode: 2, blink: true, ants: false }
  ], 75, date);
  assert.deepEqual([...header.slice(0, 20)], [119, 97, 110, 103, 0, 16, 2, 1, 70, 34, 34, 34, 34, 34, 34, 34, 0, 6, 0, 7]);
  assert.deepEqual([...header.slice(38, 44)], [22, 11, 13, 17, 38, 24]);
});

test("packs horizontal pixels high-bit first", () => {
  const rows = Array.from({ length: 11 }, () => Array(9).fill(false));
  rows[0][0] = true;
  rows[0][7] = true;
  rows[0][8] = true;
  const result = pixelsToBadgeBytes(rows);
  assert.equal(result.columns, 2);
  assert.equal(result.bytes[0], 0b10000001);
  assert.equal(result.bytes[11], 0b10000000);
});

test("payload is padded to complete 64-byte HID reports", () => {
  const rows = Array.from({ length: 11 }, () => Array(44).fill(false));
  const result = buildPayload([{ rows, speed: 4, mode: 0 }], 100, date);
  assert.equal(result.usedBytes, 130);
  assert.equal(result.paddedBytes, 192);
  assert.equal(result.payload.length % 64, 0);
});
