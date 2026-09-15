// Structured-output contracts shared between the AI API routes (server) and
// the editor (client, for types + the operation translator). Pure zod/TS —
// no OpenAI SDK import here, so this file is safe to import from client
// components without pulling server-only code (or the API key) into the
// browser bundle.
import { z } from "zod";
import { anchors, componentTypes } from "@/editor/schema";
import {
  typographyIds,
  colorIds,
  spacingIds,
  radiusIds,
} from "@/editor/designSystem";
import { iconIds } from "@/editor/icons";
const enumOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values);
const anchorEnum = enumOf(anchors as unknown as [string, ...string[]]);
const componentTypeEnum = enumOf(
  componentTypes as unknown as [string, ...string[]],
);
const iconEnum = enumOf(["none", ...iconIds] as [string, ...string[]]);
const typographyEnum = enumOf(
  ["none", ...typographyIds] as unknown as [string, ...string[]],
);
const colorEnum = enumOf(["none", ...colorIds] as unknown as [string, ...string[]]);
const spacingEnum = enumOf(
  ["none", ...spacingIds] as unknown as [string, ...string[]],
);
const radiusEnum = enumOf(
  ["none", ...radiusIds] as unknown as [string, ...string[]],
);
export const designDirections = [
  "Cozy",
  "Arcade",
  "Minimal",
  "Fantasy",
  "Sci-Fi",
] as const;
export type DesignDirection = (typeof designDirections)[number];
export const directionEnum = z.enum(designDirections);
const hex = z
  .string()
  .max(9)
  .describe("Hex color, #RRGGBB or #RRGGBBAA.");
// A component's chosen visual representation. GameUI intentionally never
// restricts itself to one rendering technique — the model picks whichever
// medium best fits the element (see OPERATIONS_SYSTEM_PROMPT): a vector
// icon for clean, consistent semantics; an emoji when it's more expressive
// and the HUD's style calls for it; or a small AI-generated image asset
// when a distinctive custom visual would meaningfully improve the design.
// "iconId" is filled in all cases that have a sensible one, INCLUDING
// "generated", so there's always a graceful fallback if a generated asset
// is skipped (cost control) or fails.
const visualSchema = z.object({
  kind: z
    .enum(["icon", "emoji", "generated", "none"])
    .describe(
      "'icon' = use iconId (a vector icon). 'emoji' = use the emoji field. 'generated' = request a small custom visual asset from assetPrompt (NEVER a whole HUD image — one focused element only), with iconId as the fallback if generation is skipped or fails. 'none' = no icon/visual.",
    ),
  iconId: iconEnum.describe(
    "'none', or one of the known icon ids. Used directly when kind is 'icon', and always worth setting (even when kind is 'generated') as a graceful fallback.",
  ),
  emoji: z
    .string()
    .max(8)
    .describe("A single emoji, e.g. '🥕'. Used when kind is 'emoji'; '' otherwise."),
  assetPrompt: z
    .string()
    .max(300)
    .describe(
      "A short, specific prompt for ONE small visual asset (e.g. 'a cute stylized cartoon carrot icon, flat vector style, centered, transparent background') — used only when kind is 'generated'. Never describe a whole HUD, screen, or layout here. '' otherwise.",
    ),
});
const confidenceEnum = z
  .enum(["confirmed", "contextual", "speculative"])
  .describe(
    "confirmed = clearly visible in the screenshot. contextual = strongly implied by Game Context, not directly visible. speculative = plausible but no real evidence — avoid basing HUD elements on these.",
  );
