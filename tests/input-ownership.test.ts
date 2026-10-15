import test from "node:test";
import assert from "node:assert/strict";
import { InputOwnership } from "../src/input/InputOwnership";
test("local/TV input preempts mobile rotation and rejects immediate stale remote moves", () => {
  let stops = 0;
  const input = new InputOwnership(() => stops++);
  assert.equal(input.claim("remote", 100), true);
  input.preempt(120);
  assert.equal(stops, 1);
  assert.equal(input.claim("remote", 150), false);
  assert.equal(input.claim("tv", 160), true);
  assert.equal(input.claim("remote", 600), true);
  assert.equal(stops, 3);
});
test("silence, explicit stop and disconnect end ownership without stale releases stopping another source", () => {
  let stops = 0;
  const input = new InputOwnership(() => stops++);
  input.claim("remote", 100);
  assert.equal(input.checkTimeout(440), false);
  assert.equal(input.checkTimeout(451), true);
  assert.equal(input.owner, null);
  input.claim("tv", 800);
  input.release("remote");
  assert.equal(input.owner, "tv");
  input.release();
  assert.equal(stops, 2);
});
test("a held remote or mouse rotation cannot be stolen by a phone packet", () => {
  const input = new InputOwnership(() => {});
  input.hold("tv", 10);
  assert.equal(input.claim("remote", 10000), false);
  input.release("remote");
  assert.equal(input.owner, "tv");
  input.release("tv");
  assert.equal(input.hold("remote", 10001), true);
  input.preempt(10002);
  assert.equal(input.claim("remote", 10003), false);
});
test("a long local pointer hold blocks phone control until pointer release", () => {
  const input = new InputOwnership(() => {});
  input.preempt(10);
  input.hold("local", 11);
  assert.equal(input.claim("remote", 60000), false);
  input.release("local");
  assert.equal(input.claim("remote", 60001), true);
});
