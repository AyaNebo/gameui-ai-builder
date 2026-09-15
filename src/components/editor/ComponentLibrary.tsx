"use client";
import { useState } from "react";
import {
  Type,
  RectangleHorizontal,
  Square,
  Image as ImageIcon,
  PanelTop,
  Search,
  Plus,
  Layers,
  ChevronDown,
  Link2,
} from "lucide-react";
import { useEditor } from "@/editor/store";
import { componentTypes, labels, makeComponent } from "@/editor/schema";
import { createComponent } from "@/editor/operations";
import { componentPresets } from "@/editor/templates";
import { designDirections } from "@/ai/schemas";
export const typeIcons = {
  text: Type,
  button: RectangleHorizontal,
  panel: Square,
  image: ImageIcon,
  progressBar: PanelTop,
};
export function ComponentLibrary({ view }: { view: string }) {
  const s = useEditor(),
    [query, setQuery] = useState(""),
    ready = !!s.gameContext;
  function insertLayout(layoutId: string, message: string) {
    if (s.apply({ action: "insertLayout", layoutId })) {
      useEditor.setState({
        selectedId: useEditor.getState().schema.components.at(-1)!.id,
        mode: "edit",
      });
      s.notify(message);
    }
  }
  return (
    <aside className="library panel">
      <div className="library-head">
        <h2>{view === "layouts" ? "Layouts" : "UI Components"}</h2>
        <p>
          {view === "layouts"
            ? "A starting point, built from your system."
            : "Small pieces. Shared foundations."}
        </p>
      </div>
      {view !== "layouts" && (
        <>
          <label className="search">
            <Search size={15} />
            <input
              aria-label="Search components"
              placeholder="Search components…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="component-grid">
            {componentTypes
              .filter((t) =>
                labels[t].toLowerCase().includes(query.toLowerCase()),
              )
              .map((t) => {
                const Icon = typeIcons[t];
                return (
                  <button
                    disabled={!ready}
                    title={
                      ready
                        ? `Add ${labels[t]}`
                        : "Add a game to start designing"
                    }
                    key={t}
                    onClick={() => {
                      const c = makeComponent(t);
                      if (!s.apply(createComponent(c))) return;
                      useEditor.setState({ selectedId: c.id, mode: "edit" });
                    }}
                  >
                    <Plus className="add-plus" size={11} />
                    <Icon size={25} strokeWidth={1.6} />
                    <span>{labels[t]}</span>
                  </button>
                );
              })}
          </div>
        </>
      )}
      <section className="templates-section">
        <div className="section-heading">
          <h3>UI Packs</h3>
          <span>{designDirections.length} presets</span>
        </div>
        <p className="help-text">
          Full, ready-made HUDs, one per design direction — instant, no AI
          call. Ask the AI Assistant to generate a bespoke one from your
          screenshot instead, any time.
        </p>
        <div className="pack-grid">
          {designDirections.map((direction) => (
            <button
              key={direction}
              className={`pack-card pack-${direction.toLowerCase().replace(/\W+/g, "-")}`}
              aria-label={`Insert ${direction} UI pack`}
              disabled={!ready}
              onClick={() =>
                insertLayout(
                  `pack-${direction}`,
                  `${direction} UI pack added — health, energy, resource and objective chips, styled and grouped.`,
                )
              }
            >
              <span className="pack-swatch" />
              <strong>{direction}</strong>
            </button>
          ))}
        </div>
        <button
          className="hud-layout-card"
          aria-label="Insert basic HUD layout"
          disabled={!ready}
          onClick={() => insertLayout("hud", "Basic HUD layout added as four editable components.")}
        >
          <div className="hud-wireframe">
            <span className="wire-health" />
            <span className="wire-coins">124</span>
            <span className="wire-score">350</span>
            <span className="wire-status">Ready to play</span>
            <Plus size={20} />
          </div>
          <div>
            <strong>Basic HUD</strong>
            <span>Health · Coins · Score · Status</span>
          </div>
        </button>
        <p className="layout-token-note">
          <Link2 size={11} />
          Linked to your Design System
        </p>
      </section>
      <section className="templates-section">
        <div className="section-heading">
          <h3>Component Presets</h3>
          <span>{componentPresets.length} presets</span>
        </div>
        <p className="help-text">Small, already-polished pieces — build a HUD up by hand.</p>
        <div className="preset-grid">
          {componentPresets.map((preset) => (
            <button
              key={preset.id}
              className="preset-card"
              disabled={!ready}
              title={preset.description}
              onClick={() =>
                insertLayout(`preset-${preset.id}`, `${preset.name} added.`)
              }
            >
              <Plus className="add-plus" size={11} />
              <strong>{preset.name}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="layers-section">
        <div className="section-heading">
          <h3>
            <Layers size={14} />
            Layers
          </h3>
          <span>
            {s.schema.components.length}
            <ChevronDown size={12} />
          </span>
        </div>
        <div className="layers-list">
          {s.schema.components.map((c) => {
            const Icon = typeIcons[c.type];
            return (
              <button
                disabled={!ready}
                key={c.id}
                className={s.selectedId === c.id ? "selected" : ""}
                onClick={() =>
                  useEditor.setState({ selectedId: c.id, mode: "edit" })
                }
              >
                <Icon size={14} />
                <span>{c.name}</span>
                {c.binding && <i className="tiny-dot live" />}
              </button>
            );
          })}
          {s.schema.components.length === 0 && (
            <p className="help-text layer-empty">
              Your UI elements will appear here.
            </p>
          )}
        </div>
      </section>
      <div className="library-foot">
        <i className="tiny-dot" />
        Structured. Editable. Reusable.
      </div>
    </aside>
  );
}
