import {
  typographyIds,
  colorIds,
  spacingIds,
  radiusIds,
  type DesignSystem,
} from "./designSystem";
import {
  genres,
  perspectives,
  platforms,
  inputMethods,
  webGLUrl,
  isDataImageUrl,
  MAX_SCREENSHOT_BYTES,
  type GameContext,
  type GameSource,
} from "./gameContext";
import { anchors, componentTypes, type UISchema, type Project } from "./schema";
import { isIconId } from "./icons";
const record = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const number = (x: unknown) => typeof x === "number" && Number.isFinite(x);
const color = (x: unknown) =>
  typeof x === "string" && /^#[\da-f]{6}([\da-f]{2})?$/i.test(x);
export function validateSchema(value: unknown): asserts value is UISchema {
  if (
    !record(value) ||
    value.version !== "0.2" ||
    !record(value.referenceResolution) ||
    !number(value.referenceResolution.width) ||
    !number(value.referenceResolution.height) ||
    Number(value.referenceResolution.width) <= 0 ||
    Number(value.referenceResolution.height) <= 0 ||
    !Array.isArray(value.components) ||
    value.components.length > 100
  )
    throw new Error("Invalid UI Schema header or component count.");
  const ids = new Set();
  for (const c of value.components) {
    if (
      !record(c) ||
      typeof c.id !== "string" ||
      !c.id ||
      ids.has(c.id) ||
      !componentTypes.includes(c.type as never) ||
      !anchors.includes(c.anchor as never) ||
      typeof c.name !== "string" ||
      typeof c.text !== "string"
    )
      throw new Error("Invalid component identity, type or anchor.");
    ids.add(c.id);
    if (
      !record(c.position) ||
      !number(c.position.x) ||
      !number(c.position.y) ||
      !record(c.size) ||
      !number(c.size.width) ||
      !number(c.size.height) ||
      Number(c.size.width) < 24 ||
      Number(c.size.height) < 24
    )
      throw new Error("Invalid component transform.");
    if (
      !record(c.style) ||
      !["fontSize", "borderRadius", "opacity", "padding"].every((k) =>
        number(c.style && (c.style as Record<string, unknown>)[k]),
      ) ||
      Number(c.style.opacity) < 0 ||
      Number(c.style.opacity) > 1 ||
      Number(c.style.fontSize) < 1 ||
      Number(c.style.borderRadius) < 0 ||
      Number(c.style.padding) < 0 ||
      !color(c.style.color) ||
      !color(c.style.backgroundColor)
    )
      throw new Error(
        "Invalid appearance. Use hexadecimal colors (#RRGGBB or #RRGGBBAA).",
      );
    if (!number(c.value) || !number(c.max) || Number(c.max) <= 0)
      throw new Error("Maximum must be greater than zero.");
    if (
      c.binding !== undefined &&
      (!["text", "button", "progressBar"].includes(String(c.type)) ||
        !record(c.binding) ||
        typeof c.binding.variable !== "string" ||
        !c.binding.variable ||
        (c.binding.maxVariable !== undefined &&
          typeof c.binding.maxVariable !== "string") ||
        (c.binding.format !== undefined &&
          typeof c.binding.format !== "string"))
    )
      throw new Error("Invalid data binding.");
    if (c.icon !== undefined && !isIconId(c.icon))
      throw new Error("Unknown icon id.");
    if (
      c.emoji !== undefined &&
      (typeof c.emoji !== "string" || c.emoji.length > 8)
    )
      throw new Error("Invalid emoji.");
    if (
      c.generatedAssetKey !== undefined &&
      (typeof c.generatedAssetKey !== "string" || !c.generatedAssetKey)
    )
      throw new Error("Invalid generated asset key.");
    if (c.aiGenerated !== undefined && typeof c.aiGenerated !== "boolean")
      throw new Error("Invalid aiGenerated flag.");
  }
}

