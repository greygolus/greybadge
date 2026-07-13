import test from "node:test";
import assert from "node:assert/strict";
import {
  CLOCK_ANIMATIONS,
  CLOCK_BORDER_PIXEL_COUNT,
  CLOCK_BORDERS,
  CLOCK_FONTS,
  clockBorderPositionIndex,
  clockBorderRows,
  clockCustomizableRows,
  clockSyncKey,
  clockTimeParts,
  createClockBorderPattern,
  createClockFrames,
  createClockSlot,
  normalizeClockSettings,
  secondsUntilClockSync
} from "../clock.js";
import { buildPayload } from "../protocol.js";

const localDate = new Date(2026, 6, 13, 9, 5, 0);

test("formats 12 and 24 hour clock values", () => {
  assert.deepEqual(clockTimeParts(localDate, { format: "12", leadingZero: false }), { hourText: " 9", minuteText: "05", marker: "A" });
  assert.deepEqual(clockTimeParts(localDate, { format: "24" }), { hourText: "09", minuteText: "05", marker: "A" });
});

test("single-digit hours are centered without reserving a hidden zero", () => {
  const bounds = (frame) => {
    const litColumns = frame.flatMap((row) => row.map((pixel, x) => pixel ? x : -1)).filter((x) => x >= 0);
    const min = Math.min(...litColumns);
    const max = Math.max(...litColumns);
    return { min, max, width: max - min + 1, center: (min + max) / 2 };
  };
  const options = { format: "12", marker: false, border: "none", animation: "static", font: "tall" };
  const compact = bounds(createClockFrames(localDate, { ...options, leadingZero: false })[0]);
  const padded = bounds(createClockFrames(localDate, { ...options, leadingZero: true })[0]);
  assert.ok(compact.width < padded.width);
  assert.ok(Math.abs(compact.center - 21.5) <= 0.5);
});

test("custom clock decorations store the full display", () => {
  const solid = createClockBorderPattern("solid");
  const clear = createClockBorderPattern("clear");
  assert.equal(solid.length, CLOCK_BORDER_PIXEL_COUNT);
  assert.equal(solid, "1".repeat(CLOCK_BORDER_PIXEL_COUNT));
  assert.equal(clear, "0".repeat(CLOCK_BORDER_PIXEL_COUNT));
  assert.equal(clockBorderPositionIndex(0, 0), 0);
  assert.equal(clockBorderPositionIndex(43, 10), CLOCK_BORDER_PIXEL_COUNT - 1);
  assert.equal(clockBorderPositionIndex(12, 5), 232);
  const rows = clockBorderRows(solid);
  assert.ok(rows.flat().every(Boolean));
});

test("old perimeter-only borders migrate into the full-display format", () => {
  const migrated = normalizeClockSettings({ customBorder: "1".repeat(106) }).customBorder;
  assert.equal(migrated.length, CLOCK_BORDER_PIXEL_COUNT);
  const rows = clockBorderRows(migrated);
  assert.ok(rows[0].every(Boolean) && rows[10].every(Boolean));
  assert.ok(rows.slice(1, -1).every((row) => row[0] && row[43] && row.slice(1, -1).every((pixel) => !pixel)));
});

test("custom decorations expose interior pixels without ever covering possible clock pixels", () => {
  for (const animation of ["bounce", "pulse"]) {
    const settings = { font: "tall", format: "12", leadingZero: false, marker: true, border: "custom", animation };
    const editable = clockCustomizableRows(settings);
    const editableCount = editable.flat().filter(Boolean).length;
    assert.ok(editableCount > 106, "the editor should expose more than the perimeter");
    assert.ok(editableCount < CLOCK_BORDER_PIXEL_COUNT, "the changing time area must stay protected");
    assert.ok(editable.slice(1, -1).some((row) => row.slice(1, -1).some(Boolean)), "some interior pixels should be editable");

    const clearFrames = createClockFrames(localDate, { ...settings, customBorder: createClockBorderPattern("clear") });
    const filledFrames = createClockFrames(localDate, { ...settings, customBorder: createClockBorderPattern("solid") });
    for (let frameIndex = 0; frameIndex < clearFrames.length; frameIndex += 1) {
      for (let y = 0; y < 11; y += 1) for (let x = 0; x < 44; x += 1) {
        if (editable[y][x]) assert.equal(filledFrames[frameIndex][y][x], true);
        else assert.equal(filledFrames[frameIndex][y][x], clearFrames[frameIndex][y][x]);
      }
    }
  }
});

test("animated border families produce self-playing frame loops", () => {
  for (const border of ["chase", "marquee", "orbit"]) {
    const frames = createClockFrames(localDate, { border, animation: "static" });
    assert.equal(frames.length, 4);
    assert.notDeepEqual(frames[0], frames[1]);
  }
});

test("every clock customization renders valid badge frames", () => {
  for (const [font] of CLOCK_FONTS) for (const [border] of CLOCK_BORDERS) for (const [animation] of CLOCK_ANIMATIONS) {
    const frames = createClockFrames(localDate, { font, border, animation });
    assert.ok(frames.length >= 1 && frames.length <= 4, `${font}/${border}/${animation}`);
    for (const frame of frames) {
      assert.equal(frame.length, 11);
      assert.ok(frame.every((row) => row.length === 44));
      assert.ok(frame.flat().some(Boolean), `${font}/${border}/${animation} should light pixels`);
    }
  }
});

test("clock slots use animation mode when needed and fit badge storage", () => {
  const animated = createClockSlot(localDate, { animation: "colon", border: "chase" });
  const still = createClockSlot(localDate, { animation: "static", border: "none" });
  assert.equal(animated.mode, 5);
  assert.equal(still.mode, 4);
  assert.ok(buildPayload([animated]).paddedBytes <= 8192);
});

test("exact and low-wear sync schedules use stable time buckets", () => {
  const atFiveSeconds = new Date(2026, 6, 13, 9, 5, 5);
  const atNextMinute = new Date(2026, 6, 13, 9, 6, 0);
  assert.notEqual(clockSyncKey(atFiveSeconds, { syncMinutes: 1 }), clockSyncKey(atNextMinute, { syncMinutes: 1 }));
  assert.equal(clockSyncKey(atFiveSeconds, { syncMinutes: 5 }), clockSyncKey(atNextMinute, { syncMinutes: 5 }));
  assert.equal(secondsUntilClockSync(atFiveSeconds, { syncMinutes: 1 }), 55);
  assert.equal(secondsUntilClockSync(atFiveSeconds, { syncMinutes: 5 }), 295);
});

test("invalid saved clock settings migrate back to safe defaults", () => {
  const settings = normalizeClockSettings({ font: "missing", border: "bad", customBorder: "not pixels", animation: "nope", speed: 99, sessionMinutes: 999 });
  assert.equal(settings.font, "tall");
  assert.equal(settings.border, "corners");
  assert.equal(settings.animation, "colon");
  assert.equal(settings.speed, 8);
  assert.equal(settings.syncMinutes, 1);
  assert.equal(settings.sessionMinutes, 0);
  assert.equal(settings.customBorder, createClockBorderPattern("corners"));
});
