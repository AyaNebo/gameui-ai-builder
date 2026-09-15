// Minimal server-side connection check (milestone 2, section 4). Makes one
// cheap request and never returns the API key. GET so it's easy to verify
// by hand during development (open the URL, or `curl localhost:3000/api/ai/test`).
import { testOpenAIConnection } from "@/ai/client";
import { aiErrorResponse } from "@/ai/routeError";
import { NextResponse } from "next/server";
export async function GET() {
  try {
    const result = await testOpenAIConnection();
    return NextResponse.json(result);
  } catch (e) {
    return aiErrorResponse(e);
  }
}
