"use client";
import { useState } from "react";
import {
  Sparkles,
  Wand2,
  ArrowUp,
  Loader2,
  TriangleAlert,
  Eye,
  Palette,
  ChevronDown,
} from "lucide-react";
import { useEditor } from "@/editor/store";
import { designDirections, type DesignDirection } from "@/ai/schemas";
const directionHints: Record<DesignDirection, string> = {
  Cozy: "Rounded, warm, friendly",
  Arcade: "Bold, punchy, high-energy",
  Minimal: "Quiet, monochrome, spare",
  Fantasy: "Ornate, gold, storybook",
  "Sci-Fi": "Sharp, cool, technical",
};
const statusText: Record<string, string> = {
  analyzing: "Analyzing composition...",
  generating: "Finding visual language...",
  applying: "Designing HUD...",
};
export function AIChat() {
  const s = useEditor();
  const [instruction, setInstruction] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const busy = s.aiStatus !== "idle" && s.aiStatus !== "error";
  const hasScreenshot = s.gameSource?.kind === "screenshot";
  const hasContext = !!s.gameContext;
  const analysis = s.aiAnalysis;
  const hasAiHud = s.schema.components.some((c) => c.aiGenerated);
  function submit() {
    const text = instruction.trim();
    if (!text || busy) return;
    setInstruction("");
    s.runAIInstruction(text);
  }
  function generateHud(direction?: DesignDirection) {
    if (busy) return;
    s.generateHud(direction);
  }
  return (
    <section className="ai-chat panel">
      <header>
        <div className="assistant-mark">
          <img
            src="/logo.png"
            alt="GameUI AI assistant logo"
            width={39}
            height={39}
          />
        </div>
        <div>
          <h2>A shared language for your game UI.</h2>
          <p>
            {s.gameContext
              ? s.gameContext.name
              : "Start with your game. Build a system that belongs to it."}
          </p>
        </div>
        <span className="mock-badge">
          <Sparkles size={12} />
          AI
        </span>
      </header>
      {!hasContext ? (
        <div className="ai-empty">
          <p>Add a game to unlock AI analysis and generation.</p>
        </div>
      ) : (
        <div className="ai-scroll">
          <div className="context-chips">
            <span>Game context</span>
            <span>Design tokens</span>
            <span>Editable components</span>
          </div>
          {hasScreenshot ? (
            <button
              className="ai-analyze-button"
              disabled={busy}
              onClick={() => s.analyzeGame()}
            >
              <Eye size={15} />
              {analysis ? "Re-analyze screenshot" : "Analyze Game with AI"}
            </button>
          ) : (
            <p className="help-text ai-note">
              Visual analysis needs a screenshot. Add one from Game Setup, or
              just describe what you want below — the assistant still knows
              your game context and current UI.
            </p>
          )}
          {analysis && (
            <div className="analysis-card">
              <div className="analysis-eyebrow">AI Game Analysis</div>
              <div className="analysis-genre-line">
                {s.gameContext?.genre}
                {s.gameContext?.perspective ? ` · ${s.gameContext.perspective}` : ""}
              </div>

              <div className="analysis-row-label">Visual direction</div>
              <div className="analysis-direction-row">
                <strong className="direction-badge">
                  {analysis.recommendedDirection}
                </strong>
                <span className="analysis-visual-style">{analysis.visualStyle}</span>
              </div>

              <div className="analysis-row-label">Palette</div>
              <div className="palette-swatches">
                {[
                  analysis.palette.suggestedSurface,
                  analysis.palette.suggestedAccent,
                  analysis.palette.suggestedSecondaryAccent,
                  analysis.palette.dominant,
                  analysis.palette.background,
                ].map((hex, i) => (
                  <span
                    key={i}
                    className="palette-swatch"
                    style={{ background: hex }}
                    title={hex}
                  />
                ))}
              </div>

              {analysis.importantObjects.length > 0 && (
                <>
                  <div className="analysis-row-label">Visible game cues</div>
                  <div className="analysis-tags">
                    {analysis.importantObjects
                      .filter((o) => o.confidence !== "speculative")
                      .slice(0, 6)
                      .map((o, i) => (
                        <span className="analysis-tag" key={i}>
                          {o.name}
                        </span>
                      ))}
                  </div>
                </>
              )}

              {analysis.bullets.length > 0 && (
                <>
                  <div className="analysis-row-label">HUD strategy</div>
                  <div className="analysis-tags">
                    {analysis.bullets.map((b, i) => (
                      <span className="analysis-tag strategy" key={i}>
                        {b}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {analysis.reasoning && (
                <blockquote className="analysis-quote">
                  &ldquo;{analysis.reasoning}&rdquo;
                </blockquote>
              )}

              <div className="analysis-row-label">Recommended UI</div>
              <div className="analysis-hud-name">{analysis.recommendedHudName}</div>

              <button
                className="ai-generate-button"
                disabled={busy}
                onClick={() => generateHud(analysis.recommendedDirection)}
              >
                <Wand2 size={15} />
                {hasAiHud
                  ? `Regenerate ${analysis.recommendedDirection} HUD`
                  : `Generate ${analysis.recommendedDirection} HUD`}
              </button>
              <button
                type="button"
                className="analysis-details-toggle"
                onClick={() => setShowDetails((v) => !v)}
              >
                <ChevronDown
                  size={12}
                  className={showDetails ? "rotated" : ""}
                />
                {showDetails ? "Hide" : "Show"} full analysis
              </button>
              {showDetails && (
                <dl className="analysis-details">
                  <dt>Summary</dt>
                  <dd>{analysis.summary}</dd>
                  <dt>AI&rsquo;s read of the game type from the image</dt>
                  <dd>{analysis.inferredGameType}</dd>
                  <dt>Mood</dt>
                  <dd>{analysis.visualMood}</dd>
                  <dt>Environment</dt>
                  <dd>{analysis.environment}</dd>
                  {analysis.playerCharacter && (
                    <>
                      <dt>Player character</dt>
                      <dd>{analysis.playerCharacter}</dd>
                    </>
                  )}
                  <dt>Visual density</dt>
                  <dd>{analysis.visualDensity}</dd>
                  {analysis.likelyResources.length > 0 && (
                    <>
                      <dt>Likely resources</dt>
                      <dd>{analysis.likelyResources.join(", ")}</dd>
                    </>
                  )}
                  {analysis.likelyPlayerStats.length > 0 && (
                    <>
                      <dt>Likely player stats</dt>
                      <dd>{analysis.likelyPlayerStats.join(", ")}</dd>
                    </>
                  )}
                  {analysis.safeZones.length > 0 && (
                    <>
                      <dt>Safe zones for UI</dt>
                      <dd>
                        {analysis.safeZones
                          .map((z) => z.anchor.replaceAll("-", " "))
                          .join(", ")}
                      </dd>
                    </>
                  )}
                  {analysis.blockedZones.length > 0 && (
                    <>
                      <dt>Blocked zones</dt>
                      <dd>
                        {analysis.blockedZones
                          .map((z) => `${z.anchor.replaceAll("-", " ")} (${z.reason})`)
                          .join(", ")}
                      </dd>
                    </>
                  )}
                </dl>
              )}
            </div>
          )}
          {!analysis && hasContext && (
            <button
              className="ai-generate-button secondary"
              disabled={busy}
              onClick={() => generateHud()}
            >
              <Wand2 size={15} />
              {hasAiHud ? "Regenerate HUD" : "Create a HUD for this game"}
            </button>
          )}
          <div className="direction-picker">
            <span className="direction-label">
              <Palette size={13} />
              Design direction (instant, no AI call)
            </span>
            <div className="direction-chips">
              {designDirections.map((d) => (
                <button
                  key={d}
                  title={directionHints[d]}
                  onClick={() => s.applyDirection(d)}
                  disabled={busy}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          {busy && (
            <div className="ai-status-row">
              <Loader2 size={14} className="spin" />
              {statusText[s.aiStatus] ?? "Working..."}
            </div>
          )}
          {s.aiStatus === "error" && s.aiError && (
            <div className="ai-error-row">
              <TriangleAlert size={14} />
              {s.aiError}
            </div>
          )}
        </div>
      )}
      <div className="disabled-ai-input">
        <input
          aria-label="AI instruction"
          placeholder={
            hasContext
              ? "Ask for changes, e.g. \"Make it more Nintendo-like and playful\""
              : "Add a game to chat with the assistant"
          }
          value={instruction}
          disabled={!hasContext || busy}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <button
          aria-label="Send AI instruction"
          disabled={!hasContext || busy || !instruction.trim()}
          onClick={submit}
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </section>
  );
}
