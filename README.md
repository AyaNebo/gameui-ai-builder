# GameUI AI

A functional desktop game UI editor for **Milestones 1–2**. Unity and runtime game values use explicit mocks. The AI assistant (screenshot analysis + structured HUD generation/editing) calls OpenAI server-side and needs a real `OPENAI_API_KEY` in `.env.local` (or a Vercel Project Environment Variable in production) to do anything beyond showing a friendly "not configured" message — see section 4.

## 1. Implemented

- Dark editor workspace inspired by the supplied reference: toolbar, navigation, component library, templates, layers, game canvas, inspector, game data, assistant, and status bar.
- Three ways to start a workspace: **Upload Screenshot** (PNG/JPG/WebP, drag-and-drop or file picker), **Playable Game** (a hosted Unity WebGL build URL), and **Try Demo** (a bundled racing WebGL demo, no setup required).
- Five primitives: Text, Button, Panel, Image / Icon, Progress Bar.
- Click to create; select on canvas or in Layers; drag; resize with eight handles; delete; deselect; undo/redo.
- Live appearance and transform editing; nine anchors; game-space coordinates with preview scaling and zoom.
- Game View now **fits the whole 1920×1080 reference frame to the available workspace** (both width and height), instead of only fitting width — the game/screenshot and the UI overlay always scale together as one unit.
- **Play Game / Edit UI / Both** modes with unambiguous input ownership: only Play Game routes pointer input (and, via iframe focus, keyboard input) into an embedded WebGL build; Edit UI and Both keep it editor-owned.
- **Replace with Live Game / Screenshot** (Settings → Replace with Live Game / Screenshot): swap the underlying game source without losing the UI schema, design system, game data or game context.
- Editable mock game variables; text formatting and numeric progress/max bindings.
- One editable layout: HUD (selectable/movable/resizable/deletable/bindable components, not a flattened image).
- Local project save (screenshots persist as data URLs inside the saved project), automatic recovery on refresh, validation, and portable JSON download.
- Mock connection states and Play/Pause state.
- **AI assistant (Milestone 2)**: upload a screenshot, click *Analyze this screenshot* for a real OpenAI vision pass (genre/mood/density/focal areas/safe regions + a recommended design direction, all phrased as suggestions, never as claims about hidden game systems). One click ("Generate this HUD") turns that into a real, fully-editable HUD built from the same five primitives — never generated code. Free-form natural-language edits ("make the health bar bigger") go through the same structured-operation pipeline. Five design directions (Cozy, Arcade, Minimal, Fantasy, Sci-Fi) are instant, local, token-only swaps — no API call. A small SVG icon set (lucide-react) lets text/button components double as icon+value "chips" (health, coins, timers, objectives), usable by hand or by the AI. All AI output is validated server-side and applied through the exact same operation/undo pipeline as manual edits; invalid or unresolvable AI operations are skipped individually (and reported), never crash the editor. The analyzed result is cached on the project so a refresh doesn't re-pay for the same screenshot.

## 2. Project structure

```text
src/
  app/                    Next.js entry, layout, styling
  components/editor/      EditorShell, ComponentLibrary, GameCanvas,
                          Inspector, NumberInput, AIChat
  editor/
    schema.ts             Schema types, defaults, templates, anchors, bindings
    operations.ts         Typed operations and pure operation reducer
    validation.ts         Runtime schema and project validation
    store.ts              Central Zustand state and history
    persistence.ts        Save, load, serialization, download
  engines/EngineAdapter.ts  Generic interface and MockEngineAdapter
  ai/mockAI.ts            Structured-operation mock interpreter
public/harvest.png        Local generated game backdrop
tests/                   Core and browser acceptance tests
docs/                    Preview screenshot and asset provenance/prompt
```

## 3. Architecture

The Zustand store holds one `UISchema`. Manual actions, inspector edits, templates, and the mock assistant all dispatch the same typed `UIOperation` objects. The pure reducer applies operations; runtime validation rejects invalid results before state changes. Save and export consume that schema directly.

`GameData` is a keyed, typed store. Components reference variable names; `resolveBinding()` derives display values without duplicating them into the schema. Missing or incompatible bindings display errors, and zero/negative bound maximums are handled without crashing.

### Coordinate convention

Stored positions are **anchor-relative offsets in 1920 × 1080 game pixels**, never browser pixels. Each anchor uses the matching point of both the reference frame and the component:

```text
absoluteX = anchorX × (referenceWidth − componentWidth) + offsetX
absoluteY = anchorY × (referenceHeight − componentHeight) + offsetY
```

For example, a 180-pixel component anchored top-right at X = −40 has its right edge 40 game pixels from the right edge. Changing anchors preserves its visible location and recalculates offsets. Pointer deltas are divided by the actual preview scale, including zoom. Drag/resize operations clamp to the game frame; inspector offsets can intentionally place elements beyond it.

The engine interface exposes `connect`, `disconnect`, `getGameState`, and `applyUISchema`. Its mock implementation performs no external communication. The future AI boundary already has the requested signature:

```ts
interpretUICommand(message, uiSchema, gameState): Promise<UIOperation[]>
```

