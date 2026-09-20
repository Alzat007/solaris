import test from "node:test";
import assert from "node:assert/strict";
import { settleDialScale } from "../src/gesture/dialScale";
import { gestureConfig as config } from "../src/gesture/gestureConfig";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test("stopping a dial leaves at most a small settling distance in either direction", () => {
  close(settleDialScale(1.5, 1), 1 + config.V_ZOOM_RELEASE_SETTLE_MAX);
  close(settleDialScale(0.5, 1), 1 - config.V_ZOOM_RELEASE_SETTLE_MAX);
});

test("a target already close to the rendered scale is preserved", () => {
  close(settleDialScale(1.006, 1), 1.006);
  close(settleDialScale(0.994, 1), 0.994);
  close(settleDialScale(1, 1), 1);
});

test("settling respects zoom limits, including inputs outside the physical range", () => {
  close(settleDialScale(4, config.V_ZOOM_MAX), config.V_ZOOM_MAX);
  close(settleDialScale(-2, config.V_ZOOM_MIN), config.V_ZOOM_MIN);
  close(
    settleDialScale(config.V_ZOOM_MAX, config.V_ZOOM_MAX - 0.003),
    config.V_ZOOM_MAX,
  );
  close(
    settleDialScale(config.V_ZOOM_MIN, config.V_ZOOM_MIN + 0.003),
    config.V_ZOOM_MIN,
  );
  for (const current of [
    -100,
    0,
    config.V_ZOOM_MIN,
    1,
    config.V_ZOOM_MAX,
    100,
  ]) {
    for (const target of [-100, 0, 1, 100]) {
      const value = settleDialScale(target, current);
      const boundedCurrent = Math.max(
        config.V_ZOOM_MIN,
        Math.min(config.V_ZOOM_MAX, current),
      );
      assert.ok(value >= config.V_ZOOM_MIN && value <= config.V_ZOOM_MAX);
      assert.ok(
        Math.abs(value - boundedCurrent) <=
          config.V_ZOOM_RELEASE_SETTLE_MAX + 1e-12,
      );
    }
  }
});

test("non-finite inputs cannot poison the scene scale", () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    close(settleDialScale(invalid, 1.2), 1.2);
    close(settleDialScale(1.2, invalid), 1.2);
    close(settleDialScale(invalid, invalid), 1);
    close(settleDialScale(invalid, 100), config.V_ZOOM_MAX);
    close(settleDialScale(-100, invalid), config.V_ZOOM_MIN);
  }
});
