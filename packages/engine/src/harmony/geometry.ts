import type { XY } from "./types";

export const DEG = 180 / Math.PI;
export function divide(n: number, d: number): number {
  if (!Number.isFinite(n) || !Number.isFinite(d) || Math.abs(d) < 1e-8) throw new Error("Two landmarks coincide or the reference dimension is zero.");
  return n / d;
}
export function positive(n: number): number {
  if (n <= 1e-8) throw new Error("The vertical landmark order is reversed or the dimension is zero. Check the marked points.");
  return n;
}
export const distance = (a: XY, b: XY) => Math.hypot(b.x - a.x, b.y - a.y);
export const midpoint = (a: XY, b: XY): XY => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const vector = (a: XY, b: XY): XY => ({ x: b.x - a.x, y: b.y - a.y });
export function between(a: XY, b: XY): number {
  const c = divide(a.x * b.x + a.y * b.y, Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}
export const angle = (a: XY, vertex: XY, b: XY) => between(vector(vertex, a), vector(vertex, b));
export function acute(direction: XY): number {
  if (Math.hypot(direction.x, direction.y) < 1e-8) throw new Error("The direction line has zero length.");
  return Math.atan2(Math.abs(direction.y), Math.abs(direction.x)) * DEG;
}
export function oriented(a: XY, vertex: XY, b: XY): number {
  const interior = angle(a, vertex, b);
  // In a right-facing, y-down image, a point in front of the upper-to-chin
  // line produces a negative cross product. Preserve concave reflex angles.
  const va = vector(vertex, a), vb = vector(vertex, b);
  return va.x * vb.y - va.y * vb.x <= 0 ? interior : 360 - interior;
}
/** Positive behind the line, negative in front, in a right-facing image. */
export function lineOffset(p: XY, top: XY, bottom: XY): number {
  const d = vector(top, bottom);
  return divide(d.x * (p.y - top.y) - d.y * (p.x - top.x), Math.hypot(d.x, d.y));
}
export function intersection(a: XY, b: XY, c: XY, d: XY): XY {
  const u = vector(a, b), v = vector(c, d);
  const t = divide((c.x - a.x) * v.y - (c.y - a.y) * v.x, u.x * v.y - u.y * v.x);
  return { x: a.x + t * u.x, y: a.y + t * u.y };
}
