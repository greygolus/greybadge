import test from "node:test";
import assert from "node:assert/strict";
import { CLOCK_ANIMATIONS, CLOCK_BORDERS, CLOCK_FONTS, clockSyncKey, clockTimeParts, createClockFrames, createClockSlot, normalizeClockSettings, secondsUntilClockSync } from "../clock.js";
import { buildPayload } from "../protocol.js";

const localDate = new Date(2026, 6, 13, 9, 5, 0);

test("formats 12 and 24 hour clock values", () => {
  assert.deepEqual(clockTimeParts(localDate, { format: "12", leadingZero: false }), { hourText: " 9", minuteText: "05", marker: "A" });
  assert.deepEqual(clockTimeParts(localDate, { format: "24" }), { hourText: "09", minuteText: "05", marker: "A" });
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
  const settings = normalizeClockSettings({ font: "missing", border: "bad", animation: "nope", speed: 99, sessionMinutes: 999 });
  assert.equal(settings.font, "tall");
  assert.equal(settings.border, "corners");
  assert.equal(settings.animation, "colon");
  assert.equal(settings.speed, 8);
  assert.equal(settings.syncMinutes, 1);
  assert.equal(settings.sessionMinutes, 0);
});
