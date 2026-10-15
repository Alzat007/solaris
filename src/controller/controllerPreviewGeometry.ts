/** The mirrored pointer is image-relative; the preview uses object-fit: contain. */
export function controllerPreviewPoint(
  point: { x: number; y: number },
  width: number,
  height: number,
) {
  const stageAspect = 4 / 3;
  const videoAspect =
    Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
      ? width / height
      : stageAspect;
  const contentWidth = Math.min(1, videoAspect / stageAspect);
  const contentHeight = Math.min(1, stageAspect / videoAspect);
  return {
    x: (1 - contentWidth) / 2 + point.x * contentWidth,
    y: (1 - contentHeight) / 2 + point.y * contentHeight,
  };
}
