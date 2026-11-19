import assert from "node:assert/strict";
import test from "node:test";
import { paperViewport } from "../src/components/drawing-editor/paper.mjs";

test("the empty editor uses its available canvas as the drawing surface", () => {
  assert.deepEqual(paperViewport(null, 360, 180), {
    x: 0, y: 0, width: 360, height: 180,
  });
});

test("rotation fits the original paper uniformly and centers it", () => {
  const paper = { width: 360, height: 180 };
  assert.deepEqual(paperViewport(paper, 432, 108), {
    x: 108, y: 0, width: 216, height: 108,
  });
  assert.deepEqual(paperViewport(paper, 180, 360), {
    x: 0, y: 135, width: 180, height: 90,
  });
  assert.deepEqual(paperViewport(paper, 360, 180), {
    x: 0, y: 0, width: 360, height: 180,
  });
  assert.deepEqual(paper, { width: 360, height: 180 });
});
