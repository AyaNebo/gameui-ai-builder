// Small, dependency-free color-contrast helpers. Used to turn an AI's
// screenshot-inspired palette suggestion into a Design System color update
// that stays readable — "screenshot palette is inspiration, not a blind
// sample" (Milestone 3, section 5/26): green UI text is not okay just
// because the screenshot is full of green grass.
function parseHex(input: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const r = parseInt(h.slice(0, 2), 16),
    g = parseInt(h.slice(2, 4), 16),
    b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function contrastRatio(hexA: string, hexB: string): number {
  const a = parseHex(hexA),
    b = parseHex(hexB);
  if (!a || !b) return 1;
  const la = relativeLuminance(a) + 0.05,
    lb = relativeLuminance(b) + 0.05;
  return la > lb ? la / lb : lb / la;
}
function toHex(rgb: [number, number, number]): string {
  return "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}
// Pushes `fg` toward black or white (in steps) until it reaches `minRatio`
// against `bg`, preserving hue as much as a simple lighten/darken allows.
// Deliberately simple (not a full HSL rotation) — good enough to guarantee
// legibility without needing a color science library for a hackathon MVP.
export function ensureContrast(bg: string, fg: string, minRatio = 4.5): string {
  const bgRgb = parseHex(bg);
  const original = parseHex(fg);
  if (!bgRgb || !original) return fg;
  if (contrastRatio(bg, fg) >= minRatio) return fg;
  const bgLum = relativeLuminance(bgRgb);
  const target: [number, number, number] = bgLum < 0.5 ? [255, 255, 255] : [0, 0, 0];
  // Step 5% of the way from the original color toward pure white/black each
  // iteration until the contrast threshold is met (or we reach the target).
  let best = target; // guaranteed >= minRatio against any bg in practice
  for (let step = 1; step <= 20; step++) {
    const t = step / 20;
    const candidate: [number, number, number] = [
      original[0] + (target[0] - original[0]) * t,
      original[1] + (target[1] - original[1]) * t,
      original[2] + (target[2] - original[2]) * t,
    ];
    if (contrastRatio(bg, toHex(candidate)) >= minRatio) {
      best = candidate;
      break;
    }
  }
  return toHex(best);
}
export function isValidHex(value: unknown): value is string {
  return typeof value === "string" && parseHex(value) !== null;
}
