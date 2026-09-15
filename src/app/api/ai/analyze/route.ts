// Screenshot vision analysis (milestone 2, section 6-8). The screenshot's
// data URL is sent to OpenAI directly as input_image — nothing is persisted
// server-side; this route is stateless.
import { NextResponse } from "next/server";
import { analyzeScreenshot } from "@/ai/client";
import { aiErrorResponse } from "@/ai/routeError";
import { AIRequestError } from "@/ai/client";
const MAX_IMAGE_DATA_URL_LENGTH = 6_000_000; // ~4.3MB binary after base64 overhead
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const imageDataUrl = body?.imageDataUrl;
    if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/"))
      throw new AIRequestError("No screenshot was provided to analyze.", "invalid_response");
    if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH)
      throw new AIRequestError(
        "That screenshot is too large for analysis. Try a smaller image.",
        "image_too_large",
      );
    const result = await analyzeScreenshot({
      imageDataUrl,
      gameContext: body?.gameContext ?? null,
    });
    return NextResponse.json(result);
  } catch (e) {
    return aiErrorResponse(e);
  }
}
