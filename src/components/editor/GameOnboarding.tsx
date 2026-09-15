"use client";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ChangeEvent,
} from "react";
import {
  Plus,
  Plug,
  Box,
  Triangle,
  Hexagon,
  ArrowRight,
  X,
  Link2,
  Gamepad2,
  Check,
  Monitor,
  ImageIcon,
  Upload,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { useEditor, engine } from "@/editor/store";
import {
  genres,
  perspectives,
  platforms,
  inputMethods,
  webGLUrl,
  MAX_SCREENSHOT_BYTES,
  DEMO_GAME_URL,
  demoGameContextDefaults,
  type GameSource,
  type GameContext,
} from "@/editor/gameContext";
export type OnboardingStep =
  | "add"
  | "screenshot"
  | "webgl"
  | "connect"
  | "setup"
  | null;
const MAX_IMAGE_DIMENSION = 1920;
// Reads an image file, downsizes it on a canvas, and resolves a JPEG/PNG data
// URL. Screenshots are saved directly inside the project JSON (localStorage),
// so keeping this small matters more than keeping it lossless.
function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose a PNG, JPG or WebP image."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read that image."));
      img.onload = () => {
        let { width, height } = img;
        if (!width || !height) {
          reject(new Error("Could not read that image."));
          return;
        }
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process that image."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const keepPng = file.type === "image/png" && file.size < 1.5e6;
        const dataUrl = keepPng
          ? canvas.toDataURL("image/png")
          : canvas.toDataURL("image/jpeg", 0.85);
        if (dataUrl.length > MAX_SCREENSHOT_BYTES) {
          resolve(canvas.toDataURL("image/jpeg", 0.6));
          return;
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
export function EmptyGameView({
  open,
  onDropUrl,
  onDropImage,
}: {
  open: (step: OnboardingStep) => void;
  onDropUrl: (url: string) => void;
  onDropImage: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false),
    depth = useRef(0),
    notify = useEditor((s) => s.notify);
  function drop(e: DragEvent) {
    e.preventDefault();
    depth.current = 0;
    setDragging(false);
    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        onDropImage(file);
      } else {
        notify(
          "Drop an image (PNG/JPG/WebP) or a hosted Unity WebGL build link.",
        );
      }
      return;
    }
    const url =
      (
        e.dataTransfer.getData("text/uri-list") ||
        e.dataTransfer.getData("text/plain")
      )
        .split("\n")
        .find((s) => s.trim() && !s.startsWith("#")) ?? "";
    try {
      onDropUrl(webGLUrl(url, window.location.origin));
    } catch (err) {
      notify((err as Error).message);
    }
  }
  return (
    <section
      className={`empty-game ${dragging ? "drag-over" : ""}`}
      aria-label="Game drop target"
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (--depth.current <= 0) setDragging(false);
      }}
      onDrop={drop}
    >
      <span className="empty-eyebrow">YOUR GAME. YOUR UI SYSTEM.</span>
      <div className="empty-game-icon">
        <Gamepad2 size={34} strokeWidth={1.3} />
        <span>+</span>
      </div>
      <h2>Bring your game into GameUI</h2>
      <p>Design UI in the context of the actual game — or a screenshot of it.</p>
      <div className="onboarding-actions">
        <button className="export-button" onClick={() => open("add")}>
          <Plus size={16} />
          Add Game
        </button>
        <button className="save-button" onClick={() => open("connect")}>
          <Plug size={16} />
          Connect Engine
        </button>
      </div>
      <span className="drop-hint">
        {dragging
          ? "Drop it here"
          : "or drop a screenshot image or a Unity WebGL link here"}
      </span>
      <div className="supported-engines">
        <span>
          <ImageIcon size={20} />
          <b>Screenshot</b>
          <small>PNG · JPG · WebP</small>
        </span>
        <span>
          <Box size={21} />
          <b>Unity</b>
          <small>WebGL supported</small>
        </span>
        <span className="coming-soon">
          <Triangle size={20} />
          <b>Unreal</b>
          <small>Coming Soon</small>
        </span>
        <span className="coming-soon">
          <Hexagon size={20} />
          <b>Godot</b>
          <small>Coming Soon</small>
        </span>
      </div>
      <div className="empty-footnote">
        <i className="tiny-dot" />
        One game context. One reusable design system.
      </div>
    </section>
  );
}
export function GameOnboarding({
  step,
  setStep,
  initialUrl,
  initialImage,
  replacing,
}: {
  step: OnboardingStep;
  setStep: (step: OnboardingStep) => void;
  initialUrl: string;
  initialImage?: File | null;
  replacing?: boolean;
}) {
  const s = useEditor(),
    [url, setUrl] = useState(initialUrl),
    [error, setError] = useState(""),
    [pending, setPending] = useState<GameSource | null>(null),
    [busy, setBusy] = useState(false),
    [imageBusy, setImageBusy] = useState(false),
    [imageDragging, setImageDragging] = useState(false);
  const [name, setName] = useState(""),
    [genre, setGenre] = useState<GameContext["genre"]>("Adventure"),
    [perspective, setPerspective] =
      useState<GameContext["perspective"]>("Third Person"),
    [chosenPlatforms, setPlatforms] = useState<GameContext["platforms"]>([
      "PC",
    ]),
    [inputs, setInputs] = useState<GameContext["inputMethods"]>([
      "Keyboard + Mouse",
    ]),
    [description, setDescription] = useState("");
  const dialog = useRef<HTMLElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    imageDropDepth = useRef(0),
    cancelled = useRef(false);
  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);
  const consumedImage = useRef<File | null>(null);
  useEffect(() => {
    if (
      step === "screenshot" &&
      initialImage &&
      consumedImage.current !== initialImage
    ) {
      consumedImage.current = initialImage;
      void handleImageFile(initialImage);
    }
    // handleImageFile is a stable function declaration recreated per render;
    // only re-run when the step or the dropped file identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, initialImage]);
  useEffect(() => {
    setError("");
    if (step) cancelled.current = false;
  }, [step]);
  useEffect(() => {
    if (!step) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = dialog.current?.querySelector<HTMLElement>("input,button");
    first?.focus();
    return () => previous?.focus();
  }, [step]);
  function close() {
    if (busy || imageBusy) return;
    cancelled.current = true;
    if (step === "setup" && pending?.kind === "connected") {
      void engine.disconnect();
      useEditor.setState({ connection: "disconnected" });
    }
    setPending(null);
    setStep(null);
  }
  // Applies a chosen source. In "replace" mode (opened from Settings while a
  // workspace already exists) this swaps the source only, keeping the UI
  // schema, design system, game data and context untouched. Otherwise it
  // continues to Game Setup to collect a fresh Game Context.
  function chooseSource(source: GameSource, opts?: { prefillName?: string }) {
    if (replacing) {
      if (s.replaceGameSource(source)) {
        setPending(null);
        setStep(null);
      } else setError(useEditor.getState().notice);
      return;
    }
    if (opts?.prefillName) setName(opts.prefillName);
    setPending(source);
    setError("");
    setStep("setup");
  }
  async function handleImageFile(file: File) {
    setImageBusy(true);
    setError("");
    try {
      const imageData = await readImageFile(file);
      chooseSource(
        { kind: "screenshot", imageData },
        { prefillName: file.name.replace(/\.[^.]+$/, "") || "New game" },
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImageBusy(false);
    }
  }
  function tryDemo() {
    const source: GameSource = {
      kind: "imported",
      format: "unity-webgl",
      url: DEMO_GAME_URL,
    };
    if (replacing) {
      chooseSource(source);
      return;
    }
    const context: GameContext = {
      id: crypto.randomUUID(),
      name: "Racing Demo",
      ...demoGameContextDefaults,
      description: "GameUI demo — a hosted Unity WebGL racing game.",
      engine: "unity",
    };
    if (s.createWorkspace(context, source)) {
      setPending(null);
      setStep(null);
    } else setError(useEditor.getState().notice);
  }
  async function connect() {
    setBusy(true);
    setError("");
    useEditor.setState({ connection: "connecting" });
    try {
      await engine.connect();
      if (cancelled.current) return;
      useEditor.setState({ connection: "connected" });
      if (s.gameContext && s.gameSource?.kind === "connected") {
        setStep(null);
        s.notify("Mock Unity adapter connected. No live stream is available.");
      } else {
        setPending({ kind: "connected", engine: "unity", adapter: "mock" });
        setStep("setup");
      }
    } catch {
      useEditor.setState({ connection: "error" });
      setError("Unable to connect the mock adapter. Try again.");
    } finally {
      setBusy(false);
    }
  }
  function create() {
    if (!pending) return;
    const context: GameContext = {
      id: crypto.randomUUID(),
      name: name.trim(),
      genre,
      perspective,
      platforms: chosenPlatforms,
      inputMethods: inputs,
      description: description.trim(),
      engine: "unity",
    };
    if (s.createWorkspace(context, pending)) {
      setPending(null);
      setStep(null);
    } else setError(useEditor.getState().notice);
  }
  if (!step) return null;
  const title =
    step === "add"
      ? "Add Your Game"
      : step === "screenshot"
        ? "Upload Screenshot"
        : step === "webgl"
          ? "Playable Game"
          : step === "connect"
            ? "Connect Game Engine"
            : "Game Setup";
  const showBack = step === "screenshot" || step === "webgl";
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="modal onboarding-modal panel"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
          if (e.key === "Tab") {
            const focusable = Array.from(
              dialog.current!.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input,select,textarea",
              ),
            );
            const first = focusable[0],
              last = focusable.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        {showBack && (
          <button
            className="modal-back icon-button"
            aria-label="Back"
            onClick={() => setStep("add")}
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <button
          className="modal-close icon-button"
          aria-label="Close onboarding"
          disabled={busy || imageBusy}
          onClick={close}
        >
          <X size={18} />
        </button>
        <span className="dialog-eyebrow">
          {step === "setup"
            ? "02 / GAME CONTEXT"
            : replacing
              ? "REPLACE GAME SOURCE"
              : "01 / GAME SOURCE"}
        </span>
        {step === "add" ? (
          <>
            <h2>{replacing ? "Replace your game" : "Add your game"}</h2>
            <p>How would you like to start?</p>
            <div className="source-picker">
              <button
                className="source-card"
                onClick={() => setStep("screenshot")}
              >
                <ImageIcon size={26} />
                <strong>Upload Screenshot</strong>
                <p>Start designing immediately.</p>
                <span className="pill">PNG / JPG / WebP</span>
              </button>
              <button className="source-card" onClick={() => setStep("webgl")}>
                <Box size={26} />
                <strong>Playable Game</strong>
                <p>Design over a live game.</p>
                <span className="pill">Unity WebGL</span>
              </button>
              <button className="source-card" onClick={tryDemo}>
                <Sparkles size={26} />
                <strong>Try Demo</strong>
                <p>Explore GameUI without setup.</p>
                <span className="pill">No game needed</span>
              </button>
            </div>
          </>
        ) : step === "screenshot" ? (
          <>
            <h2>Upload Screenshot</h2>
            <p>
              Start designing immediately — a screenshot works just as well as
              a live build.
            </p>
            <div
              className={`screenshot-drop ${imageDragging ? "drag-over" : ""} ${imageBusy ? "busy" : ""}`}
              onDragEnter={(e) => {
                e.preventDefault();
                imageDropDepth.current++;
                setImageDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (--imageDropDepth.current <= 0) setImageDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                imageDropDepth.current = 0;
                setImageDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) void handleImageFile(file);
                else setError("Drop a PNG, JPG or WebP image.");
              }}
            >
              <Upload size={30} strokeWidth={1.4} />
              <p>
                {imageBusy
                  ? "Processing image…"
                  : "Drag and drop a screenshot here"}
              </p>
              <button
                type="button"
                className="export-button"
                disabled={imageBusy}
                onClick={() => fileInput.current?.click()}
              >
                Choose Image
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Choose screenshot"
                hidden
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleImageFile(file);
                }}
              />
              <small>PNG, JPG or WebP. Large images are resized to fit.</small>
            </div>
          </>
        ) : step === "webgl" ? (
          <>
            <h2>Playable Game</h2>
            <p>Bring a hosted Unity WebGL build into your workspace.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const valid = webGLUrl(url, window.location.origin);
                  chooseSource({
                    kind: "imported",
                    format: "unity-webgl",
                    url: valid,
                  });
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              <label className="setup-field">
                Unity WebGL build URL
                <div className="build-url">
                  <Link2 size={16} />
                  <input
                    required
                    type="url"
                    aria-label="Unity WebGL build URL"
                    value={url}
                    placeholder="https://your-game.example/index.html"
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
              </label>
              <div className="source-info">
                <Box size={21} />
                <div>
                  <strong>Unity WebGL</strong>
                  <p>
                    Use the exported build’s hosted index page. The host must
                    allow embedding; local development builds can run on a
                    separate port.
                  </p>
                </div>
                <span className="pill">SUPPORTED</span>
              </div>
              <p className="format-note">
                EXE, APK, IPA, ZIP and Unity source projects aren’t supported.
                Local folder/archive upload is a future step.
              </p>
              <p className="format-note">
                Best results with responsive Unity WebGL builds (canvas set
                to scale with its container). Fixed-size templates will
                still load and play — they just won’t fill the workspace.
              </p>
              <button className="export-button dialog-primary" type="submit">
                {replacing ? "Replace Game" : "Continue to Game Setup"}
                <ArrowRight size={15} />
              </button>
            </form>
          </>
        ) : step === "connect" ? (
          <>
            <h2>Connect Game Engine</h2>
            <p>Create UI alongside your engine’s editor and Play Mode.</p>
            <div className="engine-connect-card">
              <Box size={30} />
              <div>
                <h3>Unity</h3>
                <p>Live Editor / Play Mode</p>
                <span className="mock-badge">
                  Mock adapter · No live game stream
                </span>
              </div>
              <button
                className="export-button"
                disabled={busy}
                onClick={connect}
              >
                {busy
                  ? "Connecting…"
                  : s.connection === "error"
                    ? "Retry connection"
                    : "Connect Unity"}
                <Plug size={13} />
              </button>
            </div>
            <div className="future-engine">
              <Triangle size={21} />
              <strong>Unreal Engine</strong>
              <span>Coming Soon</span>
            </div>
            <div className="future-engine">
              <Hexagon size={21} />
              <strong>Godot</strong>
              <span>Coming Soon</span>
            </div>
            <p className="format-note">
              This milestone uses a mock connection. The Unity bridge comes
              later.
            </p>
          </>
        ) : (
          <>
            <h2>Tell us about your game</h2>
            <p>A little context gives your UI a shared foundation.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
            >
              <label className="setup-field">
                Game name
                <input
                  autoFocus
                  required
                  maxLength={100}
                  aria-label="Game name"
                  placeholder="Third Person Demo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <div className="setup-grid">
                <label className="setup-field">
                  Genre
                  <select
                    aria-label="Genre"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value as typeof genre)}
                  >
                    {genres.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label className="setup-field">
                  Perspective
                  <select
                    aria-label="Perspective"
                    value={perspective}
                    onChange={(e) =>
                      setPerspective(e.target.value as typeof perspective)
                    }
                  >
                    {perspectives.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset className="setup-options">
                <legend>
                  Target platform <small>Select all that apply</small>
                </legend>
                {platforms.map((p) => (
                  <label
                    key={p}
                    className={chosenPlatforms.includes(p) ? "checked" : ""}
                  >
                    <input
                      type="checkbox"
                      checked={chosenPlatforms.includes(p)}
                      onChange={(e) =>
                        setPlatforms(
                          e.target.checked
                            ? [...chosenPlatforms, p]
                            : chosenPlatforms.filter((v) => v !== p),
                        )
                      }
                    />
                    {p}
                  </label>
                ))}
              </fieldset>
              <fieldset className="setup-options">
                <legend>Primary input</legend>
                {inputMethods.map((p) => (
                  <label
                    key={p}
                    className={inputs.includes(p) ? "checked" : ""}
                  >
                    <input
                      type="checkbox"
                      checked={inputs.includes(p)}
                      onChange={(e) =>
                        setInputs(
                          e.target.checked
                            ? [...inputs, p]
                            : inputs.filter((v) => v !== p),
                        )
                      }
                    />
                    {p}
                  </label>
                ))}
              </fieldset>
              <label className="setup-field">
                Game description <small>Optional</small>
                <textarea
                  aria-label="Game description"
                  maxLength={1000}
                  rows={3}
                  placeholder="What do players do in your game?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <button className="export-button dialog-primary" type="submit">
                <Check size={16} />
                Create UI Workspace
              </button>
            </form>
          </>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
export function GameContextSummary() {
  const c = useEditor((s) => s.gameContext);
  if (!c) return <p>Add a game to establish its context.</p>;
  return (
    <div className="game-context-summary">
      <h3>
        <Monitor size={16} />
        {c.name}
      </h3>
      <dl>
        <dt>Genre</dt>
        <dd>{c.genre}</dd>
        <dt>Perspective</dt>
        <dd>{c.perspective}</dd>
        <dt>Platform</dt>
        <dd>{c.platforms.join(", ")}</dd>
        <dt>Input</dt>
        <dd>{c.inputMethods.join(", ")}</dd>
      </dl>
      {c.description && <p>{c.description}</p>}
    </div>
  );
}