export function validateDesignSystem(
  value: unknown,
): asserts value is DesignSystem {
  if (!record(value)) throw new Error("Invalid Design System.");
  for (const [group, ids] of [
    ["typography", typographyIds],
    ["colors", colorIds],
    ["spacing", spacingIds],
    ["radius", radiusIds],
  ] as const) {
    const tokens = value[group];
    if (!record(tokens)) throw new Error(`Missing ${group} tokens.`);
    for (const id of ids) {
      const t = tokens[id];
      if (!record(t) || t.id !== id || typeof t.name !== "string")
        throw new Error(`Invalid ${group} token: ${id}.`);
      if (group === "typography") {
        if (
          typeof t.fontFamily !== "string" ||
          !t.fontFamily.trim() ||
          !number(t.fontSize) ||
          Number(t.fontSize) < 1 ||
          Number(t.fontSize) > 240 ||
          !number(t.fontWeight) ||
          Number(t.fontWeight) < 100 ||
          Number(t.fontWeight) > 900 ||
          !number(t.lineHeight) ||
          Number(t.lineHeight) < 0.5 ||
          Number(t.lineHeight) > 3
        )
          throw new Error("Invalid typography value.");
      } else if (group === "colors") {
        if (!color(t.value))
          throw new Error("Use a hex color: #RRGGBB or #RRGGBBAA.");
      } else if (
        !number(t.value) ||
        Number(t.value) < 0 ||
        Number(t.value) > 500
      )
        throw new Error("Spacing and radius must be between 0 and 500.");
    }
  }
}
export function validateEditorDocument(
  schema: UISchema,
  designSystem: DesignSystem,
) {
  validateSchema(schema);
  validateDesignSystem(designSystem);
  for (const c of schema.components) {
    if (c.tokens !== undefined) {
      if (!record(c.tokens))
        throw new Error("Invalid component token references.");
      for (const [key, ids] of [
        ["typography", typographyIds],
        ["color", colorIds],
        ["backgroundColor", colorIds],
        ["padding", spacingIds],
        ["borderRadius", radiusIds],
      ] as const) {
        const token = c.tokens[key];
        if (
          token !== undefined &&
          !(ids as readonly string[]).includes(token as string)
        )
          throw new Error(`Unknown ${key} token.`);
      }
    }
    if (c.styleOverrides !== undefined) {
      if (!record(c.styleOverrides))
        throw new Error("Invalid style overrides.");
      for (const [key, v] of Object.entries(c.styleOverrides)) {
        if (["color", "backgroundColor"].includes(key)) {
          if (!color(v)) throw new Error("Invalid override color.");
        } else if (key === "fontFamily") {
          if (typeof v !== "string" || !v.trim())
            throw new Error("Invalid font family.");
        } else {
          const ranges: Record<string, [number, number]> = {
            fontSize: [1, 240],
            fontWeight: [100, 900],
            lineHeight: [0.5, 3],
            opacity: [0, 1],
            padding: [0, 500],
            borderRadius: [0, 500],
          };
          const range = ranges[key];
          if (
            !range ||
            !number(v) ||
            Number(v) < range[0] ||
            Number(v) > range[1]
          )
            throw new Error("Invalid style override.");
        }
      }
    }
  }
}
export function validateContext(value: unknown): asserts value is GameContext {
  if (
    !record(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 100 ||
    !genres.includes(value.genre as never) ||
    !perspectives.includes(value.perspective as never) ||
    !Array.isArray(value.platforms) ||
    !value.platforms.length ||
    !value.platforms.every((v) => platforms.includes(v)) ||
    !Array.isArray(value.inputMethods) ||
    !value.inputMethods.length ||
    !value.inputMethods.every((v) => inputMethods.includes(v)) ||
    !["unity", "unreal", "godot", "unknown"].includes(String(value.engine)) ||
    (value.description !== undefined &&
      (typeof value.description !== "string" ||
        value.description.length > 1000))
  )
    throw new Error("Complete the required Game Setup fields.");
}
export function validateSource(value: unknown): asserts value is GameSource {
  if (!record(value)) throw new Error("Invalid game source.");
  if (
    value.kind === "connected" &&
    value.engine === "unity" &&
    value.adapter === "mock"
  )
    return;
  if (
    value.kind === "imported" &&
    value.format === "unity-webgl" &&
    typeof value.url === "string"
  ) {
    webGLUrl(value.url);
    return;
  }
  if (value.kind === "screenshot") {
    if (
      typeof value.imageData !== "string" ||
      !isDataImageUrl(value.imageData)
    )
      throw new Error("Invalid screenshot image data.");
    if (value.imageData.length > MAX_SCREENSHOT_BYTES)
      throw new Error("Screenshot is too large to save.");
    return;
  }
  throw new Error("Unsupported game source.");
}
export function validateProject(value: unknown): asserts value is Project {
  if (
    !record(value) ||
    value.version !== "0.2" ||
    !record(value.metadata) ||
    typeof value.metadata.id !== "string" ||
    !value.metadata.id ||
    typeof value.metadata.name !== "string" ||
    typeof value.metadata.savedAt !== "string" ||
    !record(value.gameData)
  )
    throw new Error("Invalid saved GameUI Project.");
  validateSchema(value.uiSchema);
  validateDesignSystem(value.designSystem);
  validateEditorDocument(value.uiSchema, value.designSystem);
  if (value.gameContext !== null) validateContext(value.gameContext);
  if (value.gameSource !== null) validateSource(value.gameSource);
  if ((value.gameContext === null) !== (value.gameSource === null))
    throw new Error("Game context and source must be saved together.");
  if (
    value.aiAnalysis !== undefined &&
    value.aiAnalysis !== null &&
    (!record(value.aiAnalysis) || typeof value.aiAnalysis.summary !== "string")
  )
    throw new Error("Invalid cached AI analysis.");
  if (value.generatedAssets !== undefined) {
    if (!record(value.generatedAssets))
      throw new Error("Invalid generated assets cache.");
    for (const [key, v] of Object.entries(value.generatedAssets))
      if (!key || typeof v !== "string" || !v.startsWith("data:image/"))
        throw new Error("Invalid generated asset entry.");
  }
  for (const v of Object.values(value.gameData))
    if (
      !record(v) ||
      !(v.type === "number"
        ? number(v.value)
        : v.type === "string" && typeof v.value === "string") ||
      (v.mock !== undefined && typeof v.mock !== "boolean")
    )
      throw new Error("Invalid saved Game Data.");
}
