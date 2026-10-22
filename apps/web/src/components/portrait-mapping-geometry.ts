import type { NamedPoint, XY } from "@freeharmony/engine";

export interface PhotoBounds { x: number; y: number; width: number; height: number }

export const finitePoint = (point: XY | undefined): point is XY => !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
export const normalizedPoint = (point: XY | undefined): point is XY => finitePoint(point) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;

/** A template or an unconfirmed anatomical estimate is never drawn as an observation. */
export function observedAnchor(point: NamedPoint | undefined): point is NamedPoint {
  return !!point && normalizedPoint(point) && point.source !== "template" &&
    ["mesh", "contour", "manual", "estimated"].includes(point.source) &&
    (point.source !== "estimated" || point.reviewed) &&
    (point.confidence === undefined || Number.isFinite(point.confidence) && point.confidence >= 0 && point.confidence <= 1) &&
    (point.reviewed || point.source === "manual" || (point.confidence ?? 1) >= .3);
}

/** Crop is presentation only: its bounds come from observed normalized points. */
export function observedFaceBounds(points: readonly XY[]): PhotoBounds | null {
  const usable = points.filter(normalizedPoint);
  if (usable.length < 3) return null;
  const left = Math.min(...usable.map(p => p.x)), right = Math.max(...usable.map(p => p.x));
  const top = Math.min(...usable.map(p => p.y)), bottom = Math.max(...usable.map(p => p.y));
  const width = right - left, height = bottom - top;
  if (width < .02 || height < .02) return null;
  const x = Math.max(0, left - width * .18), y = Math.max(0, top - height * .22);
  return { x, y, width: Math.min(1, right + width * .18) - x, height: Math.min(1, bottom + height * .18) - y };
}

/** One uniform scale maps both the photograph and every overlay, with letterboxing. */
export function projectPortrait(imageWidth: number, imageHeight: number, stageWidth: number, stageHeight: number, crop: PhotoBounds, margin = 0) {
  if (![imageWidth, imageHeight, stageWidth, stageHeight, crop.width, crop.height].every(n => Number.isFinite(n) && n > 0)) return null;
  const source = { x: crop.x * imageWidth, y: crop.y * imageHeight, width: crop.width * imageWidth, height: crop.height * imageHeight };
  const scale = Math.min(Math.max(1, stageWidth - margin * 2) / source.width, Math.max(1, stageHeight - margin * 2) / source.height);
  const width = source.width * scale, height = source.height * scale;
  const destination = { x: (stageWidth - width) / 2, y: (stageHeight - height) / 2, width, height };
  return { source, destination, scale, map: (point: XY): XY => ({ x: destination.x + (point.x * imageWidth - source.x) * scale, y: destination.y + (point.y * imageHeight - source.y) * scale }) };
}
