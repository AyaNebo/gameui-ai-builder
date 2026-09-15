// Centralized, server-only AI configuration. Nothing here is imported by
// client components — only by route handlers under src/app/api/ai/*.
//
// Model selection (Sep 2026): gpt-5-mini is OpenAI's current small
// multimodal model — it accepts image input (needed for screenshot
// analysis) and supports Structured Outputs, at a fraction of the cost of
// the flagship gpt-5 line, which fits a hackathon's repeated-iteration
// development loop better than always reaching for the most capable model.
// Override without touching code via OPENAI_MODEL in .env.local / Vercel.
export const AI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
// Low reasoning effort keeps these structured, well-specified tasks (JSON
// generation against a strict schema) fast and cheap — they don't need deep
// multi-step reasoning, just faithful extraction/composition.
export const AI_REASONING_EFFORT = "low" as const;
// Model for individual AI-generated visual assets (icons/artwork), kept
// separate from AI_MODEL since it's a different OpenAI endpoint/model
// family (image generation, not text/structured output). Override via
// OPENAI_IMAGE_MODEL without touching code.
export const AI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
// Normalizes and lightly validates OPENAI_API_KEY before it's ever used to
// construct the OpenAI client, so obviously-wrong values (whitespace,
// unfilled placeholders, an accidentally doubled "sk-" prefix from pasting
// a real key after a template that already had one) fail fast with a
// specific, actionable message instead of surfacing as a confusing
// downstream "OpenAI rejected the key" from an actual API round trip. Never
// logs or returns the key itself — only shape/length facts.
export function requireApiKey(): string {
  const raw = process.env.OPENAI_API_KEY;
  if (!raw || !raw.trim())
    throw new AIConfigError(
      "OPENAI_API_KEY is not set. Add it to .env.local (local) or your Vercel Project Environment Variables (production), then restart the dev server.",
    );
  let key = raw.trim();
  if (key !== raw)
    console.warn(
      "[ai/config] OPENAI_API_KEY in the environment has leading/trailing whitespace — trimmed automatically. Check .env.local for stray spaces or a trailing newline pasted with the key.",
    );
  // Common paste mistake: a template already reading "OPENAI_API_KEY=sk-"
  // followed by pasting a real key that itself starts with "sk-", yielding
  // "sk-sk-...". Auto-correct this one specific, unambiguous pattern.
  if (/^sk-sk-/.test(key)) {
    console.warn(
      '[ai/config] OPENAI_API_KEY starts with a duplicated "sk-" prefix (sk-sk-...) — this looks like a paste error. Using the value with the extra "sk-" removed. If this key still doesn’t work, re-copy it fresh from https://platform.openai.com/api-keys into .env.local.',
    );
    key = key.slice(3);
  }
  // Obvious non-key placeholders (unfilled template text, non-ASCII, or too
  // short to be a real secret) — fail before spending an API round trip.
  if (!/^sk-/.test(key) || key.length < 20 || /[^!-~]/.test(key))
    throw new AIConfigError(
      'OPENAI_API_KEY doesn’t look like a real OpenAI key (expected it to start with "sk-" and contain no placeholder text or non-ASCII characters). Open .env.local and paste a real key from https://platform.openai.com/api-keys.',
    );
  return key;
}
export class AIConfigError extends Error {}
