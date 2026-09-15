"use client";
import { useEffect, useRef, useState } from "react";
import { Gamepad2, RotateCcw, Plug, ImageOff } from "lucide-react";
import { useEditor } from "@/editor/store";
import { webGLUrl } from "@/editor/gameContext";
// The GameSourceLayer: renders whatever the user chose as the backdrop
// (a Unity WebGL build, an uploaded screenshot, or the mock stage when no
// source is connected/imported). GameCanvas overlays the UI on top of this,
// in the same 1920x1080 transformed coordinate space, so this component
// never manages its own scale or position — it always fills its parent.
export function GamePreview() {
  const s = useEditor(),
    [attempt, setAttempt] = useState(0),
    [status, setStatus] = useState<"loading" | "loaded" | "error">("loading"),
    [imageError, setImageError] = useState(false),
    iframeRef = useRef<HTMLIFrameElement>(null);
  const source = s.gameSource;
  const playing = s.mode === "game";
  useEffect(() => {
    setStatus("loading");
  }, [source, attempt]);
  useEffect(() => {
    setImageError(false);
  }, [source]);
  // Give the iframe real keyboard focus whenever Play Game mode is entered.
  // This is normal browser/iframe focus behavior (focusing the <iframe>
  // element hands keyboard input to its document) — no cross-origin message
  // forwarding is attempted, per the product decision to not over-engineer
  // input bridging into a page we don't control.
  useEffect(() => {
    if (playing && source?.kind === "imported" && status === "loaded") {
      iframeRef.current?.focus();
    }
  }, [playing, source, status]);
  if (source?.kind === "screenshot") {
    if (imageError)
      return (
        <div className="mock-stage">
          <div className="mock-scene-card">
            <ImageOff size={62} strokeWidth={1} />
            <h3>{s.gameContext?.name}</h3>
            <p>Screenshot could not be displayed.</p>
          </div>
        </div>
      );
    return (
      <img
        className="game-screenshot"
        src={source.imageData}
        alt={`${s.gameContext?.name ?? "Game"} screenshot`}
        draggable={false}
        onError={() => setImageError(true)}
      />
    );
  }
  if (source?.kind === "imported") {
    let src = "";
    try {
      src = webGLUrl(
        source.url,
        typeof window === "undefined" ? undefined : window.location.origin,
      );
    } catch {
      return (
        <div className="mock-stage">
          <p>Invalid build URL. Choose another game source.</p>
        </div>
      );
    }
    return (
      <>
        <iframe
          ref={iframeRef}
          key={`${src}-${attempt}`}
          className={`webgl-game ${playing ? "" : "blocked-input"}`}
          title={`${s.gameContext?.name} — Unity WebGL`}
          src={src}
          sandbox="allow-scripts allow-same-origin allow-pointer-lock"
          allow="gamepad; fullscreen"
          referrerPolicy="no-referrer"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
        {!playing && <div className="game-input-shield" />}
        <div className="webgl-status">
          {status === "loading"
            ? "Loading WebGL page…"
            : status === "error"
              ? "Build page failed to load"
              : playing
                ? "Play Game · Click the game to give it keyboard focus"
                : "Switch to Play Game to interact"}
          <button
            aria-label="Reload game build"
            onClick={(e) => {
              e.stopPropagation();
              setAttempt((n) => n + 1);
            }}
          >
            <RotateCcw size={22} />
          </button>
          <small>
            Blank or tiny view? The build host must allow embedding, and its
            own template controls whether the canvas stretches to fill the
            page — both are outside GameUI.
          </small>
        </div>
      </>
    );
  }
  return (
    <div className="mock-stage">
      <div className="mock-stage-horizon" />
      <div className="mock-scene-card">
        <Gamepad2 size={62} strokeWidth={1} />
        <h3>{s.gameContext?.name}</h3>
        <p>Unity mock preview</p>
        <span>
          <Plug size={16} />
          {s.connection === "connected"
            ? "Mock adapter connected"
            : "Mock adapter disconnected"}
        </span>
        <small>
          No live game stream. Your editable UI appears on this reference
          canvas.
        </small>
      </div>
      <div className="stage-coordinate">1920 × 1080 / GAME SPACE</div>
    </div>
  );
}
