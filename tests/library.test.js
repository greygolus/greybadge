import test from "node:test";
import assert from "node:assert/strict";
import {
  CINEMATICS,
  CONTENT_LIBRARY,
  CUSTOM_EFFECTS,
  FRAME_WIDTH,
  SHOWS,
  combineFrames,
  createCinematicPreview,
  createCinematicSlots,
  createCustomAnimation,
  getLibraryEntry,
} from "../library.js";
import { buildPayload } from "../protocol.js";

test("ships a large and varied content library", () => {
  assert.ok(CONTENT_LIBRARY.length >= 70);
  assert.ok(CONTENT_LIBRARY.filter((entry) => entry.kind === "animation").length >= 20);
  assert.ok(CONTENT_LIBRARY.filter((entry) => entry.category === "Icons").length >= 30);
  assert.ok(SHOWS.length >= 8);
  assert.ok(CINEMATICS.length >= 5);
});

test("cinematics span several consecutive slots with detailed continuous frames", () => {
  for (const cinematic of CINEMATICS) {
    assert.ok(cinematic.slots >= 3 && cinematic.slots <= 8, cinematic.id);
    assert.ok(cinematic.totalFrames >= 60, cinematic.id);
    assert.equal(cinematic.totalFrames, cinematic.slots * cinematic.framesPerSlot, cinematic.id);

    const slots = createCinematicSlots(cinematic);
    assert.equal(slots.length, cinematic.slots, cinematic.id);
    for (const slot of slots) {
      assert.equal(slot.source, "cinematic", cinematic.id);
      assert.equal(slot.mode, 5, cinematic.id);
      assert.equal(slot.rows.length, 11, cinematic.id);
      assert.ok(slot.rows.every((row) => row.length === FRAME_WIDTH * cinematic.framesPerSlot), cinematic.id);
    }

    const preview = createCinematicPreview(cinematic);
    assert.equal(preview.length, 11, cinematic.id);
    assert.ok(preview.every((row) => row.length === FRAME_WIDTH * cinematic.totalFrames), cinematic.id);
    const signatures = new Set(Array.from({ length: cinematic.totalFrames }, (_, frame) =>
      preview.map((row) => row.slice(frame * FRAME_WIDTH, (frame + 1) * FRAME_WIDTH).map(Number).join("")).join("|")
    ));
    assert.ok(signatures.size > cinematic.totalFrames / 2, `${cinematic.id}: ${signatures.size} unique frames`);
  }
});

test("every long-form cinematic fits safely in badge storage", () => {
  for (const cinematic of CINEMATICS) {
    const result = buildPayload(createCinematicSlots(cinematic));
    assert.ok(result.paddedBytes <= 8192, `${cinematic.id}: ${result.paddedBytes}`);
  }
});

test("every library item produces valid 11-row badge pixels", () => {
  for (const entry of CONTENT_LIBRARY) {
    const rows = entry.generate();
    assert.equal(rows.length, 11, entry.id);
    assert.ok(rows[0].length > 0, entry.id);
    assert.ok(rows.every((row) => row.length === rows[0].length), entry.id);
    if (entry.kind === "animation") assert.equal(rows[0].length % FRAME_WIDTH, 0, entry.id);
  }
});

test("every show points to real library content", () => {
  for (const show of SHOWS) {
    assert.ok(show.entries.length > 1 && show.entries.length <= 8);
    for (const id of show.entries) assert.ok(getLibraryEntry(id), `${show.id}: ${id}`);
  }
});

test("every premade show fits safely in badge storage", () => {
  for (const show of SHOWS) {
    const slots = show.entries.map((id) => {
      const entry = getLibraryEntry(id);
      return { rows: entry.generate(), speed: entry.speed, mode: entry.mode };
    });
    const result = buildPayload(slots);
    assert.ok(result.paddedBytes <= 8192, `${show.id}: ${result.paddedBytes}`);
  }
});

test("effect lab creates all custom effects at requested frame count", () => {
  const source = Array.from({ length: 11 }, (_, y) => Array.from({ length: 44 }, (_, x) => x === y));
  for (const [effect] of CUSTOM_EFFECTS) {
    const rows = createCustomAnimation(source, effect, 7);
    assert.equal(rows.length, 11, effect);
    assert.equal(rows[0].length, FRAME_WIDTH * 7, effect);
  }
});

test("frame studio combines editable 44-column frames into padded badge frames", () => {
  const first = Array.from({ length: 11 }, () => Array(44).fill(false));
  const second = Array.from({ length: 11 }, () => Array(44).fill(false));
  first[2][3] = true;
  second[8][40] = true;

  const rows = combineFrames([first, second]);
  assert.equal(rows.length, 11);
  assert.equal(rows[0].length, FRAME_WIDTH * 2);
  assert.equal(rows[2][3], true);
  assert.equal(rows[8][FRAME_WIDTH + 40], true);
  assert.ok(rows.every((row) => row.slice(44, FRAME_WIDTH).every((pixel) => pixel === false)));
});
