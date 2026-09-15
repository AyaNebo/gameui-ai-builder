import {
  applyUIOperation,
  type UIOperation,
  createComponent,
} from "./operations";
import { hudComponents, type UISchema } from "./schema";
import {
  updateDesignToken,
  type DesignSystem,
  type UpdateDesignTokenOperation,
} from "./designSystem";
import { designSystemForDirection } from "./presets";
import { buildHudPack, componentPresets } from "./templates";
import { designDirections, type DesignDirection } from "@/ai/schemas";
export interface EditorDocument {
  schema: UISchema;
  designSystem: DesignSystem;
}
export type EditorOperation =
  | UIOperation
  | UpdateDesignTokenOperation
  // "hud" = the original generic 4-piece layout (kept for backward
  // compatibility). "pack-<Direction>" inserts a full, ready-made,
  // direction-styled HUD (see editor/templates.ts) and applies that
  // direction's Design System, all with zero AI calls. "preset-<id>"
  // inserts one small reusable component preset from componentPresets.
  | { action: "insertLayout"; layoutId: string }
  | { action: "applyDesignDirection"; direction: DesignDirection };
export function applyEditorOperation(
  doc: EditorDocument,
  op: EditorOperation,
): EditorDocument {
  if (op.action === "updateDesignToken")
    return { ...doc, designSystem: updateDesignToken(doc.designSystem, op) };
  if (op.action === "applyDesignDirection")
    return { ...doc, designSystem: designSystemForDirection(op.direction) };
  if (op.action === "insertLayout") {
    if (op.layoutId === "hud")
      return {
        ...doc,
        schema: hudComponents()
          .map(createComponent)
          .reduce(applyUIOperation, doc.schema),
      };
    if (op.layoutId.startsWith("pack-")) {
      const direction = op.layoutId.slice("pack-".length) as DesignDirection;
      if (!(designDirections as readonly string[]).includes(direction))
        throw new Error("Unknown UI pack.");
      return {
        schema: buildHudPack(direction)
          .map(createComponent)
          .reduce(applyUIOperation, doc.schema),
        designSystem: designSystemForDirection(direction),
      };
    }
    const preset = componentPresets.find((p) => `preset-${p.id}` === op.layoutId);
    if (preset)
      return {
        ...doc,
        schema: preset
          .build()
          .map(createComponent)
          .reduce(applyUIOperation, doc.schema),
      };
    throw new Error("Unsupported layout.");
  }
  return { ...doc, schema: applyUIOperation(doc.schema, op) };
}
