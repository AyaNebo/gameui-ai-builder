"use client";
import {
  useRef,
  useState,
  useEffect,
  type PointerEvent,
  CSSProperties,
} from "react";
import {
  Minus,
  Plus,
  Maximize,
  MousePointer2,
  Undo2,
  Redo2,
  Hand,
} from "lucide-react";
import { useEditor } from "@/editor/store";
import {
  absolutePosition,
  resolveBinding,
  type UIComponent,
} from "@/editor/schema";
import { moveComponent, resizeComponent } from "@/editor/operations";
import { resolveStyle } from "@/editor/designSystem";
import { Icon } from "@/editor/icons";
import { GamePreview } from "./GamePreview";
const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const modes = [
  ["game", "Play Game"],
  ["edit", "Edit UI"],
  ["both", "Both"],
] as const;
export function GameCanvas() {
  const s = useEditor(),
    box = useRef<HTMLDivElement>(null),
    [viewport, setViewport] = useState({ width: 800, height: 450 }),
    [zoom, setZoom] = useState(1),
    // Manual pan offset, on top of the centered "fit" baseline — see
    // panGesture below for why this replaces plain browser scrolling.
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [panTool, setPanTool] = useState(false),
    [spaceHeld, setSpaceHeld] = useState(false),
    [panning, setPanning] = useState(false);
  const gesture = useRef<{
    id: string;
    handle: string;
    x: number;
    y: number;
    left: number;
    top: number;
    w: number;
    h: number;
    scale: number;
  } | null>(null);
  // Space+drag pans like Figma/Photoshop, on top of the explicit Hand tool
  // toggle and middle-mouse-drag (handled in panDown below).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && !e.repeat && !(e.target as HTMLElement)?.closest("input,textarea"))
        setSpaceHeld(true);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceHeld(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);
  const panGesture = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  function panDown(e: PointerEvent) {
    if (!(panTool || spaceHeld || e.button === 1)) return;
    e.preventDefault();
    e.stopPropagation();
    panGesture.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setPanning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function panMove(e: PointerEvent) {
    const g = panGesture.current;
    if (!g) return;
    setPan({ x: g.panX + (e.clientX - g.x), y: g.panY + (e.clientY - g.y) });
  }
  function panUp() {
    panGesture.current = null;
    setPanning(false);
  }
  useEffect(() => {
    if (!box.current) return;
    const ob = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setViewport({ width, height });
    });
    ob.observe(box.current);
    return () => ob.disconnect();
  }, []);
  const res = s.schema.referenceResolution;
  // "Fit" is the baseline: the whole 1920x1080 game view scales uniformly —
  // by whichever of width/height is more constraining — to fit entirely
  // inside the available workspace, like a creative app's canvas preview.
  // Zoom is a multiplier on top of that baseline, not a replacement for it.
  const fitScale = Math.min(
      viewport.width / res.width || 0,
      viewport.height / res.height || 0,
    ) || 1,
    scale = fitScale * zoom;
  function start(e: PointerEvent, c: UIComponent, handle = "move") {
    if (s.mode === "game" || e.button !== 0) return;
    // Hand tool / Space-drag takes priority over element interaction —
    // don't stop propagation, so the pan handler on the viewport (below)
    // gets this pointerdown instead.
    if (panTool || spaceHeld) return;
    e.stopPropagation();
    e.preventDefault();
    s.checkpoint();
    useEditor.setState({ selectedId: c.id });
    const p = absolutePosition(c, res);
    gesture.current = {
      id: c.id,
      handle,
      x: e.clientX,
      y: e.clientY,
      left: p.x,
      top: p.y,
      w: c.size.width,
      h: c.size.height,
      scale,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    const dx = (e.clientX - g.x) / g.scale,
      dy = (e.clientY - g.y) / g.scale;
    if (g.handle === "move") {
      s.apply(
        moveComponent(g.id, Math.round(g.left + dx), Math.round(g.top + dy)),
        false,
      );
      return;
    }
    let l = g.left,
      t = g.top,
      r = l + g.w,
      b = t + g.h;
    if (g.handle.includes("w")) l = Math.max(0, Math.min(r - 24, l + dx));
    if (g.handle.includes("e"))
      r = Math.min(res.width, Math.max(l + 24, r + dx));
    if (g.handle.includes("n")) t = Math.max(0, Math.min(b - 24, t + dy));
    if (g.handle.includes("s"))
      b = Math.min(res.height, Math.max(t + 24, b + dy));
    s.apply(
      resizeComponent(
        g.id,
        Math.round(r - l),
        Math.round(b - t),
        Math.round(l),
        Math.round(t),
      ),
      false,
    );
  }
  const editing = s.mode !== "game";
  return (
    <section className="canvas-section">
      <div className="canvas-toolbar">
        <div className="segmented view-modes">
          {modes.map(([mode, label]) => (
            <button
              key={mode}
              className={s.mode === mode ? "active" : ""}
              onClick={() => useEditor.setState({ mode })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="canvas-tools">
          <span className="resolution">1920 × 1080</span>
          <div className="zoom">
            <button
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}
            >
              <Minus size={14} />
            </button>
            <button title="Fit to workspace" onClick={() => setZoom(1)}>
              {Math.round(zoom * 100)}%
            </button>
            <button
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
            >
              <Plus size={14} />
            </button>
          </div>
          <button
            className="icon-button"
            title="Fit to workspace"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <Maximize size={16} />
          </button>
          <button
            className={`icon-button ${panTool ? "active" : ""}`}
            aria-label="Pan tool"
            title="Pan tool — drag to move the view around (or hold Space)"
            onClick={() => setPanTool((v) => !v)}
          >
            <Hand size={16} />
          </button>
        </div>
      </div>
      <div
        className={`canvas-viewport ${panTool || spaceHeld ? "pan-mode" : ""} ${panning ? "panning" : ""}`}
        ref={box}
        onPointerDown={panDown}
        onPointerMove={panMove}
        onPointerUp={panUp}
        onPointerCancel={panUp}
      >
        <div
          className="canvas-space"
          style={{
            width: res.width * scale,
            height: res.height * scale,
            transform: `translate(${Math.max(0, (viewport.width - res.width * scale) / 2) + pan.x}px, ${Math.max(0, (viewport.height - res.height * scale) / 2) + pan.y}px)`,
          }}
        >
          <div
            className={`game-world ${s.mode === "edit" ? "edit-world" : ""}`}
            data-testid="game-canvas"
            style={{
              width: res.width,
              height: res.height,
              transform: `scale(${scale})`,
            }}
            onPointerDown={() => {
              if (!panTool && !spaceHeld) useEditor.setState({ selectedId: null });
            }}
          >
            <GamePreview />
            {s.schema.components.map((c) => {
              const p = absolutePosition(c, res),
                bound = resolveBinding(c, s.gameData),
                selected = editing && s.selectedId === c.id;
              const resolved = resolveStyle(c, s.designSystem);
              const style: CSSProperties = {
                fontFamily: resolved.fontFamily,
                fontWeight: resolved.fontWeight,
                lineHeight: resolved.lineHeight,
                left: p.x,
                top: p.y,
                width: c.size.width,
                height: c.size.height,
                fontSize: resolved.fontSize,
                color: resolved.color,
                backgroundColor: resolved.backgroundColor,
                borderRadius: resolved.borderRadius,
                padding: resolved.padding,
                opacity: resolved.opacity,
              };
              return (
                <div
                  key={c.id}
                  role={editing ? "button" : undefined}
                  tabIndex={editing ? 0 : undefined}
                  aria-label={c.name}
                  data-component-id={c.id}
                  data-component-type={c.type}
                  className={`ui-element type-${c.type} ${selected ? "selected" : ""} ${editing ? "editable" : ""}`}
                  style={{
                    ...style,
                    ...(!editing ? { pointerEvents: "none" as const } : {}),
                  }}
                  onFocus={() => {
                    if (editing) useEditor.setState({ selectedId: c.id });
                  }}
                  onPointerDown={(e) => start(e, c)}
                  onPointerMove={move}
                  onPointerUp={() => {
                    gesture.current = null;
                  }}
                  onPointerCancel={() => {
                    gesture.current = null;
                  }}
                  onKeyDown={(e) => {
                    if (editing && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      useEditor.setState({ selectedId: c.id });
                    }
                  }}
                >
                  {c.type === "progressBar" ? (
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-label={c.name}
                      aria-valuenow={bound.value}
                      aria-valuemin={0}
                      aria-valuemax={bound.max}
                    >
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.max(0, Math.min(100, bound.max > 0 ? (bound.value / bound.max) * 100 : 0))}%`,
                          background: resolved.color,
                        }}
                      />
                    </div>
                  ) : c.type === "panel" ? null : (
                    <span className="ui-content">
                      {c.generatedAssetKey && s.generatedAssets[c.generatedAssetKey] ? (
                        <img
                          src={s.generatedAssets[c.generatedAssetKey]}
                          alt=""
                          className="ui-generated-asset"
                          style={{
                            width: Math.max(20, Math.round(resolved.fontSize * 1.5)),
                            height: Math.max(20, Math.round(resolved.fontSize * 1.5)),
                          }}
                        />
                      ) : c.emoji ? (
                        <span
                          className="ui-emoji"
                          style={{ fontSize: Math.max(16, Math.round(resolved.fontSize * 1.35)) }}
                        >
                          {c.emoji}
                        </span>
                      ) : (
                        c.icon && (
                          <Icon
                            id={c.icon}
                            size={Math.max(14, Math.round(resolved.fontSize * 1.05))}
                            className="ui-icon"
                          />
                        )
                      )}
                      <span className="ui-text">{bound.text}</span>
                    </span>
                  )}
                  {bound.error && (
                    <span className="binding-error" title={bound.error}>
                      !
                    </span>
                  )}
                  {selected && (
                    <>
                      <span
                        className="selection-label"
                        style={{
                          fontSize: 11 / scale,
                          top: -24 / scale,
                          padding: `${3 / scale}px ${6 / scale}px`,
                        }}
                      >
                        {c.name}
                      </span>
                      {handles.map((h) => (
                        <span
                          key={h}
                          role="button"
                          aria-label={`Resize ${h}`}
                          className={`resize-handle handle-${h}`}
                          style={{
                            width: 7 / scale,
                            height: 7 / scale,
                            borderWidth: 1 / scale,
                          }}
                          onPointerDown={(e) => start(e, c, h)}
                        />
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="canvas-caption">
        <span>
          <MousePointer2 size={13} />
          {editing
            ? "Select an element to edit · Drag to move · Hold Space or the Hand tool to pan"
            : "Play Game · Editing disabled"}
        </span>
        <span className="caption-actions">
          <button
            title="Undo (⌘Z)"
            disabled={!s.history.length}
            onClick={s.undo}
          >
            <Undo2 size={14} />
          </button>
          <button
            title="Redo (⌘⇧Z)"
            disabled={!s.future.length}
            onClick={s.redo}
          >
            <Redo2 size={14} />
          </button>
          <span>{s.schema.components.length} elements</span>
          <i className={`tiny-dot ${s.playing ? "live" : ""}`} />
          {s.gameSource?.kind === "imported"
            ? "WebGL"
            : s.gameSource?.kind === "screenshot"
              ? "Screenshot"
              : s.playing
                ? "Playing mock"
                : "Paused"}
        </span>
      </div>
    </section>
  );
}
