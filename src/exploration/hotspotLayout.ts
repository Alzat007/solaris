export interface HotspotLabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Only labels move; their connected geographic anchors remain unchanged.
export function placeHotspotLabels(
  anchors: readonly HotspotLabelBox[],
  viewport: { width: number; height: number },
) {
  const top = 106,
    bottom = Math.max(top + 50, viewport.height - 90),
    gap = 12;
  const placed: HotspotLabelBox[] = [];
  const overlaps = (a: HotspotLabelBox, b: HotspotLabelBox) =>
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2 + gap;
  for (const anchor of anchors) {
    const box = {
      ...anchor,
      x: Math.max(
        anchor.width / 2 + gap,
        Math.min(viewport.width - anchor.width / 2 - gap, anchor.x),
      ),
      y: Math.max(
        top + anchor.height / 2,
        Math.min(bottom - anchor.height / 2, anchor.y),
      ),
    };
    const ys = [
      box.y,
      top + box.height / 2,
      bottom - box.height / 2,
      ...placed.flatMap((other) => [
        other.y - (other.height + box.height) / 2 - gap,
        other.y + (other.height + box.height) / 2 + gap,
      ]),
    ];
    const xs = [
      box.x,
      box.width / 2 + gap,
      viewport.width - box.width / 2 - gap,
      ...placed.flatMap((other) => [
        other.x - (other.width + box.width) / 2 - gap,
        other.x + (other.width + box.width) / 2 + gap,
      ]),
    ];
    const candidates = xs
      .flatMap((x) => ys.map((y) => ({ ...box, x, y })))
      .filter(
        (candidate) =>
          candidate.x >= candidate.width / 2 + gap &&
          candidate.x <= viewport.width - candidate.width / 2 - gap &&
          candidate.y >= top + candidate.height / 2 &&
          candidate.y <= bottom - candidate.height / 2 &&
          !placed.some((other) => overlaps(candidate, other)),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - box.x, a.y - box.y) -
          Math.hypot(b.x - box.x, b.y - box.y),
      );
    placed.push(candidates[0] ?? box);
  }
  return placed;
}
