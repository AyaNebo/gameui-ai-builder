import { type Project, type UISchema, type UIComponent } from "./schema";
import { defaultDesignSystem, type DesignSystem } from "./designSystem";
import { validateProject, validateEditorDocument } from "./validation";
export const STORAGE_KEY = "gameui-project-v2";
export const LEGACY_STORAGE_KEY = "gameui-project-v1";
export function migrateProject(raw: unknown): Project {
  if (typeof raw !== "object" || !raw)
    throw new Error("Invalid saved project.");
  if ("version" in raw && raw.version === "0.2") {
    validateProject(raw);
    return raw;
  }
  const old = raw as {
    name?: unknown;
    engine?: unknown;
    savedAt?: unknown;
    schema?: {
      version?: unknown;
      referenceResolution?: unknown;
      components?: UIComponent[];
    };
    gameData?: unknown;
  };
  if (
    typeof old.name !== "string" ||
    old.engine !== "Unity" ||
    typeof old.savedAt !== "string" ||
    old.schema?.version !== "0.1" ||
    !Array.isArray(old.schema.components)
  )
    throw new Error("Unsupported saved project version.");
  const project: unknown = {
    version: "0.2",
    metadata: { id: crypto.randomUUID(), name: old.name, savedAt: old.savedAt },
    gameContext: null,
    gameSource: null,
    designSystem: defaultDesignSystem(),
    gameData: old.gameData,
    aiAnalysis: null,
    uiSchema: {
      ...old.schema,
      version: "0.2",
      components: old.schema.components.map((c) => ({
        ...c,
        tokens: undefined,
        styleOverrides: undefined,
        style: {
          ...c.style,
          fontFamily: "Arial",
          fontWeight: c.type === "text" || c.type === "button" ? 600 : 400,
          lineHeight: 1.25,
        },
      })),
    },
  };
  validateProject(project);
  return project;
}
export function saveProject(project: Project) {
  validateProject(project);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}
export function loadProject(): { project: Project; migrated: boolean } | null {
  const current = localStorage.getItem(STORAGE_KEY);
  if (current)
    return { project: migrateProject(JSON.parse(current)), migrated: false };
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) return null;
  // Preserve the original key unchanged. V2 is written only when the user saves.
  return { project: migrateProject(JSON.parse(legacy)), migrated: true };
}
export function serializeUISchema(
  schema: UISchema,
  designSystem: DesignSystem,
) {
  validateEditorDocument(schema, designSystem);
  return JSON.stringify(
    { version: "0.2", designSystem, uiSchema: schema },
    null,
    2,
  );
}
export function exportProject(
  schema: UISchema,
  designSystem: DesignSystem,
  name: string,
) {
  const blob = new Blob([serializeUISchema(schema, designSystem)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "gameui"
  }.gameui.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return link.download;
}
