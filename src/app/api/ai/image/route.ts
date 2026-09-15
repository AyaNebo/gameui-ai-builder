// AI-generated visual asset endpoint (Focused Task: visually rich game UI).
// Generates exactly ONE small, individually-editable-component-sized visual
// asset (an icon/badge/artwork) — never a full HUD or screen — via OpenAI's
// image generation API. OPENAI_API_KEY never leaves the server; only the
// resulting data: URL crosses to the browser. Stateless: the client (see
// editor/store.ts) is responsible for caching results in the project so an
// identical prompt is never regenerated (cost control).
import { NextResponse } from "next/server";
import { generateAsset } from "@/ai/client";
import { aiErrorResponse } from "@/ai/routeError";
import { AIRequestError } from "@/ai/client";
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const prompt = body?.prompt;
    if (typeof prompt !== "string" || !prompt.trim())
      throw new AIRequestError("No asset prompt was provided.", "invalid_response");
    if (prompt.length > 300)
      throw new AIRequestError("That asset prompt is too long.", "invalid_response");
    const result = await generateAsset({ prompt: prompt.trim() });
    return NextResponse.json(result);
  } catch (e) {
    return aiErrorResponse(e);
  }
}
