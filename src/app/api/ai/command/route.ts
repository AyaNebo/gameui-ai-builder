// Structured HUD generation + natural-language editing (milestone 2, section
// 15-18). Returns validated operations only — never code. The client is
// responsible for translating these into real editor operations (see
// src/editor/aiOperations.ts) and applying them through the existing,
// already-validated operation pipeline.
import { NextResponse } from "next/server";
import { generateOperations } from "@/ai/client";
import { aiErrorResponse } from "@/ai/routeError";
import { AIRequestError } from "@/ai/client";
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const instruction = body?.instruction;
    if (typeof instruction !== "string" || !instruction.trim())
      throw new AIRequestError("No instruction was provided.", "invalid_response");
    if (instruction.length > 2000)
      throw new AIRequestError("That request is too long.", "invalid_response");
    const result = await generateOperations({
      instruction: instruction.trim(),
      gameContext: body?.gameContext ?? null,
      designSystem: body?.designSystem ?? null,
      uiSchema: body?.uiSchema ?? null,
      gameData: body?.gameData ?? null,
      analysis: body?.analysis ?? null,
      direction: body?.direction ?? null,
      availableIcons: Array.isArray(body?.availableIcons) ? body.availableIcons : [],
    });
    return NextResponse.json(result);
  } catch (e) {
    return aiErrorResponse(e);
  }
}
