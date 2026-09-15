export const genres = [
  "Action",
  "Adventure",
  "RPG",
  "Platformer",
  "FPS",
  "Strategy",
  "Racing",
  "Simulation",
  "Cozy",
  "Puzzle",
  "Other",
] as const;
export const perspectives = [
  "2D",
  "2.5D",
  "First Person",
  "Third Person",
  "Top Down",
  "Isometric",
  "Other",
] as const;
export const platforms = ["PC", "Console", "Mobile", "Web"] as const;
export const inputMethods = [
  "Keyboard",
  "Keyboard + Mouse",
  "Controller",
  "Touch",
] as const;
export interface GameContext {
  id: string;
  name: string;
  genre: (typeof genres)[number];
  perspective: (typeof perspectives)[number];
  platforms: (typeof platforms)[number][];
  inputMethods: (typeof inputMethods)[number][];
  description?: string;
  engine: "unity" | "unreal" | "godot" | "unknown";
}
export type ImportedGameSource = {
  kind: "imported";
  format: "unity-webgl";
  url: string;
};
export type ConnectedEngineSource = {
  kind: "connected";
  engine: "unity";
  adapter: "mock";
};
export type ScreenshotGameSource = {
  kind: "screenshot";
  imageData: string;
};
export type GameSource =
  | ImportedGameSource
  | ConnectedEngineSource
  | ScreenshotGameSource;
// Screenshots are stored as data URLs directly in the saved project (localStorage),
// so they survive refresh/reload without any backend. Kept well under the ~5MB
// localStorage budget after client-side downscaling in GameOnboarding.
export const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;
export function isDataImageUrl(value: string): boolean {
  return /^data:image\/(png|jpeg|webp);base64,/.test(value);
}
// The demo game used by "Try Demo" — an externally hosted Unity WebGL build.
// GameUI does not bundle or modify this game; it is only iframed by URL.
export const DEMO_GAME_URL = "https://aditdesai.github.io/racing-game/";
export const demoGameContextDefaults: Pick<
  GameContext,
  "genre" | "perspective" | "platforms" | "inputMethods"
> = {
  genre: "Racing",
  perspective: "Third Person",
  platforms: ["Web"],
  inputMethods: ["Keyboard"],
};
export function webGLUrl(raw: string, editorOrigin?: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter a full http:// or https:// Unity WebGL build URL.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error(
      "Use an HTTP or HTTPS build URL without embedded credentials.",
    );
  if (/\.(exe|apk|ipa|zip|unitypackage|dmg|app)(?:\/)?$/i.test(url.pathname))
    throw new Error(
      "Use the hosted Unity WebGL index page, not a native build or archive.",
    );
  if (editorOrigin && url.origin === editorOrigin)
    throw new Error(
      "Host the WebGL build on a separate origin or port from this editor.",
    );
  return url.href;
}
