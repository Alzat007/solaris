import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { rotation } from "../src/interaction/rotation";
import { particles } from "../src/particles/ParticleEngine";
import { inputOwnership, clearRemoteInput } from "../src/input/sharedInput";

function fixture(t: TestContext) {
  const saved = {
    rotation: particles.rotation,
    targetRotation: particles.targetRotation,
    rotationVelocity: particles.rotationVelocity,
    dragging: particles.dragging,
  };
  clearRemoteInput();
  Object.assign(particles, {
    rotation: 0,
    targetRotation: 1,
    rotationVelocity: 0,
    dragging: true,
  });
  t.after(() => {
    clearRemoteInput();
    Object.assign(particles, saved);
  });
}

test("local rotation retains its original exponential response", (t) => {
  fixture(t);
  rotation.followTarget(1 / 60);
  assert.ok(Math.abs(particles.rotation - (1 - Math.exp(-4 / 60))) < 1e-12);
});

test("remote target following reaches 90 percent in 200ms without overshooting", (t) => {
  fixture(t);
  for (let frame = 0; frame < 12; frame++) {
    const previous = particles.rotation;
    rotation.followTarget(1 / 60, true);
    assert.ok(particles.rotation > previous);
    assert.ok(particles.rotation < particles.targetRotation);
  }
  assert.ok(particles.rotation > 0.9);
  assert.ok(Math.abs(particles.rotation - (1 - Math.exp(-2.4))) < 1e-12);
});

test("a remote owner without an active drag does not accelerate passive motion", (t) => {
  fixture(t);
  particles.dragging = false;
  rotation.followTarget(0.1, true);
  assert.ok(Math.abs(particles.rotation - (1 - Math.exp(-0.4))) < 1e-12);
});

test("remote following is independent of render cadence", (t) => {
  fixture(t);
  for (const fps of [30, 60, 120]) {
    particles.rotation = 0;
    for (let frame = 0; frame < fps / 5; frame++)
      rotation.followTarget(1 / fps, true);
    assert.ok(Math.abs(particles.rotation - (1 - Math.exp(-2.4))) < 1e-12);
  }
});

test("irregular frames and direction reversals stay between pose and latest target", (t) => {
  fixture(t);
  for (const target of [0.2, 0.35, 0.1, -0.2, 0.5]) {
    particles.targetRotation = target;
    for (const dt of [0.016, 0.033, 0.008, 0.021, 0.05]) {
      const previous = particles.rotation;
      rotation.followTarget(dt, true);
      assert.ok(particles.rotation >= Math.min(previous, target));
      assert.ok(particles.rotation <= Math.max(previous, target));
    }
  }
});

test("invalid or non-positive frame time cannot move the pose", (t) => {
  fixture(t);
  for (const dt of [NaN, Infinity, -Infinity, -0.1, 0]) {
    rotation.followTarget(dt, true);
    assert.equal(particles.rotation, 0);
  }
});

test("remote release discards the unfollowed tail rather than drifting after release", (t) => {
  fixture(t);
  inputOwnership.hold("remote", 1000);
  rotation.followTarget(0.05, inputOwnership.owner === "remote");
  const pose = particles.rotation;
  assert.ok(pose > 0 && pose < 1);
  inputOwnership.release("remote");
  assert.equal(particles.targetRotation, pose);
  assert.equal(particles.dragging, false);
  for (let frame = 0; frame < 60; frame++) {
    rotation.update(1 / 60);
    rotation.followTarget(1 / 60, inputOwnership.owner === "remote");
  }
  assert.equal(particles.rotation, pose);
});

test("remote timeout freezes the current pose and local preemption keeps the old response", (t) => {
  fixture(t);
  inputOwnership.hold("remote", 1000);
  rotation.followTarget(0.05, inputOwnership.owner === "remote");
  const pose = particles.rotation;
  assert.equal(inputOwnership.checkTimeout(1351), true);
  rotation.followTarget(0.1, inputOwnership.owner === "remote");
  assert.equal(particles.rotation, pose);
  inputOwnership.preempt(1400);
  rotation.start();
  particles.targetRotation = pose + 1;
  rotation.followTarget(0.1, inputOwnership.owner === "remote");
  assert.ok(Math.abs(particles.rotation - pose - (1 - Math.exp(-0.4))) < 1e-12);
});