// ---------------------------------------------------------------------------
// Stage A — structured visual game analysis
// ---------------------------------------------------------------------------
export const analysisResultSchema = z.object({
  summary: z
    .string()
    .max(400)
    .describe("One or two plain-language sentences describing the scene."),
  inferredGameType: z
    .string()
    .max(40)
    .describe("Best-guess game type/genre suggested by the image, e.g. 'Cozy farming adventure'."),
  visualStyle: z
    .string()
    .max(80)
    .describe("Art/rendering style, e.g. 'hand-painted low-poly 3D', 'pixel art', 'flat vector'."),
  visualMood: z.string().max(120),
  visualDensity: z
    .enum(["low", "medium", "high"])
    .describe("How visually busy the screenshot already is."),
  palette: z.object({
    dominant: hex.describe("The single most dominant color in the screenshot."),
    accent: hex.describe("A secondary color that stands out (e.g. a saturated highlight)."),
    background: hex.describe("Dominant environment/background/sky color."),
    warmCool: z.enum(["warm", "cool", "neutral"]),
    lightDark: z.enum(["light", "dark", "balanced"]),
    suggestedSurface: hex.describe(
      "Recommended UI panel/surface color inspired by the palette — does not need to be sampled directly from the image.",
    ),
    suggestedText: hex.describe(
      "Recommended primary UI text color. MUST stay clearly readable against suggestedSurface — prefer a near-white or near-black over a literal image color if the image colors would be low-contrast.",
    ),
    suggestedAccent: hex.describe("Recommended accent color for primary actions/highlights."),
    suggestedSecondaryAccent: hex.describe("Recommended second accent, e.g. for a different resource type."),
  }),
  importantObjects: z
    .array(
      z.object({
        name: z.string().max(40).describe("A concrete visible or implied object/concept, e.g. 'carrot', 'backpack', 'rabbit character'."),
        confidence: confidenceEnum,
      }),
    )
    .max(8),
  playerCharacter: z
    .string()
    .max(80)
    .nullable()
    .describe("Short description of the player character/avatar if visible, else null."),
  environment: z.string().max(120).describe("Short description of the setting/environment."),
  likelyResources: z
    .array(z.string().max(30))
    .max(6)
    .describe("Resource/currency/collectible concepts suggested by the screenshot and/or Game Context."),
  likelyPlayerStats: z
    .array(z.string().max(30))
    .max(6)
    .describe("Status concepts suggested by the screenshot and/or Game Context, e.g. health, energy, stamina."),
  suggestedHUDDensity: z.enum(["low", "medium", "high"]),
  focalAreas: z
    .array(z.string().max(80))
    .max(6)
    .describe("Short phrases naming where the player's eye is drawn."),
  safeZones: z
    .array(
      z.object({
        anchor: anchorEnum,
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(9)
    .describe("Screen regions that look safe for UI without covering gameplay, most confident first."),
  blockedZones: z
    .array(
      z.object({
        anchor: anchorEnum,
        reason: z.string().max(60).describe("e.g. 'player character', 'navigation path / road'."),
      }),
    )
    .max(6)
    .describe("Regions HUD elements should avoid, with why."),
  recommendedDirection: directionEnum,
  recommendedHudName: z
    .string()
    .max(60)
    .describe("A short, human name for the suggested HUD, e.g. 'Cozy Adventure HUD'."),
  reasoning: z
    .string()
    .max(400)
    .describe("A brief, specific explanation for the recommendation, tied to what's actually visible."),
  bullets: z
    .array(z.string().max(40))
    .max(4)
    .describe(
      "Very short tag-like phrases (2-5 words each, not full sentences) summarizing the HUD strategy, e.g. 'Keep center clear', 'Low-medium density'.",
    ),
});
export type AIAnalysisResult = z.infer<typeof analysisResultSchema>;
// ---------------------------------------------------------------------------
// Stage B — structured UI design plan (HUD generation + natural-language edits)
// ---------------------------------------------------------------------------
const componentSpecSchema = z.object({
  type: componentTypeEnum.describe(
    "One of the existing GameUI primitives — do not invent new types.",
  ),
  semanticRole: z
    .string()
    .max(30)
    .describe("What this represents, e.g. 'health', 'currency', 'inventory', 'objective', 'timer', 'touch-action'. Bookkeeping only, not rendered."),
  name: z.string().min(1).max(60),
  anchor: anchorEnum,
  x: z.number().describe("Offset in game pixels relative to the anchor."),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  text: z.string().max(200).describe("Literal label text, or '' if not applicable. Never emoji — use the icon field for icons."),
  visual: visualSchema,
  circular: z
    .boolean()
    .describe(
      "True to render this as a true circular surface (e.g. a touch action button). GameUI computes the exact radius; you only decide whether it should be circular.",
    ),
  value: z.number().describe("Only meaningful for progressBar; 0 otherwise."),
  max: z.number().describe("Only meaningful for progressBar; 100 otherwise."),
  typography: typographyEnum,
  color: colorEnum,
  backgroundColor: colorEnum,
  padding: spacingEnum,
  borderRadius: radiusEnum,
  bindingVariable: z
    .string()
    .max(60)
    .describe("'none', or a Game Data variable name to bind to — either one already provided, or one you propose in mockGameData."),
  bindingMaxVariable: z
    .string()
    .max(60)
    .describe("'none', or an existing numeric Game Data variable for a maximum."),
  bindingFormat: z
    .string()
    .max(80)
    .describe("Display format using {value}, e.g. 'Coins {value}'. '' means '{value}'."),
});
const tokenPatchSchema = z.object({
  fontFamily: z.string().max(60).nullable(),
  fontSize: z.number().nullable(),
  fontWeight: z.number().nullable(),
  lineHeight: z.number().nullable(),
  colorValue: z
    .string()
    .max(20)
    .nullable()
    .describe("Hex color, e.g. #RRGGBB or #RRGGBBAA, when tokenType is colors."),
  numberValue: z
    .number()
    .nullable()
    .describe("New value when tokenType is spacing or radius."),
});
export const aiOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), component: componentSpecSchema }),
  z.object({
    op: z.literal("update"),
    targetName: z
      .string()
      .min(1)
      .max(60)
      .describe("The existing component's current name, matched case-insensitively."),
    patch: z.object({
      name: z.string().max(60).nullable(),
      text: z.string().max(200).nullable(),
      value: z.number().nullable(),
      max: z.number().nullable(),
      visual: visualSchema.nullable(),
      circular: z.boolean().nullable(),
      typography: typographyEnum.nullable(),
      color: colorEnum.nullable(),
      backgroundColor: colorEnum.nullable(),
      padding: spacingEnum.nullable(),
      borderRadius: radiusEnum.nullable(),
      fontSizeOverride: z
        .number()
        .nullable()
        .describe("Local font-size override in px, bypassing the typography token."),
    }),
  }),
  z.object({
    op: z.literal("move"),
    targetName: z.string().min(1).max(60),
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    op: z.literal("resize"),
    targetName: z.string().min(1).max(60),
    width: z.number(),
    height: z.number(),
  }),
  z.object({ op: z.literal("delete"), targetName: z.string().min(1).max(60) }),
  z.object({
    op: z.literal("bind"),
    targetName: z.string().min(1).max(60),
    variable: z.string().max(60).describe("'none' or a Game Data variable name."),
    maxVariable: z.string().max(60),
    format: z.string().max(80),
  }),
  z.object({
    op: z.literal("token"),
    tokenType: z.enum(["typography", "colors", "spacing", "radius"]),
    tokenId: z
      .string()
      .max(30)
      .describe("An existing token id within tokenType, e.g. 'heading' or 'primary'."),
    changes: tokenPatchSchema,
  }),
  z.object({ op: z.literal("direction"), direction: directionEnum }),
]);
export type AIOperation = z.infer<typeof aiOperationSchema>;
const mockGameDataEntrySchema = z.object({
  key: z.string().min(1).max(40).describe("A new Game Data variable name, e.g. 'Carrots'."),
  type: z.enum(["number", "string"]),
  numberValue: z.number().nullable().describe("Set when type is 'number', else null."),
  stringValue: z.string().max(60).nullable().describe("Set when type is 'string', else null."),
  label: z
    .string()
    .max(60)
    .describe("Short human label noting this is mocked preview data, e.g. 'Carrots (mock preview data)'."),
});
export const aiOperationsResultSchema = z.object({
  summary: z
    .string()
    .max(300)
    .describe("One short sentence explaining what this batch of changes does."),
  mockGameData: z
    .array(mockGameDataEntrySchema)
    .max(6)
    .describe(
      "New Game Data variables to create ONLY for resources/stats you want to bind to that don't already exist in the provided Game Data. Never propose a key that already exists — bind to the real one instead.",
    ),
  operations: z.array(aiOperationSchema).max(40),
});
export type AIOperationsResult = z.infer<typeof aiOperationsResultSchema>;
