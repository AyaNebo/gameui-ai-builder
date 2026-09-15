// Translates a validated AIOperationsResult (see ai/schemas.ts) into the
// app's own EditorOperation[] — the exact same type manual edits produce —
// so AI-created UI is applied through, and behaves like, everything else
// (undo/redo, validation, Design System inheritance). This file never talks
// to OpenAI; it only shapes already-parsed, zod-validated JSON.
//
// Operations that target an existing component do so by name (the model
// doesn't know internal ids); unresolvable names are skipped individually
// rather than failing the whole batch, and reported back to the caller so
// the assistant can say what it left out.
import {
  makeComponent,
  labels,
  type UIComponent,
  type UISchema,
  type Binding,
  type ComponentType,
  type Anchor,
} from "./schema";
import type { StyleTokens } from "./designSystem";
import { typographyIds, colorIds, spacingIds, radiusIds } from "./designSystem";
import {
  createComponent,
  updateComponent,
  moveComponent,
  resizeComponent,
  deleteComponent,
  bindVariable,
} from "./operations";
import type { EditorOperation } from "./projectOperations";
import type { AIOperationsResult } from "@/ai/schemas";
import { isIconId } from "./icons";
const clamp = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
// Reference-quality HUDs read as bold and game-like, not tiny SaaS utility
// chrome — enforce a sensible minimum footprint per component type
// regardless of what the model proposes, so generated UI can never come
// out too small to read at 1920x1080.
const MIN_SIZE: Record<ComponentType, { width: number; height: number }> = {
  text: { width: 200, height: 76 },
  button: { width: 200, height: 76 },
  panel: { width: 320, height: 200 },
  image: { width: 120, height: 120 },
  progressBar: { width: 280, height: 32 },
};
export interface PendingAsset {
  /** For a "create" op, this is the new component's own (already-assigned)
   * id — set on that op's component before it's applied. For an "update"
   * op, this is the id of the existing targeted component. Either way the
   * caller can resolve it with a plain updateComponent(id, {generatedAssetKey}). */
  componentId: string;
  componentName: string;
  prompt: string;
}
export function translateAIOperations(
  result: AIOperationsResult,
  schema: UISchema,
): { operations: EditorOperation[]; skipped: string[]; pendingAssets: PendingAsset[] } {
  const skipped: string[] = [];
  const pendingAssets: PendingAsset[] = [];
  const byName = new Map(schema.components.map((c) => [c.name.toLowerCase(), c]));
  const findTarget = (name: string, verb: string): UIComponent | undefined => {
    const target = byName.get(name.toLowerCase());
    if (!target) skipped.push(`${verb} "${name}" — no component with that name`);
    return target;
  };
  const res = schema.referenceResolution;
  const ops: EditorOperation[] = [];
  for (const raw of result.operations) {
    if (raw.op === "create") {
      const spec = raw.component;
      const tokens: StyleTokens = {};
      if (spec.typography !== "none" && (typographyIds as readonly string[]).includes(spec.typography))
        tokens.typography = spec.typography as StyleTokens["typography"];
      if (spec.color !== "none" && (colorIds as readonly string[]).includes(spec.color))
        tokens.color = spec.color as StyleTokens["color"];
      if (
        spec.backgroundColor !== "none" &&
        (colorIds as readonly string[]).includes(spec.backgroundColor)
      )
        tokens.backgroundColor = spec.backgroundColor as StyleTokens["backgroundColor"];
      if (spec.padding !== "none" && (spacingIds as readonly string[]).includes(spec.padding))
        tokens.padding = spec.padding as StyleTokens["padding"];
      if (
        spec.borderRadius !== "none" &&
        (radiusIds as readonly string[]).includes(spec.borderRadius)
      )
        tokens.borderRadius = spec.borderRadius as StyleTokens["borderRadius"];
      const binding: Binding | undefined =
        spec.bindingVariable !== "none"
          ? {
              variable: spec.bindingVariable,
              maxVariable:
                spec.bindingMaxVariable !== "none" ? spec.bindingMaxVariable : undefined,
              format: spec.bindingFormat || undefined,
            }
          : undefined;
      const componentType = spec.type as ComponentType;
      const min = MIN_SIZE[componentType];
      const width = Math.min(res.width, Math.max(min.width, clamp(spec.width, 24, res.width)));
      const height = Math.min(res.height, Math.max(min.height, clamp(spec.height, 24, res.height)));
      const visual = spec.visual;
      const emoji = visual.kind === "emoji" ? visual.emoji.trim().slice(0, 8) || undefined : undefined;
      const icon = isIconId(visual.iconId) ? visual.iconId : undefined;
      const component = makeComponent(componentType, {
        name: spec.name.slice(0, 60) || labels[componentType],
        anchor: spec.anchor as Anchor,
        position: { x: clamp(spec.x, -res.width, res.width * 2), y: clamp(spec.y, -res.height, res.height * 2) },
        size: { width, height },
        text: spec.text.slice(0, 200),
        value: componentType === "progressBar" ? spec.value : 75,
        max: componentType === "progressBar" ? (spec.max > 0 ? spec.max : 100) : 100,
        tokens: Object.keys(tokens).length ? tokens : undefined,
        binding,
        icon,
        emoji,
        aiGenerated: true,
        ...(spec.circular
          ? { styleOverrides: { borderRadius: Math.round(Math.min(width, height) / 2) } }
          : {}),
      });
      if (visual.kind === "generated" && visual.assetPrompt.trim())
        pendingAssets.push({
          componentId: component.id,
          componentName: component.name,
          prompt: visual.assetPrompt.trim(),
        });
      ops.push(createComponent(component));
      continue;
    }
    if (raw.op === "update") {
      const target = findTarget(raw.targetName, "update");
      if (!target) continue;
      const patch: Partial<UIComponent> = {};
      if (raw.patch.name) patch.name = raw.patch.name.slice(0, 60);
      if (raw.patch.text !== null) patch.text = raw.patch.text.slice(0, 200);
      if (raw.patch.value !== null) patch.value = raw.patch.value;
      if (raw.patch.max !== null) patch.max = raw.patch.max;
      if (raw.patch.visual !== null) {
        const visual = raw.patch.visual;
        if (visual.kind === "none") {
          patch.icon = undefined;
          patch.emoji = undefined;
          patch.generatedAssetKey = undefined;
        } else if (visual.kind === "icon") {
          patch.icon = isIconId(visual.iconId) ? visual.iconId : target.icon;
          patch.emoji = undefined;
          patch.generatedAssetKey = undefined;
        } else if (visual.kind === "emoji") {
          patch.emoji = visual.emoji.trim().slice(0, 8) || target.emoji;
          patch.icon = undefined;
          patch.generatedAssetKey = undefined;
        } else if (visual.kind === "generated") {
          // Fallback icon updates immediately; the actual asset (if any) is
          // resolved asynchronously by the caller via pendingAssets, which
          // sets generatedAssetKey with a follow-up update once ready.
          patch.icon = isIconId(visual.iconId) ? visual.iconId : target.icon;
          patch.emoji = undefined;
          if (visual.assetPrompt.trim())
            pendingAssets.push({
              componentId: target.id,
              componentName: target.name,
              prompt: visual.assetPrompt.trim(),
            });
        }
      }
      if (raw.patch.circular) {
        const width = target.size.width, height = target.size.height;
        patch.styleOverrides = {
          ...target.styleOverrides,
          borderRadius: Math.round(Math.min(width, height) / 2),
        };
      }
      const tokens: StyleTokens = { ...target.tokens };
      let tokensChanged = false;
      if (raw.patch.typography !== null) {
        tokens.typography =
          raw.patch.typography === "none"
            ? undefined
            : (raw.patch.typography as StyleTokens["typography"]);
        tokensChanged = true;
      }
      if (raw.patch.color !== null) {
        tokens.color =
          raw.patch.color === "none" ? undefined : (raw.patch.color as StyleTokens["color"]);
        tokensChanged = true;
      }
      if (raw.patch.backgroundColor !== null) {
        tokens.backgroundColor =
          raw.patch.backgroundColor === "none"
            ? undefined
            : (raw.patch.backgroundColor as StyleTokens["backgroundColor"]);
        tokensChanged = true;
      }
      if (raw.patch.padding !== null) {
        tokens.padding =
          raw.patch.padding === "none" ? undefined : (raw.patch.padding as StyleTokens["padding"]);
        tokensChanged = true;
      }
      if (raw.patch.borderRadius !== null) {
        tokens.borderRadius =
          raw.patch.borderRadius === "none"
            ? undefined
            : (raw.patch.borderRadius as StyleTokens["borderRadius"]);
        tokensChanged = true;
      }
      if (tokensChanged) patch.tokens = tokens;
      if (raw.patch.fontSizeOverride !== null)
        patch.styleOverrides = { ...target.styleOverrides, fontSize: raw.patch.fontSizeOverride };
      if (Object.keys(patch).length) ops.push(updateComponent(target.id, patch));
      continue;
    }
    if (raw.op === "move") {
      const target = findTarget(raw.targetName, "move");
      if (!target) continue;
      ops.push(moveComponent(target.id, raw.x, raw.y));
      continue;
    }
    if (raw.op === "resize") {
      const target = findTarget(raw.targetName, "resize");
      if (!target) continue;
      ops.push(
        resizeComponent(
          target.id,
          clamp(raw.width, 24, res.width),
          clamp(raw.height, 24, res.height),
        ),
      );
      continue;
    }
    if (raw.op === "delete") {
      const target = findTarget(raw.targetName, "delete");
      if (!target) continue;
      ops.push(deleteComponent(target.id));
      continue;
    }
    if (raw.op === "bind") {
      const target = findTarget(raw.targetName, "bind");
      if (!target) continue;
      ops.push(
        bindVariable(
          target.id,
          raw.variable === "none"
            ? undefined
            : {
                variable: raw.variable,
                maxVariable: raw.maxVariable !== "none" ? raw.maxVariable : undefined,
                format: raw.format || undefined,
              },
        ),
      );
      continue;
    }
    if (raw.op === "token") {
      const ids =
        raw.tokenType === "typography"
          ? typographyIds
          : raw.tokenType === "colors"
            ? colorIds
            : raw.tokenType === "spacing"
              ? spacingIds
              : radiusIds;
      if (!(ids as readonly string[]).includes(raw.tokenId)) {
        skipped.push(`token ${raw.tokenType}.${raw.tokenId} — unknown token id`);
        continue;
      }
      if (raw.tokenType === "typography") {
        const changes: { fontFamily?: string; fontSize?: number; fontWeight?: number; lineHeight?: number } = {};
        if (raw.changes.fontFamily !== null) changes.fontFamily = raw.changes.fontFamily;
        if (raw.changes.fontSize !== null) changes.fontSize = raw.changes.fontSize;
        if (raw.changes.fontWeight !== null) changes.fontWeight = raw.changes.fontWeight;
        if (raw.changes.lineHeight !== null) changes.lineHeight = raw.changes.lineHeight;
        if (Object.keys(changes).length)
          ops.push({
            action: "updateDesignToken",
            tokenType: "typography",
            tokenId: raw.tokenId as (typeof typographyIds)[number],
            changes,
          });
      } else if (raw.tokenType === "colors") {
        if (raw.changes.colorValue)
          ops.push({
            action: "updateDesignToken",
            tokenType: "colors",
            tokenId: raw.tokenId as (typeof colorIds)[number],
            changes: { value: raw.changes.colorValue },
          });
      } else if (raw.changes.numberValue !== null) {
        if (raw.tokenType === "spacing")
          ops.push({
            action: "updateDesignToken",
            tokenType: "spacing",
            tokenId: raw.tokenId as (typeof spacingIds)[number],
            changes: { value: raw.changes.numberValue },
          });
        else
          ops.push({
            action: "updateDesignToken",
            tokenType: "radius",
            tokenId: raw.tokenId as (typeof radiusIds)[number],
            changes: { value: raw.changes.numberValue },
          });
      }
      continue;
    }
    if (raw.op === "direction") {
      ops.push({ action: "applyDesignDirection", direction: raw.direction });
    }
  }
  return { operations: ops, skipped, pendingAssets };
}
