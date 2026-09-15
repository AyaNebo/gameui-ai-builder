// Pure helpers that shrink the live editor state down to what the model
// actually needs, per the "don't resend unnecessarily huge project state"
// cost-control rule. No OpenAI/server imports — safe anywhere.
import type { UISchema, GameData } from "@/editor/schema";
import type { GameContext } from "@/editor/gameContext";
import type { DesignSystem } from "@/editor/designSystem";
import { iconIds } from "@/editor/icons";
import { designDirections, type AIAnalysisResult } from "@/ai/schemas";
export function summarizeGameContext(ctx: GameContext | null) {
  if (!ctx) return null;
  return {
    name: ctx.name,
    genre: ctx.genre,
    perspective: ctx.perspective,
    platforms: ctx.platforms,
    inputMethods: ctx.inputMethods,
    description: ctx.description || undefined,
  };
}
// Compact per-component summary: shape/position/binding/icon, deliberately
// omitting raw pixel style values the model doesn't need to reason about
// (those come from Design System tokens instead).
export function summarizeSchema(schema: UISchema) {
  return {
    referenceResolution: schema.referenceResolution,
    components: schema.components.map((c) => ({
      name: c.name,
      type: c.type,
      anchor: c.anchor,
      position: c.position,
      size: c.size,
      text: c.text,
      icon: c.icon ?? "none",
      emoji: c.emoji ?? "",
      hasGeneratedAsset: Boolean(c.generatedAssetKey),
      typography: c.tokens?.typography ?? "none",
      color: c.tokens?.color ?? "none",
      backgroundColor: c.tokens?.backgroundColor ?? "none",
      binding: c.binding
        ? {
            variable: c.binding.variable,
            maxVariable: c.binding.maxVariable ?? "none",
            format: c.binding.format ?? "{value}",
          }
        : "none",
    })),
  };
}
export function summarizeDesignSystem(ds: DesignSystem) {
  return ds;
}
export function summarizeGameData(data: GameData) {
  return Object.fromEntries(
    Object.entries(data).map(([key, v]) => [
      key,
      v.type === "number" ? { type: "number", example: v.value } : { type: "string", example: v.value },
    ]),
  );
}
export function summarizeAnalysis(analysis: AIAnalysisResult | null | undefined) {
  if (!analysis) return null;
  return analysis;
}
export const AVAILABLE_ICON_IDS = iconIds;
export const AVAILABLE_DIRECTIONS = designDirections;
