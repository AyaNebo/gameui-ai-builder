// UI design directions (milestone 2, section 9-10). Each direction is a full
// DesignSystem — the same shape defaultDesignSystem() produces — so applying
// one is just "replace the current token set," and every component that
// references a token (rather than a local override) updates immediately.
// This is deliberately not a "theme system": five fixed factories, no
// per-direction component logic, Cozy the most developed per the brief.
import { typographyIds, colorIds, spacingIds, radiusIds, type DesignSystem } from "./designSystem";
import { designDirections, type DesignDirection } from "@/ai/schemas";
export { designDirections, type DesignDirection };
function typography(
  fontFamily: string,
  sizes: [number, number, number, number, number],
  weights: [number, number, number, number, number],
  lineHeight: number,
): DesignSystem["typography"] {
  return Object.fromEntries(
    typographyIds.map((id, i) => [
      id,
      {
        id,
        name: id[0].toUpperCase() + id.slice(1),
        fontFamily,
        fontSize: sizes[i],
        fontWeight: weights[i],
        lineHeight,
      },
    ]),
  ) as DesignSystem["typography"];
}
function colors(values: [string, string, string, string, string, string, string]): DesignSystem["colors"] {
  const names = [
    "Primary",
    "Secondary",
    "Surface",
    "TextPrimary",
    "TextSecondary",
    "Warning",
    "Success",
  ];
  return Object.fromEntries(
    colorIds.map((id, i) => [id, { id, name: names[i], value: values[i] }]),
  ) as DesignSystem["colors"];
}
function spacing(values: [number, number, number, number, number]): DesignSystem["spacing"] {
  return Object.fromEntries(
    spacingIds.map((id, i) => [id, { id, name: id.toUpperCase(), value: values[i] }]),
  ) as DesignSystem["spacing"];
}
function radius(values: [number, number, number]): DesignSystem["radius"] {
  return Object.fromEntries(
    radiusIds.map((id, i) => [id, { id, name: id.toUpperCase(), value: values[i] }]),
  ) as DesignSystem["radius"];
}
const COZY_FONT =
  "Quicksand, 'Century Gothic', Futura, 'Trebuchet MS', Arial, sans-serif";
// Cozy gets the most polish per the brief: warm, muted palette (not pink),
// generous rounding, friendly weights, and roomier line height.
function cozy(): DesignSystem {
  return {
    typography: typography(
      COZY_FONT,
      [66, 46, 28, 22, 16],
      [700, 700, 500, 600, 500],
      1.4,
    ),
    colors: colors([
      "#e3a96e", // Primary — warm amber
      "#8fb98f", // Secondary — sage green
      "#3a2f28e6", // Surface — warm dark-cocoa panel
      "#fbf3e7", // TextPrimary — soft cream
      "#cdbba4", // TextSecondary — muted tan
      "#e0a458", // Warning — soft amber, not alarming red
      "#8fbf8a", // Success — sage green
    ]),
    spacing: spacing([6, 10, 18, 28, 36]),
    radius: radius([14, 22, 32]),
  };
}
function arcade(): DesignSystem {
  return {
    typography: typography(
      "Arial",
      [70, 46, 27, 21, 16],
      [800, 800, 700, 700, 600],
      1.15,
    ),
    colors: colors([
      "#ffce3d", // Primary — electric yellow
      "#ff5b6e", // Secondary — hot coral
      "#151024e6", // Surface — near-black violet panel
      "#ffffff",
      "#c9b8ff",
      "#ff4d4d",
      "#39e88f",
    ]),
    spacing: spacing([4, 8, 14, 20, 28]),
    radius: radius([4, 8, 14]),
  };
}
function minimal(): DesignSystem {
  return {
    typography: typography(
      "Arial",
      [58, 40, 25, 19, 14],
      [500, 500, 400, 500, 400],
      1.3,
    ),
    colors: colors([
      "#e7e9ee",
      "#9aa2b1",
      "#14161ae6",
      "#f4f5f7",
      "#8b93a2",
      "#e0b34d",
      "#6fd6a8",
    ]),
    spacing: spacing([4, 8, 16, 24, 32]),
    radius: radius([2, 6, 10]),
  };
}
function fantasy(): DesignSystem {
  return {
    typography: typography(
      "Georgia, 'Times New Roman', serif",
      [64, 44, 26, 20, 15],
      [700, 700, 500, 600, 500],
      1.3,
    ),
    colors: colors([
      "#c9a24b", // Primary — old gold
      "#7c5cbf", // Secondary — arcane purple
      "#241a33e6", // Surface — deep royal violet
      "#f3e9d2", // TextPrimary — parchment
      "#b7a6cf",
      "#e2a13c",
      "#6fbf8f",
    ]),
    spacing: spacing([5, 9, 17, 26, 34]),
    radius: radius([6, 12, 20]),
  };
}
function sciFi(): DesignSystem {
  return {
    typography: typography(
      "'Trebuchet MS', Arial, sans-serif",
      [60, 40, 24, 19, 14],
      [600, 600, 500, 600, 500],
      1.2,
    ),
    colors: colors([
      "#4fe3ff", // Primary — electric cyan
      "#7a5cff", // Secondary — ultraviolet
      "#0a0e16e6", // Surface — near-black
      "#eafcff",
      "#7f93a8",
      "#ff5c5c",
      "#4fffb0",
    ]),
    spacing: spacing([4, 8, 14, 22, 30]),
    radius: radius([1, 3, 6]),
  };
}
const directionFactories: Record<DesignDirection, () => DesignSystem> = {
  Cozy: cozy,
  Arcade: arcade,
  Minimal: minimal,
  Fantasy: fantasy,
  "Sci-Fi": sciFi,
};
export function designSystemForDirection(direction: DesignDirection): DesignSystem {
  return directionFactories[direction]();
}
