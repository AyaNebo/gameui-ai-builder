import { NextResponse } from "next/server";
import { AIRequestError } from "./client";
const statusFor: Record<AIRequestError["kind"], number> = {
  config: 500,
  auth: 500,
  rate_limit: 429,
  network: 502,
  invalid_response: 502,
  image_too_large: 413,
  unknown: 500,
};
// Turns any thrown error from an AI route into a friendly, secret-free JSON
// body (section 28). Never includes stack traces, raw SDK errors, or the API
// key. The `kind` lets the client pick a tailored message/retry affordance.
export function aiErrorResponse(e: unknown) {
  const err =
    e instanceof AIRequestError
      ? e
      : new AIRequestError("Something went wrong talking to the AI.", "unknown");
  return NextResponse.json(
    { error: err.message, kind: err.kind },
    { status: statusFor[err.kind] },
  );
}
