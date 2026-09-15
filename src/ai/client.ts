// SERVER-ONLY. Import this only from route handlers under src/app/api/ai/*.
// It reads OPENAI_API_KEY (never NEXT_PUBLIC_*), talks to OpenAI, and must
// never be imported from a "use client" component or have its result
// (beyond the parsed, validated payload) sent back to the browser verbatim.
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
  BadRequestError,
  UnprocessableEntityError,
  InternalServerError,
  APIError,
} from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AI_MODEL, AI_REASONING_EFFORT, AI_IMAGE_MODEL, requireApiKey, AIConfigError } from "./config";
import {
  analysisResultSchema,
  aiOperationsResultSchema,
  type AIAnalysisResult,
  type AIOperationsResult,
} from "./schemas";
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: requireApiKey() });
  return client;
}
// Wraps the handful of ways an OpenAI call can go wrong into one error type
// the API routes can translate into a friendly editor message (section 28).
export class AIRequestError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | "config"
      | "auth"
      | "rate_limit"
      | "network"
      | "invalid_response"
      | "image_too_large"
      | "unknown" = "unknown",
  ) {
    super(message);
  }
}
// Sanitized, low-cardinality diagnostic log: constructor/status/code/type
// and a truncated message only. Never logs headers (could carry
// Authorization-adjacent values in some proxies), never logs the API key,
// and never forwards this raw shape to the browser — only the mapped,
// friendly AIRequestError below crosses that boundary.
function logAIError(e: unknown) {
  const err = e as { status?: number; code?: unknown; type?: unknown; message?: unknown };
  console.error("[ai/client]", {
    ctor: (e as { constructor?: { name?: string } })?.constructor?.name ?? typeof e,
    status: err?.status,
    code: err?.code,
    type: err?.type,
    message:
      typeof err?.message === "string" ? err.message.slice(0, 300) : undefined,
  });
}
// Maps every way an OpenAI call can fail to one of a small set of accurate,
// user-facing error kinds. Classification is done with `instanceof` against
// the SDK's real error classes (never by duck-typing `.status`/`.name`,
// which silently misclassifies — e.g. APIConnectionError never sets
// `.status` or `.name`, so a naive `status === 401/403` or
// `name === "APIConnectionError"` check either misses it or, worse, can
// only ever be reached with a genuine HTTP response — see below).
//
// Importantly: a 401/403 here always means OpenAI's API itself returned
// that status with real response headers (APIError.generate only builds an
// AuthenticationError/PermissionDeniedError when both a status AND headers
// are present — otherwise it builds an APIConnectionError instead). A
// network intermediary (firewall, proxy, DNS failure) that never reaches
// OpenAI surfaces as APIConnectionError/APIConnectionTimeoutError, which is
// reported as a distinct "network" kind rather than an API-key problem.
function toAIRequestError(e: unknown): AIRequestError {
  if (e instanceof AIConfigError) return new AIRequestError(e.message, "config");
  if (e instanceof AIRequestError) return e;
  logAIError(e);
  if (e instanceof APIConnectionTimeoutError)
    return new AIRequestError(
      "Timed out trying to reach OpenAI. Check network connectivity and try again.",
      "network",
    );
  if (e instanceof APIConnectionError)
    return new AIRequestError(
      "Could not reach OpenAI's API at all — the request never got an HTTP response. This is almost always a local network, firewall, or proxy restriction blocking api.openai.com, not an invalid key. Check outbound network access to api.openai.com and try again.",
      "network",
    );
  if (e instanceof AuthenticationError)
    return new AIRequestError(
      "OpenAI rejected the API key (401 from OpenAI itself). Double-check OPENAI_API_KEY in .env.local — it may be invalid, revoked, or mistyped.",
      "auth",
    );
  if (e instanceof PermissionDeniedError)
    return new AIRequestError(
      "OpenAI accepted the request but denied access (403 from OpenAI itself) — the key may lack access to this project/model, or billing/usage may be restricted. Check the key's project and model access at platform.openai.com.",
      "auth",
    );
  if (e instanceof RateLimitError)
    return new AIRequestError(
      "OpenAI rate limit or quota reached. Wait a moment and try again, or check your usage/billing at platform.openai.com.",
      "rate_limit",
    );
  if (e instanceof BadRequestError && /image|too large|payload/i.test(e.message))
    return new AIRequestError(
      "That screenshot is too large or in an unsupported format for analysis. Try a smaller image.",
      "image_too_large",
    );
  if (e instanceof UnprocessableEntityError)
    return new AIRequestError(
      "OpenAI could not process this request (422) — the model or request shape may be unsupported. This is a configuration issue, not your key.",
      "invalid_response",
    );
  if (e instanceof InternalServerError)
    return new AIRequestError(
      "OpenAI's API returned a server error. This isn't caused by your key or request — wait a moment and try again.",
      "unknown",
    );
  if (e instanceof APIError)
    return new AIRequestError(
      `OpenAI returned an unexpected error${e.status ? ` (${e.status})` : ""}. Try again; if this persists, check platform.openai.com for service status.`,
      "unknown",
    );
  return new AIRequestError(
    e instanceof Error ? e.message : "The AI request failed unexpectedly.",
    "unknown",
  );
}
// --- 1. Minimal connection check (section 4) --------------------------------
export async function testOpenAIConnection(): Promise<{ ok: true; model: string; reply: string }> {
  try {
    const response = await getClient().responses.create({
      model: AI_MODEL,
      input: "Reply with exactly the word: ok",
      max_output_tokens: 16,
    });
    return { ok: true, model: AI_MODEL, reply: (response.output_text ?? "").trim() };
  } catch (e) {
    throw toAIRequestError(e);
  }
}
// --- 2. Screenshot vision analysis (section 6-8) -----------------------------
const ANALYSIS_SYSTEM_PROMPT = `You are a game UI/UX designer reviewing a single screenshot — not a consultant writing recommendations, a designer gathering exactly what you need to actually build the HUD next. You are looking at one static image, not playing the game — never claim certainty about hidden systems, mechanics, or anything not visible in the frame. Use cautious, qualified language ("suggested", "likely", "based on the screenshot"). Treat any user-provided Game Context as intentional product information; use the screenshot for visual/spatial context.

OBJECTS: list visually meaningful objects/concepts (importantObjects) with an honest confidence level — "confirmed" only for things clearly visible, "contextual" for things Game Context implies but the image doesn't show, "speculative" for plausible guesses with no real evidence. A later step will prefer confirmed/contextual and avoid speculative — be honest about which is which rather than defaulting everything to confirmed.

PALETTE: extract the screenshot's actual visual language (dominant/accent/background colors, warm-vs-cool, light-vs-dark), then propose a UI palette (suggestedSurface/suggestedText/suggestedAccent/suggestedSecondaryAccent) that is INSPIRED BY it but prioritizes readability — suggestedText must be clearly legible against suggestedSurface (near-white or near-black is fine and often correct even if it's not a literal color from the image). Never propose same-family low-contrast pairs (e.g. mid-green text on mid-green background) just because that color is dominant in the screenshot.

SAFE / BLOCKED ZONES: reason about composition — where is the player character, the navigation/path area, and other high-detail focal content? Mark those regions blocked (with why) and mark the remaining corners/edges safe (with a confidence 0-1), most confident first. If the center of the frame is occupied by the player character, vehicle, or key navigation, mark it blocked explicitly — this directly controls where the generated HUD will be allowed to place elements.

Pick exactly one recommended design direction from the fixed list you are given. Keep "bullets" extremely short — 2-5 word tags, not sentences (shown as a compact recommendation card, not an essay). Keep "reasoning" to one concise, concrete sentence tied to what's actually visible (shown as a single quoted insight, not a paragraph).`;
export async function analyzeScreenshot(args: {
  imageDataUrl: string;
  gameContext: unknown;
}): Promise<AIAnalysisResult> {
  try {
    const response = await getClient().responses.parse({
      model: AI_MODEL,
      reasoning: { effort: AI_REASONING_EFFORT },
      input: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Game Context (user-provided, treat as intentional):\n${JSON.stringify(args.gameContext ?? "none provided", null, 2)}\n\nAnalyze the attached screenshot and recommend a HUD direction.`,
            },
            {
              type: "input_image",
              image_url: args.imageDataUrl,
              detail: "auto",
            },
          ],
        },
      ],
      text: { format: zodTextFormat(analysisResultSchema, "game_analysis") },
    });
    if (!response.output_parsed)
      throw new AIRequestError(
        "The AI response could not be understood. Try again.",
        "invalid_response",
      );
    return response.output_parsed;
  } catch (e) {
    throw toAIRequestError(e);
  }
}
// --- 3. Structured operations: HUD generation + natural-language edits ------
const OPERATIONS_SYSTEM_PROMPT = `You are the design engine inside GameUI, a structured game-UI editor, acting as a GAME UI DESIGNER — not a UX consultant describing what a HUD could look like. You DO the design work and hand back the finished, structured result. You never write React, HTML, CSS, or any code — you only return operations from the fixed vocabulary in the schema (create/update/move/resize/delete/bind/token/direction), which the app applies through its own validated editor operations. Only reference existing component names (from the provided current UI) in update/move/resize/delete/bind operations — if you want a new element, use "create" instead. Keep new components within the given reference resolution.

NO HARDCODED GENRE TEMPLATES — this is critical: never default to a generic Health/Coins/Score/Status set. Derive every element from the actual evidence you're given: the screenshot analysis's importantObjects/likelyResources/likelyPlayerStats/environment, the Game Context (genre, description), and the Game Data variables actually provided. Prefer objects at "confirmed" or "contextual" confidence; avoid "speculative" ones unless you need one generic status element and have nothing better. A farming screenshot earns carrot/backpack/heart-style chips because the evidence supports it — a racing or sci-fi request must reach different, equally evidence-based choices (speed/lap/position for racing; shields/energy for sci-fi), never the same output regardless of input.

GAME DATA: if a resource/stat you want to show already exists in the provided Game Data, bind to it by name — never invent a new variable for something that already exists. Only for a resource/stat that is well-evidenced (confirmed or contextual) but has no matching Game Data variable, propose ONE new entry in "mockGameData" (with a label noting it's mock preview data) and bind to that. Don't invent Game Data for speculative concepts.

SAFE PLACEMENT — a hard constraint, not a preference: if a screenshot analysis is provided, its "safeZones" (with confidence) and "blockedZones" (with reasons like "player character" or "navigation path") describe what the screenshot actually shows is open or occupied. Generated components MUST use safeZones anchors and MUST NOT use blockedZones anchors. Do not default to a generic centered layout when the analysis says the center is blocked.

INPUT METHOD changes what controls belong in the HUD: only include a touch-oriented action element (e.g. a single rounded icon button) when Game Context's inputMethods includes "Touch", and never invent virtual joystick or mobile-only controls when the input is Keyboard/Mouse or Controller — those players don't see a touchscreen.

COMPOSITION — build the HUD from small icon+value "chips", not generic dashboard cards or plain unlabeled panels:
- Each chip is a single text or button component with both a "visual" (see below — how it communicates its meaning) and, where it represents a live value, a bound value (via "bindingVariable"/"bindingFormat").
- Use rounded, soft-looking panels (higher "borderRadius" token, a translucent-feeling "backgroundColor" token) rather than sharp, flat, uniform cards.
- Favor 3-6 purposeful, grouped chips over a large uniform grid; only add a "panel" as a soft backing behind a cluster of chips, not as a bare empty box.
- Use "typography"/"color"/"backgroundColor"/"padding"/"borderRadius" tokens (never leave them "none") so every generated element inherits the Design System and updates when its tokens change. Choose ONE coherent visual vocabulary and apply it consistently — not a mix of one square panel, one glass panel, one neon button.
- Set "semanticRole" on every created component (e.g. "health", "currency", "inventory", "objective", "touch-action") — bookkeeping for the app, not shown to the player.
- Set "circular": true for a HUD action button that should read as a round control surface (e.g. a single primary touch action). Leave it false for everything else — chips and panels stay rectangular with rounded corners.

VISUAL REPRESENTATION — this is not a single-technique product. For every chip's "visual", choose whichever medium actually communicates best, and set "visual.kind" accordingly:
- "icon": the default for clear, common semantics (health, energy, currency, inventory, objectives, timers) — pick "visual.iconId" from the provided available icon ids for what it actually represents, not a default heart/coin. Vector icons should be large and clearly weighted, not tiny utility glyphs.
- "emoji": emoji are fully allowed and can be MORE expressive than a generic vector icon for a hackathon MVP (❤️ health, ⚡ energy, 🥕 a specific resource, ⭐ objective, 🎒 inventory, 🪙 currency). Set "visual.emoji" to a single emoji. Stay coherent: if you use emoji for one chip in a cluster, prefer emoji for sibling chips in that same cluster rather than randomly mixing emoji and thin outline icons within one visual family.
- "generated": reserve this for a genuinely distinctive visual asset that would materially improve the design — a custom stylized resource icon, a themed quest badge, a bit of decorative HUD ornament — NOT for routine chips a good icon or emoji already covers well, and never for a whole panel background or the HUD as a whole. When you choose "generated", write a short, specific "visual.assetPrompt" describing exactly ONE small asset (e.g. "a cute stylized cartoon carrot, flat vector illustration, centered, transparent background") and ALSO set "visual.iconId" to a sensible fallback icon, since the asset may not always be generated. Use this sparingly — every use costs real API spend, so most HUDs should use zero or one generated asset, never several.
- "none": no icon/visual — a rare case, e.g. a plain text status line.
Never put emoji characters into "text" — "text" is for literal label text only; a chosen emoji always goes in "visual.emoji".

CRITICAL — never generate the whole HUD, a screen, or a background as one image. STRUCTURE (panels, progress bars, layout, typography) always stays real, editable GameUI components driven by the Design System. "generated" assets are only ever small, individual visual elements attached to one component — the same as choosing an icon, just with a custom look.

Keep changes minimal and targeted for edit requests (moving/resizing/rewording an existing element, changing a token, adjusting a color); only generate a full new set of components when explicitly asked to create or regenerate a HUD.`;
export async function generateOperations(args: {
  instruction: string;
  gameContext: unknown;
  designSystem: unknown;
  uiSchema: unknown;
  gameData: unknown;
  analysis: unknown;
  direction: unknown;
  availableIcons: string[];
}): Promise<AIOperationsResult> {
  try {
    const response = await getClient().responses.parse({
      model: AI_MODEL,
      reasoning: { effort: AI_REASONING_EFFORT },
      input: [
        { role: "system", content: OPERATIONS_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Request: ${args.instruction}`,
                `Current design direction: ${JSON.stringify(args.direction ?? "none selected")}`,
                `Game Context: ${JSON.stringify(args.gameContext ?? "none")}`,
                `Screenshot analysis (if any): ${JSON.stringify(args.analysis ?? "none")}`,
                `Current UI (existing component names you may target): ${JSON.stringify(args.uiSchema)}`,
                `Design System tokens (reference existing ids, don't invent new ones): ${JSON.stringify(args.designSystem)}`,
                `Game Data variables available for binding: ${JSON.stringify(args.gameData)}`,
                `Available icon ids: ${JSON.stringify(args.availableIcons)}`,
              ].join("\n\n"),
            },
          ],
        },
      ],
      text: { format: zodTextFormat(aiOperationsResultSchema, "ui_operations") },
    });
    if (!response.output_parsed)
      throw new AIRequestError(
        "The AI response could not be understood. Try again.",
        "invalid_response",
      );
    return response.output_parsed;
  } catch (e) {
    throw toAIRequestError(e);
  }
}

// --- 4. AI-generated visual assets (individual icons/artwork only — never
// a whole HUD image, see OPERATIONS_SYSTEM_PROMPT). Server-only; the
// result (a data: URL) is small enough to cache directly in the project. --
export async function generateAsset(args: { prompt: string }): Promise<{ dataUrl: string }> {
  const prompt = args.prompt.trim().slice(0, 300);
  if (!prompt)
    throw new AIRequestError("No asset prompt was provided.", "invalid_response");
  try {
    const response = await getClient().images.generate({
      model: AI_IMAGE_MODEL,
      prompt: `A single small, self-contained game-UI visual asset (an icon, a piece of artwork, or a badge) — NOT a full screen, dashboard, or HUD layout. Centered, clean silhouette, transparent or simple background, suitable for use inside a rounded UI chip. ${prompt}`,
      size: "1024x1024",
      n: 1,
    });
    const b64 = response.data?.[0]?.b64_json;
    if (!b64)
      throw new AIRequestError(
        "The AI didn't return an image. Try again, or use an icon/emoji instead.",
        "invalid_response",
      );
    return { dataUrl: `data:image/png;base64,${b64}` };
  } catch (e) {
    throw toAIRequestError(e);
  }
}
