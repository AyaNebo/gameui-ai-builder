import { create } from "zustand";
import {
  initialSchema,
  initialGameData,
  type UISchema,
  type GameData,
} from "./schema";
import { defaultDesignSystem, colorIds, type DesignSystem } from "./designSystem";
import { designSystemForDirection } from "./presets";
import { ensureContrast, isValidHex } from "./palette";
import { type GameContext, type GameSource } from "./gameContext";
import {
  applyEditorOperation,
  type EditorDocument,
  type EditorOperation,
} from "./projectOperations";
import {
  validateEditorDocument,
  validateContext,
  validateSource,
} from "./validation";
import { saveProject, loadProject } from "./persistence";
import {
  MockEngineAdapter,
  type ConnectionState,
} from "../engines/EngineAdapter";
import { translateAIOperations, type PendingAsset } from "./aiOperations";
import { deleteComponent, updateComponent } from "./operations";
import type { AIAnalysisResult, AIOperationsResult, DesignDirection } from "@/ai/schemas";
import { designDirections } from "@/ai/schemas";
import {
  summarizeGameContext,
  summarizeDesignSystem,
  summarizeSchema,
  summarizeGameData,
  summarizeAnalysis,
  AVAILABLE_ICON_IDS,
} from "@/ai/promptContext";
export const engine = new MockEngineAdapter();
export type AIStatus = "idle" | "analyzing" | "generating" | "applying" | "error";
interface EditorState {
  schema: UISchema;
  designSystem: DesignSystem;
  gameData: GameData;
  gameContext: GameContext | null;
  gameSource: GameSource | null;
  projectId: string;
  projectName: string;
  selectedId: string | null;
  mode: "game" | "edit" | "both";
  playing: boolean;
  connection: ConnectionState;
  savedAt: string | null;
  dirty: boolean;
  ready: boolean;
  notice: string;
  history: EditorDocument[];
  future: EditorDocument[];
  apply: (op: EditorOperation | EditorOperation[], record?: boolean) => boolean;
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  setGameValue: (key: string, value: string) => void;
  save: () => void;
  initialize: () => Promise<void>;
  notify: (msg: string) => void;
  createWorkspace: (context: GameContext, source: GameSource) => boolean;
  replaceGameSource: (source: GameSource) => boolean;
  aiStatus: AIStatus;
  aiAnalysis: AIAnalysisResult | null;
  aiError: string | null;
  generatedAssets: Record<string, string>;
  analyzeGame: () => Promise<void>;
  runAIInstruction: (instruction: string) => Promise<void>;
  generateHud: (direction?: DesignDirection) => Promise<void>;
  applyDirection: (direction: DesignDirection) => void;
  mergeMockGameData: (
    entries: {
      key: string;
      type: "number" | "string";
      numberValue: number | null;
      stringValue: string | null;
      label: string;
    }[],
  ) => void;
}
const documentOf = (s: EditorState): EditorDocument => ({
  schema: s.schema,
  designSystem: s.designSystem,
});
// Shared by runAIInstruction (free-form edits) and generateHud (explicit
// "Generate HUD"): does the fetch + structured-operation translation only.
// What happens with the resulting operations differs per caller.
async function requestAIOperations(
  get: () => EditorState,
  instruction: string,
  direction?: DesignDirection,
): Promise<{
  operations: EditorOperation[];
  skipped: string[];
  summary: string;
  mockGameData: AIOperationsResult["mockGameData"];
  pendingAssets: PendingAsset[];
}> {
  const cur = get();
  const res = await fetch("/api/ai/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instruction,
      gameContext: summarizeGameContext(cur.gameContext),
      designSystem: summarizeDesignSystem(cur.designSystem),
      uiSchema: summarizeSchema(cur.schema),
      gameData: summarizeGameData(cur.gameData),
      analysis: summarizeAnalysis(cur.aiAnalysis),
      direction: direction ?? cur.aiAnalysis?.recommendedDirection ?? null,
      availableIcons: AVAILABLE_ICON_IDS,
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !Array.isArray(body.operations))
    throw new Error(body?.error || "The AI request failed.");
  // New Game Data the AI wants to bind to must exist before its create/bind
  // operations are applied, so the very first render already resolves
  // cleanly instead of flashing a "missing variable" state. Never
  // overwrites a key that already exists (see mergeMockGameData).
  if (Array.isArray(body.mockGameData) && body.mockGameData.length)
    get().mergeMockGameData(body.mockGameData);
  const { operations, skipped, pendingAssets } = translateAIOperations(
    body as AIOperationsResult,
    get().schema,
  );
  return {
    operations,
    skipped,
    summary: (body as AIOperationsResult).summary || "AI changes applied.",
    mockGameData: (body as AIOperationsResult).mockGameData ?? [],
    pendingAssets,
  };
}
function noteSkipped(skipped: string[]): string {
  return skipped.length
    ? ` (${skipped.length} change${skipped.length === 1 ? "" : "s"} skipped: ${skipped.join("; ")})`
    : "";
}
// Deterministic short hash (FNV-1a) used to cache generated visual assets
// by prompt, so an identical prompt is never regenerated (Focused Task,
// section 19: cost control) — including across separate HUD generations.
function assetCacheKey(prompt: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < prompt.length; i++) {
    h ^= prompt.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `asset-${(h >>> 0).toString(36)}`;
}
const MAX_GENERATED_ASSETS_PER_BATCH = 2;
// Resolves at most a small, cost-controlled number of pending AI-generated
// visual assets per HUD-generation/edit batch. Reuses anything already
// cached under the same prompt (no fetch at all), mutates matching
// "create" ops' embedded component in place, and returns extra
// updateComponent ops for assets attached to already-existing components.
// Anything skipped (over the cap) or that fails simply leaves the
// AI-supplied icon/emoji fallback visible — an optional visual asset is
// never allowed to block or break HUD generation.
async function resolveGeneratedAssets(
  get: () => EditorState,
  set: (partial: Partial<EditorState>) => void,
  pending: PendingAsset[],
  ops: EditorOperation[],
): Promise<{ extraOps: EditorOperation[]; generated: number; reused: number; skipped: number }> {
  const extraOps: EditorOperation[] = [];
  let generated = 0, reused = 0, skipped = 0;
  let budget = MAX_GENERATED_ASSETS_PER_BATCH;
  const cache = get().generatedAssets;
  const newCacheEntries: Record<string, string> = {};
  const applyKey = (componentId: string, key: string) => {
    const createOp = ops.find(
      (o) => o.action === "createComponent" && o.component.id === componentId,
    ) as Extract<EditorOperation, { action: "createComponent" }> | undefined;
    if (createOp) createOp.component = { ...createOp.component, generatedAssetKey: key };
    else extraOps.push(updateComponent(componentId, { generatedAssetKey: key }));
  };
  for (const p of pending) {
    const key = assetCacheKey(p.prompt);
    if (cache[key] || newCacheEntries[key]) {
      applyKey(p.componentId, key);
      reused++;
      continue;
    }
    if (budget <= 0) {
      skipped++;
      continue;
    }
    budget--;
    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p.prompt }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || typeof body?.dataUrl !== "string")
        throw new Error(body?.error || "Asset generation failed.");
      newCacheEntries[key] = body.dataUrl;
      applyKey(p.componentId, key);
      generated++;
    } catch {
      skipped++;
    }
  }
  if (Object.keys(newCacheEntries).length)
    set({ generatedAssets: { ...get().generatedAssets, ...newCacheEntries } });
  return { extraOps, generated, reused, skipped };
}
// True if the design system's colors exactly match the default or one of
// the fixed direction presets — i.e. nothing the user hand-tuned in the
// Design System panel. Only in that case does AI-generated palette
// inspiration get to touch global color tokens (Milestone 3, section 7):
// customized work is never silently overwritten.
function matchesKnownColorPreset(ds: DesignSystem): boolean {
  const current = colorIds.map((id) => ds.colors[id].value.toLowerCase());
  const candidates = [defaultDesignSystem(), ...designDirections.map((d) => designSystemForDirection(d))];
  return candidates.some((c) =>
    colorIds.every((id, i) => c.colors[id].value.toLowerCase() === current[i]),
  );
}
// Turns a screenshot-inspired palette into color-token updates, guarding
// text-on-surface contrast so "inspiration" never produces unreadable UI.
function paletteToTokenOps(palette: AIAnalysisResult["palette"]): EditorOperation[] {
  const ops: EditorOperation[] = [];
  const surface = isValidHex(palette.suggestedSurface) ? palette.suggestedSurface : null;
  const text = isValidHex(palette.suggestedText) ? palette.suggestedText : null;
  const accent = isValidHex(palette.suggestedAccent) ? palette.suggestedAccent : null;
  const accent2 = isValidHex(palette.suggestedSecondaryAccent) ? palette.suggestedSecondaryAccent : null;
  if (surface)
    ops.push({ action: "updateDesignToken", tokenType: "colors", tokenId: "surface", changes: { value: surface } });
  if (surface && text)
    ops.push({
      action: "updateDesignToken",
      tokenType: "colors",
      tokenId: "textPrimary",
      changes: { value: ensureContrast(surface, text) },
    });
  if (accent)
    ops.push({ action: "updateDesignToken", tokenType: "colors", tokenId: "primary", changes: { value: accent } });
  if (accent2)
    ops.push({
      action: "updateDesignToken",
      tokenType: "colors",
      tokenId: "secondary",
      changes: { value: accent2 },
    });
  return ops;
}
export const useEditor = create<EditorState>((set, get) => ({
  schema: initialSchema(),
  designSystem: defaultDesignSystem(),
  gameData: structuredClone(initialGameData),
  gameContext: null,
  gameSource: null,
  projectId: "",
  projectName: "Untitled project",
  selectedId: null,
  mode: "edit",
  playing: false,
  connection: "disconnected",
  savedAt: null,
  dirty: false,
  ready: false,
  notice: "",
  history: [],
  future: [],
  aiStatus: "idle",
  aiAnalysis: null,
  aiError: null,
  generatedAssets: {},
  notify: (notice) => set({ notice }),
  apply: (operations, record = true) => {
    try {
      const prev = documentOf(get()),
        next = (Array.isArray(operations) ? operations : [operations]).reduce(
          applyEditorOperation,
          prev,
        );
      validateEditorDocument(next.schema, next.designSystem);
      set({
        ...next,
        dirty: true,
        ...(record
          ? { history: [...get().history.slice(-49), prev], future: [] }
          : {}),
        selectedId: next.schema.components.some(
          (c) => c.id === get().selectedId,
        )
          ? get().selectedId
          : null,
      });
      return true;
    } catch (e) {
      get().notify((e as Error).message);
      return false;
    }
  },
  checkpoint: () =>
    set({
      history: [...get().history.slice(-49), documentOf(get())],
      future: [],
    }),
  undo: () => {
    const s = get();
    if (s.history.length)
      set({
        ...s.history.at(-1)!,
        history: s.history.slice(0, -1),
        future: [documentOf(s), ...s.future],
        selectedId: null,
        dirty: true,
      });
  },
  redo: () => {
    const s = get();
    if (s.future.length)
      set({
        ...s.future[0],
        history: [...s.history, documentOf(s)],
        future: s.future.slice(1),
        selectedId: null,
        dirty: true,
      });
  },
  setGameValue: (key, value) => {
    const v = get().gameData[key];
    if (!v) return;
    if (
      v.type === "number" &&
      (!value.trim() || !Number.isFinite(Number(value)))
    )
      return;
    set({
      gameData: {
        ...get().gameData,
        [key]:
          v.type === "number"
            ? { type: "number", value: Number(value) }
            : { type: "string", value },
      },
      dirty: true,
    });
  },
  mergeMockGameData: (entries) => {
    const cur = get().gameData;
    const additions: typeof cur = {};
    for (const e of entries) {
      if (cur[e.key] || additions[e.key]) continue; // never overwrite a real variable
      if (e.type === "number" && typeof e.numberValue === "number")
        additions[e.key] = { type: "number", value: e.numberValue, mock: true };
      else if (e.type === "string" && typeof e.stringValue === "string")
        additions[e.key] = { type: "string", value: e.stringValue, mock: true };
    }
    if (Object.keys(additions).length)
      set({ gameData: { ...cur, ...additions }, dirty: true });
  },
  createWorkspace: (context, source) => {
    try {
      validateContext(context);
      validateSource(source);
      set({
        gameContext: context,
        gameSource: source,
        projectName: context.name,
        connection:
          source.kind === "imported" ? "disconnected" : get().connection,
        dirty: true,
        mode: "edit",
        playing: false,
        selectedId: null,
        // A brand-new project starts on a clean canvas — no leftover UI,
        // design tokens, game data, undo history, or cached screenshot
        // analysis from whatever was open before. (Replacing a game source
        // on an existing project is a different action — replaceGameSource,
        // below — which intentionally keeps all of this.)
        schema: initialSchema(),
        designSystem: defaultDesignSystem(),
        gameData: structuredClone(initialGameData),
        aiAnalysis: null,
        aiStatus: "idle",
        aiError: null,
        generatedAssets: {},
        history: [],
        future: [],
      });
      return true;
    } catch (e) {
      get().notify((e as Error).message);
      return false;
    }
  },
  replaceGameSource: (source) => {
    try {
      validateSource(source);
      set({
        gameSource: source,
        connection:
          source.kind === "imported" ? "disconnected" : get().connection,
        dirty: true,
        notice: "Game source replaced. Your UI, design system and data stayed the same.",
      });
      return true;
    } catch (e) {
      get().notify((e as Error).message);
      return false;
    }
  },
  analyzeGame: async () => {
    const s = get();
    if (s.aiStatus === "analyzing" || s.aiStatus === "generating" || s.aiStatus === "applying")
      return;
    if (!s.gameSource || s.gameSource.kind !== "screenshot") {
      get().notify(
        "AI analysis needs a screenshot. Upload one from Game Setup, or use Replace with Screenshot.",
      );
      return;
    }
    set({ aiStatus: "analyzing", aiError: null, notice: "Analyzing composition..." });
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: s.gameSource.imageData,
          gameContext: summarizeGameContext(s.gameContext),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || typeof body.summary !== "string")
        throw new Error(body?.error || "Analysis failed.");
      set({
        aiAnalysis: body as AIAnalysisResult,
        aiStatus: "idle",
        dirty: true,
        notice: "Analysis ready.",
      });
    } catch (e) {
      set({ aiStatus: "error", aiError: (e as Error).message });
      get().notify(`AI analysis failed: ${(e as Error).message}`);
    }
  },
  runAIInstruction: async (instruction) => {
    const s = get();
    if (s.aiStatus === "analyzing" || s.aiStatus === "generating" || s.aiStatus === "applying")
      return;
    set({
      aiStatus: "generating",
      aiError: null,
      notice: s.aiAnalysis ? "Designing HUD..." : "Thinking...",
    });
    try {
      const result = await requestAIOperations(get, instruction);
      set({ aiStatus: "applying", notice: "Applying UI..." });
      const assetOutcome = result.pendingAssets.length
        ? await resolveGeneratedAssets(get, set, result.pendingAssets, result.operations)
        : { extraOps: [], generated: 0, reused: 0, skipped: 0 };
      const finalOps = [...result.operations, ...assetOutcome.extraOps];
      if (finalOps.length) get().apply(finalOps);
      const assetNote = assetOutcome.generated
        ? ` Generated ${assetOutcome.generated} custom visual asset${assetOutcome.generated === 1 ? "" : "s"}.`
        : "";
      set({
        aiStatus: "idle",
        notice: `${result.summary}${assetNote}${noteSkipped(result.skipped)}`,
      });
    } catch (e) {
      set({ aiStatus: "error", aiError: (e as Error).message });
      get().notify(`AI request failed: ${(e as Error).message}`);
    }
  },
  // The explicit "Generate {Direction} HUD" action — distinct from
  // runAIInstruction's free-form edits. It (a) always applies the chosen
  // design direction's tokens so the result is visibly polished, not just
  // structurally new, and (b) replaces any HUD the AI previously generated
  // instead of stacking a duplicate set on top when the user regenerates.
  // Hand-placed (non-AI) components are never touched.
  generateHud: async (direction) => {
    const s = get();
    if (s.aiStatus === "analyzing" || s.aiStatus === "generating" || s.aiStatus === "applying")
      return;
    const dir = direction ?? s.aiAnalysis?.recommendedDirection ?? "Cozy";
    const instruction = s.aiAnalysis
      ? `Create a ${dir} HUD for this game. Follow the screenshot analysis closely: honor its safe zones and its guidance on what to keep clear (e.g. "${s.aiAnalysis.reasoning}").`
      : `Create a ${dir} HUD for this game.`;
    // Decide BEFORE generating whether the user has hand-tuned the Design
    // System panel — applying the direction preset below would make this
    // check meaningless afterward (it always matches the preset it just
    // applied).
    const colorsCustomized = !matchesKnownColorPreset(s.designSystem);
    set({ aiStatus: "generating", aiError: null, notice: "Finding visual language..." });
    try {
      const result = await requestAIOperations(get, instruction, dir);
      set({ aiStatus: "applying", notice: "Designing HUD..." });
      const priorAI = get().schema.components.filter((c) => c.aiGenerated);
      const replaceOps = priorAI.map((c) => deleteComponent(c.id));
      const paletteOps =
        !colorsCustomized && s.aiAnalysis ? paletteToTokenOps(s.aiAnalysis.palette) : [];
      const assetOutcome = result.pendingAssets.length
        ? await resolveGeneratedAssets(get, set, result.pendingAssets, result.operations)
        : { extraOps: [], generated: 0, reused: 0, skipped: 0 };
      const batch: EditorOperation[] = [
        { action: "applyDesignDirection", direction: dir },
        ...paletteOps,
        ...replaceOps,
        ...result.operations,
        ...assetOutcome.extraOps,
      ];
      get().apply(batch);
      const replacedNote = priorAI.length
        ? ` Replaced the previous AI-generated HUD (${priorAI.length} element${priorAI.length === 1 ? "" : "s"}).`
        : "";
      const paletteNote = paletteOps.length
        ? " Applied a color palette inspired by the screenshot."
        : colorsCustomized
          ? " Kept your customized Design System colors."
          : "";
      const mockNote = result.mockGameData.length
        ? ` Added ${result.mockGameData.length} mock preview variable${result.mockGameData.length === 1 ? "" : "s"} for binding.`
        : "";
      const assetNote =
        assetOutcome.generated || assetOutcome.reused
          ? ` Created ${assetOutcome.generated + assetOutcome.reused} custom visual asset${assetOutcome.generated + assetOutcome.reused === 1 ? "" : "s"}${assetOutcome.reused ? ` (${assetOutcome.reused} reused)` : ""}.`
          : "";
      set({
        aiStatus: "idle",
        notice: `${result.summary}${paletteNote}${mockNote}${assetNote}${replacedNote}${noteSkipped(result.skipped)}`,
      });
    } catch (e) {
      set({ aiStatus: "error", aiError: (e as Error).message });
      get().notify(`HUD generation failed: ${(e as Error).message}`);
    }
  },
  applyDirection: (direction) => {
    get().apply({ action: "applyDesignDirection", direction });
    get().notify(`Applied the ${direction} direction. Colors, type and spacing updated everywhere they're used.`);
  },
  save: () => {
    try {
      const s = get(),
        savedAt = new Date().toISOString();
      saveProject({
        version: "0.2",
        metadata: { id: s.projectId, name: s.projectName, savedAt },
        gameContext: s.gameContext,
        gameSource: s.gameSource,
        designSystem: s.designSystem,
        uiSchema: s.schema,
        gameData: s.gameData,
        aiAnalysis: s.aiAnalysis,
        generatedAssets: s.generatedAssets,
      });
      set({ savedAt, dirty: false, notice: "Project saved on this device." });
    } catch (e) {
      get().notify(`Could not save: ${(e as Error).message}`);
    }
  },
  initialize: async () => {
    if (get().ready) return;
    set({ ready: true, projectId: crypto.randomUUID() });
    try {
      const saved = loadProject();
      if (saved) {
        const p = saved.project;
        set({
          schema: p.uiSchema,
          designSystem: p.designSystem,
          gameData: p.gameData,
          gameContext: p.gameContext,
          gameSource: p.gameSource,
          projectId: p.metadata.id,
          projectName: p.metadata.name,
          savedAt: p.metadata.savedAt,
          aiAnalysis: p.aiAnalysis ?? null,
          generatedAssets: p.generatedAssets ?? {},
          dirty: saved.migrated,
          ...(saved.migrated
            ? {
                notice:
                  "Previous project recovered. Add a game to continue; original save preserved.",
              }
            : {}),
        });
      }
      // Restoring metadata never silently establishes a live engine connection.
    } catch (e) {
      get().notify(
        `Saved project could not be loaded: ${(e as Error).message}`,
      );
    }
  },
}));
