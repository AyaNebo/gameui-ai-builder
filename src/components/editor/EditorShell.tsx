"use client";
import { useEffect, useState } from "react";
import {
  Blocks,
  LayoutTemplate,
  Database,
  Palette,
  Plus,
  Settings2,
  Play,
  Pause,
  ChevronDown,
  Check,
  Download,
  Box,
  Triangle,
  Hexagon,
  HelpCircle,
  ExternalLink,
  X,
  Save,
} from "lucide-react";
import { useEditor, engine } from "@/editor/store";
import { deleteComponent } from "@/editor/operations";
import { exportProject } from "@/editor/persistence";
import { GameCanvas } from "./GameCanvas";
import { Inspector } from "./Inspector";
import { ComponentLibrary } from "./ComponentLibrary";
import { AIChat } from "./AIChat";
import { DesignSystemPanel } from "./DesignSystemPanel";
import {
  EmptyGameView,
  GameOnboarding,
  GameContextSummary,
  type OnboardingStep,
} from "./GameOnboarding";
export default function EditorShell() {
  const s = useEditor(),
    [nav, setNav] = useState("components"),
    [onboarding, setOnboarding] = useState<OnboardingStep>(null),
    [droppedUrl, setDroppedUrl] = useState(""),
    [droppedImage, setDroppedImage] = useState<File | null>(null),
    [replacingSource, setReplacingSource] = useState(false),
    [tab, setTab] = useState("inspector"),
    [modal, setModal] = useState<"settings" | "help" | null>(null);
  useEffect(() => {
    if (!onboarding) {
      setReplacingSource(false);
      setDroppedImage(null);
    }
  }, [onboarding]);
  useEffect(() => {
    s.initialize();
  }, []); // The store initializes once, including React strict mode.
  useEffect(() => {
    if (!s.notice) return;
    const timer = setTimeout(() => useEditor.setState({ notice: "" }), 4500);
    return () => clearTimeout(timer);
  }, [s.notice]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches("input,textarea,select") || target.isContentEditable)
        return;
      if (
        document.querySelector(
          '[aria-label="Game Setup"], [aria-label="Connect Game Engine"], [aria-label="Add Game"]',
        )
      )
        return;
      const st = useEditor.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        st.save();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        st.selectedId &&
        st.mode !== "game"
      ) {
        e.preventDefault();
        st.apply(deleteComponent(st.selectedId));
      }
      if (e.key === "Escape") {
        useEditor.setState({ selectedId: null });
        setModal(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document
          .querySelector<HTMLInputElement>('[aria-label="Search components"]')
          ?.focus();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  async function toggleConnection() {
    if (s.connection === "connected") {
      try {
        await engine.disconnect();
        useEditor.setState({ connection: "disconnected" });
      } catch {
        useEditor.setState({ connection: "error" });
      }
    } else setOnboarding("connect");
  }
  function navigate(key: string) {
    if (key === "settings") {
      setModal("settings");
      return;
    }
    setNav(key);
    if (key === "data") setTab("data");
  }
  return (
    <main className="editor-app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <img src="/logo.png" alt="GameUI AI logo" width={42} height={42} />
          </div>
          <div>
            <h1>
              GameUI <span>AI</span>
            </h1>
            <p>Design. Play. Iterate.</p>
          </div>
        </div>
        <div className="project-selector">
          <span>PROJECT</span>
          <strong>
            {s.projectName}
            <ChevronDown size={14} />
          </strong>
        </div>
        <div className="engine-tabs">
          <button
            className={s.gameSource ? "active" : ""}
            onClick={() => setOnboarding("connect")}
            title="Connect Unity"
          >
            <Box size={20} />
            Unity
          </button>
          <button disabled>
            <Triangle size={19} />
            <span>
              Unreal<small>Coming soon</small>
            </span>
          </button>
          <button disabled>
            <Hexagon size={19} />
            <span>
              Godot<small>Coming soon</small>
            </span>
          </button>
        </div>
        <div className="toolbar-spacer" />
        <button
          className={`connection ${s.connection}`}
          onClick={() => setOnboarding("connect")}
          title="Connect game engine"
        >
          <span>
            <i className="tiny-dot" />
            {s.gameSource?.kind === "imported"
              ? "WebGL build"
              : s.connection[0].toUpperCase() + s.connection.slice(1)}
          </span>
          <small>
            {s.gameSource?.kind === "imported"
              ? "Imported game"
              : s.gameContext
                ? "Unity · Mock adapter"
                : "No game connected"}
          </small>
        </button>
        <button
          className="add-game-toolbar icon-button"
          title="Add Game"
          onClick={() => {
            setDroppedUrl("");
            setReplacingSource(false);
            setOnboarding("add");
          }}
        >
          <Plus size={18} />
        </button>
        <div className="play-controls">
          <button
            disabled={!s.gameContext || s.gameSource?.kind === "imported"}
            aria-label="Play"
            title="Play mock preview"
            className={s.playing ? "active" : ""}
            onClick={() => useEditor.setState({ playing: true })}
          >
            <Play size={18} fill="currentColor" />
          </button>
          <button
            disabled={!s.gameContext || s.gameSource?.kind === "imported"}
            aria-label="Pause"
            title="Pause mock preview"
            className={!s.playing ? "active" : ""}
            onClick={() => useEditor.setState({ playing: false })}
          >
            <Pause size={18} fill="currentColor" />
          </button>
        </div>
        <button className="save-button" onClick={s.save}>
          <Save size={14} />
          Save Project
        </button>
        <button
          className="export-button"
          disabled={!s.gameContext}
          onClick={() => {
            try {
              const filename = exportProject(
                s.schema,
                s.designSystem,
                s.projectName,
              );
              s.notify(`UI System exported as ${filename}.`);
            } catch (e) {
              s.notify(`Export failed: ${(e as Error).message}`);
            }
          }}
        >
          <Download size={15} />
          Export UI System
        </button>
      </header>
      <div className="editor-body">
        <nav className="rail">
          {[
            {
              label: "ADD",
              items: [
                { key: "components", label: "Components", icon: Blocks },
                { key: "layouts", label: "Layouts", icon: LayoutTemplate },
              ],
            },
            {
              label: "SYSTEM",
              items: [
                { key: "design", label: "Design System", icon: Palette },
                { key: "data", label: "Game Data", icon: Database },
              ],
            },
          ].map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-label">{group.label}</span>
              {group.items.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  title={label}
                  className={nav === key ? "active" : ""}
                  onClick={() => navigate(key)}
                >
                  <Icon size={21} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="rail-spacer" />
          <button title="Settings" onClick={() => navigate("settings")}>
            <Settings2 size={21} />
            <span>Settings</span>
          </button>
          <button title="Help and shortcuts" onClick={() => setModal("help")}>
            <HelpCircle size={20} />
          </button>
        </nav>
        {nav === "design" ? (
          <DesignSystemPanel />
        ) : (
          <ComponentLibrary view={nav} />
        )}
        <div className="center-column">
          <div className="workspace-heading">
            <span>
              <i className={`tiny-dot ${s.gameContext ? "live" : ""}`} />{" "}
              {s.gameContext?.name ?? "NEW WORKSPACE"}
              <span className="slash">/</span>{" "}
              <strong>{s.gameContext ? "UI System" : "Get started"}</strong>
            </span>
            <span>LOCAL WORKSPACE</span>
          </div>
          {s.gameContext && s.gameSource ? (
            <GameCanvas />
          ) : (
            <EmptyGameView
              open={setOnboarding}
              onDropUrl={(url) => {
                setDroppedUrl(url);
                setOnboarding("webgl");
              }}
              onDropImage={(file) => {
                setDroppedImage(file);
                setOnboarding("screenshot");
              }}
            />
          )}
          <AIChat />
        </div>
        <Inspector tab={tab} setTab={setTab} />
      </div>
      <footer className="status-bar">
        <span className={`status-connection ${s.connection}`}>
          <i className="tiny-dot" />
          {s.gameSource?.kind === "imported"
            ? "Unity WebGL"
            : s.gameContext
              ? `Unity ${s.connection}`
              : "No game loaded"}
          {s.gameSource?.kind === "connected" && (
            <span className="status-mock">MOCK</span>
          )}
        </span>
        <span className="footer-project">
          {s.projectName}
          <ExternalLink size={12} />
        </span>
        <span className="status-right">
          <span>Project v0.2</span>
          <span>
            <Check size={14} />
            {s.dirty
              ? "Unsaved changes"
              : s.savedAt
                ? "Saved on this device"
                : "Ready to create"}
          </span>
          <span className="keyboard-hint">⌘ S to save</span>
        </span>
      </footer>
      <GameOnboarding
        step={onboarding}
        setStep={setOnboarding}
        initialUrl={droppedUrl}
        initialImage={droppedImage}
        replacing={replacingSource}
      />
      {s.notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {s.notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => useEditor.setState({ notice: "" })}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-label={modal === "help" ? "Help" : "Settings"}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={18} />
            </button>
            <h2>
              {modal === "help"
                ? "Your creative toolkit"
                : "Workspace settings"}
            </h2>
            {modal === "help" ? (
              <>
                <p>
                  Click a primitive or HUD layout to add it. Select an element
                  to edit, drag to move, or pull a handle to resize.
                </p>
                <dl>
                  <dt>Delete / Backspace</dt>
                  <dd>Delete selected element</dd>
                  <dt>⌘ / Ctrl + Z</dt>
                  <dd>Undo</dd>
                  <dt>⌘ / Ctrl + Shift + Z</dt>
                  <dd>Redo</dd>
                  <dt>⌘ / Ctrl + S</dt>
                  <dd>Save project</dd>
                  <dt>Escape</dt>
                  <dd>Deselect / close dialog</dd>
                </dl>
                <p>
                  Game coordinates use a 1920 × 1080 reference. Changing an
                  anchor preserves the element’s visual position.
                </p>
              </>
            ) : (
              <>
                <GameContextSummary />
                <div className="settings-row">
                  <span>Engine adapter</span>
                  <strong>
                    {s.gameSource?.kind === "imported"
                      ? "Unity WebGL"
                      : s.gameSource
                        ? "Unity (mock)"
                        : "Not connected"}
                  </strong>
                </div>
                <div className="settings-row">
                  <span>Reference resolution</span>
                  <strong>1920 × 1080</strong>
                </div>
                <div className="settings-row">
                  <span>Project storage</span>
                  <strong>This browser</strong>
                </div>
                {s.gameSource && (
                  <button
                    className="save-button"
                    onClick={() => {
                      setModal(null);
                      setDroppedUrl("");
                      setReplacingSource(true);
                      setOnboarding("add");
                    }}
                  >
                    Replace with Live Game / Screenshot
                  </button>
                )}
                <button className="save-button" onClick={toggleConnection}>
                  {s.connection === "connected"
                    ? "Disconnect mock engine"
                    : "Connect mock engine"}
                </button>
                <button disabled className="sync-button">
                  Sync to Unity · Coming in Milestone 4
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