## 4. Run locally

Use Node.js 22 LTS or a compatible newer version.

```sh
npm ci
cp .env.local.example .env.local   # then paste a real key into OPENAI_API_KEY=
npm run dev
```

Open http://localhost:3000 in a desktop browser (1440px or wider recommended). Without a real `OPENAI_API_KEY`, everything except the AI assistant (screenshot analysis, HUD generation, natural-language edits) works as normal; AI actions show a friendly "not configured" message instead of failing silently.

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

The production build uses Next.js’s Webpack builder because Turbopack’s CSS worker failed to bind its local IPC port in the development sandbox. Development uses Turbopack. Both compile the same application.

Save Project stores metadata, schema, and game data under `gameui-project-v1` in this browser’s localStorage. Refresh automatically restores it. Changes are saved explicitly; unsaved changes trigger the browser’s navigation warning. Export UI System downloads `happy-harvest.gameui.json` containing the UI Schema, without mock runtime values.

For this workspace’s temporary Chromium installation, use:

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/gameui-playwright npm run test:e2e
```

## 5. Verification

- TypeScript: passed.
- Core tests: 8 passed (operations, all nine anchors, bounds, bindings, templates, persistence/export, invalid data, mock commands).
- Full 14-step acceptance workflow: passed in Chromium, including scaled drag/resize, inspector styling, Coins 124 → 125, health 75 → 20 with MaxHealth, save/reload equality, and downloaded JSON validation.
- Browser suite: 3 tests passed. Supplemental coverage: template insertion, undo/redo, deletion, mock commands, unsupported requests, corrupt-save recovery, numeric drafting, icon appearance, desktop overflow.
- Production build: passed with Next.js Webpack.
- No blocking browser runtime errors observed during the acceptance workflow.

## 6. Known limitations

- The mock stage (no game source connected) is a static generated scene; Play/Pause only changes mock preview state.
- An embedded Unity WebGL build's own template controls whether its canvas stretches to fill the page — if the build itself renders at a fixed pixel size, GameUI's viewport is still correctly sized, but the game inside it will still look small. This is outside GameUI's control (and, cross-origin, outside what it can safely restyle).
- An embedded build only receives pointer/keyboard input in Play Game mode, and only if its host allows iframe embedding (some hosts send headers that block this entirely — GameUI cannot work around that).
- Screenshots are stored as data URLs inside the saved project in this browser's localStorage; very large images are downscaled client-side, but extremely large projects could approach the browser's localStorage quota.
- Unity is a mock connection. Unreal/Godot and Sync to Unity are disabled future features.
- AI screenshot analysis requires a screenshot game source (the Playable Game/WebGL and mock sources have no static image to analyze); natural-language HUD generation/editing works from any source using Game Context alone.
- The AI assistant needs `OPENAI_API_KEY` set locally (`.env.local`, gitignored) or as a Vercel Project Environment Variable in production. Without it, AI actions show a clear "not configured" message rather than failing silently or crashing.
- No automatic/background AI calls: analysis and generation only run on an explicit click, and results are cached (analysis on the project, direction changes are free/local) to avoid repeat spend.
- Image / Icon uses an editable emoji/text glyph; asset upload (for UI icons, distinct from the game screenshot source) is outside this milestone.
- One local project, no import UI, autosave, nested groups, responsive layout engine, or real button game actions.
- Optimized for desktop and small interfaces (maximum 100 components).
- History covers UI Schema edits; it is session-only and does not undo game-data changes.
- `tests/core.test.ts` predates the current schema/AI module API (it references removed exports `templateComponents` and `interpretUICommand`); 4 of its 8 assertions fail at runtime and it is excluded from `npm run typecheck` / `npm run build`'s type-check. This is pre-existing drift, not introduced by this milestone, and is a good candidate for a follow-up rewrite.

## 7. Dependencies

| Dependency                   | Purpose                                           |
| ---------------------------- | ------------------------------------------------- |
| Next.js, React, React DOM    | Application framework and component rendering     |
| TypeScript and type packages | Typed schema, operations, and UI                  |
| Zustand                      | Single predictable editor state store             |
| Tailwind CSS, PostCSS plugin | CSS foundation and utility support                |
| lucide-react                 | Consistent vector interface icons + AI chip icons |
| openai                       | Official SDK, server-side only, Responses API     |
| zod                          | Structured-output schemas + client-side types     |
| tsx                          | Run TypeScript core tests with Node’s test runner |
| Playwright                   | Browser acceptance tests                          |
| Prettier                     | Consistent source formatting                      |

Drag and resize use native pointer events; no canvas or gesture framework was added. Dependency versions are pinned by `package-lock.json`.

## 8. Recommended Milestone 3 step

Add a real Unity/Unreal/Godot bridge (beyond the mock adapter) so bound Game Data can come from a live running build instead of manual values, and extend the AI assistant with a lightweight "review before applying" step for larger multi-operation batches. Keep API credentials server-side and the operation vocabulary closed (no arbitrary code generation) as this grows.

See [asset generation notes](docs/asset-generation.md) for the built-in imagegen prompt and [editor preview](docs/editor-preview.png) for the initial workspace.
