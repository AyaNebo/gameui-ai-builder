import type { DesignSystem, StyleTokens } from "./designSystem";
import type { GameContext, GameSource } from "./gameContext";
import type { IconId } from "./icons";
import type { AIAnalysisResult } from "@/ai/schemas";
export const componentTypes = [
  "text",
  "button",
  "panel",
  "image",
  "progressBar",
] as const;
export type ComponentType = (typeof componentTypes)[number];
export const anchors = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;
export type Anchor = (typeof anchors)[number];
export type GameData = Record<
  string,
  (
    | { type: "number"; value: number }
    | { type: "string"; value: string }
  ) & {
    /** True for a variable the AI created to demo a binding that has no
     * real engine value yet (e.g. a plausible resource it saw evidence for
     * but that doesn't exist in the provided Game Data). Purely a display
     * hint — never presented as if it came from the actual game. */
    mock?: boolean;
  }
>;
export type Binding = {
  variable: string;
  maxVariable?: string;
  format?: string;
};
export interface UIStyle {
  fontSize: number;
  color: string;
  backgroundColor: string;
  borderRadius: number;
  opacity: number;
  padding: number;
  fontFamily?: string;
  fontWeight?: number;
  lineHeight?: number;
}
export interface UIComponent {
  id: string;
  type: ComponentType;
  name: string;
  anchor: Anchor;
  position: { x: number; y: number };
  size: { width: number; height: number };
  text: string;
  value: number;
  max: number;
  style: UIStyle;
  tokens?: StyleTokens;
  styleOverrides?: Partial<UIStyle>;
  binding?: Binding;
  /** Optional icon rendered beside the text/value (see editor/icons.tsx). Lets
   * text/button components double as "chips" (icon + value), the structured
   * pattern used for resource/health/objective/timer HUD elements. Also
   * used as a graceful fallback visual when `generatedAssetKey` is set but
   * the asset hasn't (yet, or couldn't) be generated. */
  icon?: IconId;
  /** A single emoji rendered in place of `icon` when set. Mutually
   * exclusive in practice with `icon`/`generatedAssetKey` — rendering
   * priority is generatedAssetKey > emoji > icon (see GameCanvas). Emoji
   * are a first-class, expressive visual option (never banned) alongside
   * vector icons — a component picks ONE representation. */
  emoji?: string;
  /** Key into `Project.generatedAssets` (prompt-key -> data URL) for an
   * AI-generated visual asset (e.g. a custom carrot icon). Reserved for
   * individual small visual elements — never a whole flattened HUD image.
   * When absent/unresolved, `emoji`/`icon` provide the visible fallback so
   * the component is never empty. */
  generatedAssetKey?: string;
  /** True for components the AI created (vs. hand-placed by the user).
   * Purely bookkeeping — rendering and editing are identical either way.
   * Lets "Generate a HUD" replace a previous AI-made HUD instead of
   * stacking a duplicate one on top when the user regenerates. */
  aiGenerated?: boolean;
}
export interface UISchema {
  version: "0.2";
  referenceResolution: { width: number; height: number };
  components: UIComponent[];
}
export interface Project {
  version: "0.2";
  metadata: { id: string; name: string; savedAt: string };
  gameContext: GameContext | null;
  gameSource: GameSource | null;
  designSystem: DesignSystem;
  uiSchema: UISchema;
  gameData: GameData;
  /** Cached AI screenshot analysis, so refreshing the browser doesn't force
   * a repeat (paid) vision request. Optional/absent on older saves. */
  aiAnalysis?: AIAnalysisResult | null;
  /** Cache of AI-generated visual assets (individual icons/artwork, never a
   * full HUD image), keyed by a deterministic hash of the generation
   * prompt so identical prompts are never regenerated (cost control).
   * Values are data: URLs. Optional/absent on older saves. */
  generatedAssets?: Record<string, string>;
}
export const labels: Record<ComponentType, string> = {
  text: "Text",
  button: "Button",
  panel: "Panel",
  image: "Image / Icon",
  progressBar: "Progress Bar",
};
export const initialGameData: GameData = {
  PlayerHealth: { type: "number", value: 75 },
  MaxHealth: { type: "number", value: 100 },
  Stamina: { type: "number", value: 62 },
  Coins: { type: "number", value: 124 },
  Score: { type: "number", value: 350 },
  SelectedItem: { type: "string", value: "Carrot" },
  TimeRemaining: { type: "number", value: 48 },
};
export function makeComponent(
  type: ComponentType,
  overrides: Partial<UIComponent> = {},
): UIComponent {
  return {
    id: crypto.randomUUID(),
    type,
    name: labels[type],
    anchor: "top-left",
    position: { x: 760, y: 450 },
    size: {
      width: type === "panel" ? 440 : type === "image" ? 160 : 300,
      height: type === "panel" ? 300 : type === "progressBar" ? 48 : type === "image" ? 160 : 104,
    },
    text: type === "image" ? "🥕" : type === "button" ? "Continue" : "New text",
    value: 75,
    max: 100,
    style: {
      fontSize: type === "image" ? 65 : 36,
      color: type === "progressBar" ? "#eab957" : "#ffffff",
      backgroundColor:
        type === "text"
          ? "#00000000"
          : type === "button"
            ? "#8960d4"
            : "#19222bd9",
      borderRadius: 16,
      opacity: 1,
      padding: type === "progressBar" ? 0 : 16,
    },
    tokens: {
      ...(type === "text" || type === "button"
        ? {
            typography:
              type === "button" ? ("label" as const) : ("body" as const),
          }
        : {}),
      color: type === "progressBar" ? "success" : "textPrimary",
      ...(type !== "text" && type !== "image"
        ? {
            backgroundColor:
              type === "button" ? ("primary" as const) : ("surface" as const),
          }
        : {}),
      borderRadius: "m",
      ...(type !== "progressBar" ? { padding: "m" as const } : {}),
    },
    ...overrides,
  };
}
export function anchorFactor(anchor: Anchor): [number, number] {
  return [
    anchor.endsWith("left") ? 0 : anchor.endsWith("right") ? 1 : 0.5,
    anchor.startsWith("top") ? 0 : anchor.startsWith("bottom") ? 1 : 0.5,
  ];
}
export function absolutePosition(
  c: UIComponent,
  res: UISchema["referenceResolution"],
) {
  const [ax, ay] = anchorFactor(c.anchor);
  return {
    x: ax * (res.width - c.size.width) + c.position.x,
    y: ay * (res.height - c.size.height) + c.position.y,
  };
}
export function anchoredPosition(
  c: UIComponent,
  res: UISchema["referenceResolution"],
  x: number,
  y: number,
) {
  const [ax, ay] = anchorFactor(c.anchor);
  return {
    x: x - ax * (res.width - c.size.width),
    y: y - ay * (res.height - c.size.height),
  };
}
export function changeAnchor(
  c: UIComponent,
  res: UISchema["referenceResolution"],
  anchor: Anchor,
) {
  const p = absolutePosition(c, res);
  return {
    anchor,
    position: anchoredPosition({ ...c, anchor }, res, p.x, p.y),
  };
}
export function hudComponents(): UIComponent[] {
  return [
    makeComponent("progressBar", {
      name: "Health Bar",
      position: { x: 56, y: 66 },
      size: { width: 360, height: 32 },
      binding: { variable: "PlayerHealth", maxVariable: "MaxHealth" },
    }),
    makeComponent("text", {
      name: "Coin Counter",
      anchor: "top-right",
      position: { x: -56, y: 56 },
      size: { width: 310, height: 90 },
      binding: { variable: "Coins", format: "Coins  {value}" },
      tokens: {
        typography: "heading",
        color: "textPrimary",
        backgroundColor: "surface",
        padding: "m",
        borderRadius: "m",
      },
    }),
    makeComponent("text", {
      name: "Score",
      anchor: "top-right",
      position: { x: -56, y: 166 },
      size: { width: 310, height: 90 },
      binding: { variable: "Score", format: "Score  {value}" },
      tokens: {
        typography: "heading",
        color: "textPrimary",
        backgroundColor: "surface",
        padding: "m",
        borderRadius: "m",
      },
    }),
    makeComponent("text", {
      name: "Status Text",
      anchor: "bottom-left",
      position: { x: 56, y: -56 },
      size: { width: 550, height: 80 },
      text: "Ready for your next adventure",
      tokens: {
        typography: "body",
        color: "textPrimary",
        backgroundColor: "surface",
        padding: "m",
        borderRadius: "m",
      },
    }),
  ];
}
export function initialSchema(): UISchema {
  return {
    version: "0.2",
    referenceResolution: { width: 1920, height: 1080 },
    components: [],
  };
}
export function resolveBinding(
  c: UIComponent,
  data: GameData,
): { text: string; value: number; max: number; error?: string } {
  const base = { text: c.text, value: c.value, max: c.max };
  if (!c.binding) return base;
  const entry = data[c.binding.variable];
  if (!entry)
    return { ...base, error: `Missing variable: ${c.binding.variable}` };
  if (c.type === "progressBar" && entry.type !== "number")
    return { ...base, error: "Progress bars need a number variable" };
  const max = c.binding.maxVariable ? data[c.binding.maxVariable] : undefined;
  if (c.binding.maxVariable && (!max || max.type !== "number"))
    return { ...base, error: "Maximum binding needs a number variable" };
  const resolvedMax = max?.type === "number" ? max.value : c.max;
  if (c.type === "progressBar" && resolvedMax <= 0)
    return {
      ...base,
      value: Number(entry.value),
      max: resolvedMax,
      error: "Maximum must be greater than zero",
    };
  return {
    text: (c.binding.format ?? "{value}").replaceAll(
      "{value}",
      String(entry.value),
    ),
    value: entry.type === "number" ? entry.value : c.value,
    max: resolvedMax,
  };
}
