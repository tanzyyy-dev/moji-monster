import assert from "node:assert/strict";
import test from "node:test";
import { extendPaper, paperTransform, paperViewport } from "../src/components/drawing-editor/paper.mjs";

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

test("drawing in the newly visible margin grows the paper in place", () => {
  const area = { x: 0, y: 0, width: 380, height: 300 };
  const view = paperTransform(area, 760, 300);
  assert.equal(extendPaper(area, { x: 30, y: 50 }, view, 760, 300), area);
  const expanded = extendPaper(area, { x: -100, y: 50 }, view, 760, 300);
  assert.deepEqual(expanded, { x: -190, y: 0, width: 760, height: 300 });
  assert.deepEqual(paperTransform(expanded, 760, 300), view);
  assert.deepEqual(paperTransform(expanded, 380, 300), { x: 95, y: 75, scale: 0.5 });
});
