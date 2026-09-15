import type { UIComponent, UIStyle } from "./schema";
export const typographyIds = [
  "display",
  "heading",
  "body",
  "label",
  "caption",
] as const;
export const colorIds = [
  "primary",
  "secondary",
  "surface",
  "textPrimary",
  "textSecondary",
  "warning",
  "success",
] as const;
export const spacingIds = ["xs", "s", "m", "l", "xl"] as const;
export const radiusIds = ["s", "m", "l"] as const;
export type TypographyId = (typeof typographyIds)[number];
export type ColorId = (typeof colorIds)[number];
export interface TypographyToken {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
}
export interface DesignSystem {
  typography: Record<TypographyId, TypographyToken>;
  colors: Record<ColorId, { id: string; name: string; value: string }>;
  spacing: Record<
    (typeof spacingIds)[number],
    { id: string; name: string; value: number }
  >;
  radius: Record<
    (typeof radiusIds)[number],
    { id: string; name: string; value: number }
  >;
}
export interface StyleTokens {
  typography?: TypographyId;
  color?: ColorId;
  backgroundColor?: ColorId;
  padding?: (typeof spacingIds)[number];
  borderRadius?: (typeof radiusIds)[number];
}
export type ResolvedStyle = UIStyle & {
  fontFamily: string;
  fontWeight: number;
  lineHeight: number;
};
export function defaultDesignSystem(): DesignSystem {
  return {
    typography: Object.fromEntries(
      typographyIds.map((id, i) => [
        id,
        {
          id,
          name: id[0].toUpperCase() + id.slice(1),
          fontFamily: "Arial",
          fontSize: [64, 44, 26, 20, 15][i],
          fontWeight: [700, 700, 400, 500, 400][i],
          lineHeight: 1.25,
        },
      ]),
    ) as DesignSystem["typography"],
    colors: Object.fromEntries(
      colorIds.map((id, i) => [
        id,
        {
          id,
          name: [
            "Primary",
            "Secondary",
            "Surface",
            "TextPrimary",
            "TextSecondary",
            "Warning",
            "Success",
          ][i],
          value: [
            "#b798ed",
            "#79b7d9",
            "#19222be6",
            "#ffffff",
            "#a8b5c8",
            "#f0ba58",
            "#40d7a0",
          ][i],
        },
      ]),
    ) as DesignSystem["colors"],
    spacing: Object.fromEntries(
      spacingIds.map((id, i) => [
        id,
        { id, name: id.toUpperCase(), value: [4, 8, 16, 24, 32][i] },
      ]),
    ) as DesignSystem["spacing"],
    radius: Object.fromEntries(
      radiusIds.map((id, i) => [
        id,
        { id, name: id.toUpperCase(), value: [4, 12, 24][i] },
      ]),
    ) as DesignSystem["radius"],
  };
}
/** Raw legacy fallback → referenced tokens → explicit per-property overrides. */
export function resolveStyle(c: UIComponent, ds: DesignSystem): ResolvedStyle {
  const refs = c.tokens ?? {};
  const typography = refs.typography
    ? ds.typography[refs.typography]
    : undefined;
  return {
    fontFamily: "Arial",
    fontWeight: 400,
    lineHeight: 1.25,
    ...c.style,
    ...(typography
      ? {
          fontFamily: typography.fontFamily,
          fontSize: typography.fontSize,
          fontWeight: typography.fontWeight,
          lineHeight: typography.lineHeight,
        }
      : {}),
    ...(refs.color ? { color: ds.colors[refs.color].value } : {}),
    ...(refs.backgroundColor
      ? { backgroundColor: ds.colors[refs.backgroundColor].value }
      : {}),
    ...(refs.padding ? { padding: ds.spacing[refs.padding].value } : {}),
    ...(refs.borderRadius
      ? { borderRadius: ds.radius[refs.borderRadius].value }
      : {}),
    ...c.styleOverrides,
  };
}
export type UpdateDesignTokenOperation =
  | {
      action: "updateDesignToken";
      tokenType: "typography";
      tokenId: TypographyId;
      changes: Partial<Omit<TypographyToken, "id" | "name">>;
    }
  | {
      action: "updateDesignToken";
      tokenType: "colors";
      tokenId: ColorId;
      changes: { value: string };
    }
  | {
      action: "updateDesignToken";
      tokenType: "spacing";
      tokenId: (typeof spacingIds)[number];
      changes: { value: number };
    }
  | {
      action: "updateDesignToken";
      tokenType: "radius";
      tokenId: (typeof radiusIds)[number];
      changes: { value: number };
    };
export function updateDesignToken(
  ds: DesignSystem,
  op: UpdateDesignTokenOperation,
): DesignSystem {
  if (!Object.hasOwn(ds[op.tokenType], op.tokenId))
    throw new Error("Unknown design token.");
  // Branched per tokenType (rather than one generically-indexed spread) so
  // each branch's property types stay concrete for the compiler.
  if (op.tokenType === "typography")
    return {
      ...ds,
      typography: {
        ...ds.typography,
        [op.tokenId]: { ...ds.typography[op.tokenId], ...op.changes },
      },
    };
  if (op.tokenType === "colors")
    return {
      ...ds,
      colors: {
        ...ds.colors,
        [op.tokenId]: { ...ds.colors[op.tokenId], ...op.changes },
      },
    };
  if (op.tokenType === "spacing")
    return {
      ...ds,
      spacing: {
        ...ds.spacing,
        [op.tokenId]: { ...ds.spacing[op.tokenId], ...op.changes },
      },
    };
  return {
    ...ds,
    radius: {
      ...ds.radius,
      [op.tokenId]: { ...ds.radius[op.tokenId], ...op.changes },
    },
  };
}
