"use client";
import { useEffect, useState } from "react";
import {
  Type,
  Trash2,
  Database,
  Link2,
  MousePointer2,
  ChevronDown,
} from "lucide-react";
import { useEditor } from "@/editor/store";
import {
  resolveStyle,
  typographyIds,
  colorIds,
  type StyleTokens,
} from "@/editor/designSystem";
import { GameContextSummary } from "./GameOnboarding";
import type { UIStyle } from "@/editor/schema";
import { NumberInput } from "./NumberInput";
import {
  anchors,
  changeAnchor,
  labels,
  resolveBinding,
  type UIComponent,
} from "@/editor/schema";
import { Icon, iconIds, iconRegistry, type IconId } from "@/editor/icons";
import {
  updateComponent,
  bindVariable,
  deleteComponent,
} from "@/editor/operations";
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="property">
      <span>{label}</span>
      <div className="color-field">
        <input
          aria-label={`${label} picker`}
          type="color"
          value={value.slice(0, 7)}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          aria-label={label}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (/^#[\da-f]{6}([\da-f]{2})?$/i.test(e.target.value))
              onChange(e.target.value);
          }}
          onBlur={() => {
            if (!/^#[\da-f]{6}([\da-f]{2})?$/i.test(draft)) {
              setDraft(value);
              useEditor
                .getState()
                .notify("Use a hex color: #RRGGBB or #RRGGBBAA.");
            }
          }}
        />
      </div>
    </label>
  );
}
export function Inspector({
  tab,
  setTab,
}: {
  tab: string;
  setTab: (tab: string) => void;
}) {
  const s = useEditor(),
    c = s.schema.components.find((c) => c.id === s.selectedId);
  function patch(p: Partial<UIComponent>) {
    if (c) s.apply(updateComponent(c.id, p));
  }
  function number(
    label: string,
    value: number,
    change: (n: number) => void,
    min?: number,
    max?: number,
  ) {
    return (
      <label className="property">
        <span>{label}</span>
        <NumberInput
          label={label}
          value={value}
          min={min}
          max={max}
          onChange={change}
        />
      </label>
    );
  }
  const bound = c ? resolveBinding(c, s.gameData) : null;
  const style = c ? resolveStyle(c, s.designSystem) : null!;
  function reset(key: keyof UIStyle) {
    if (!c) return;
    const overrides = { ...c.styleOverrides };
    delete overrides[key];
    patch({ styleOverrides: overrides });
  }
  function link(key: keyof StyleTokens, value: string) {
    if (!c) return;
    const overrides = { ...c.styleOverrides };
    if (key === "typography") {
      delete overrides.fontSize;
      delete overrides.fontFamily;
      delete overrides.fontWeight;
      delete overrides.lineHeight;
    } else delete overrides[key as keyof UIStyle];
    patch({
      tokens: { ...c.tokens, [key]: value || undefined },
      styleOverrides: overrides,
    });
  }

  return (
    <aside className="inspector panel">
      <div className="panel-tabs">
        <button
          className={tab === "inspector" ? "active" : ""}
          onClick={() => setTab("inspector")}
        >
          Inspector
        </button>
        <button
          className={tab === "data" ? "active" : ""}
          onClick={() => setTab("data")}
        >
          Game Data
        </button>
      </div>
      {tab === "data" ? (
        <div className="inspector-scroll">
          <div className="inspector-heading">
            <Database size={19} />
            <strong>Game Data</strong>
            <span className="pill">MOCK</span>
          </div>
          <p className="help-text">
            Live values for your preview. Changes appear instantly in bound UI.
          </p>
          {Object.entries(s.gameData).map(([key, v]) => (
            <label className="data-row" key={key}>
              <span>
                {key}
                <small>{v.type}</small>
                {v.mock && (
                  <small className="mock-flag" title="Created by AI as preview-only data — not from a real game engine">
                    mock
                  </small>
                )}
              </span>
              {v.type === "number" ? (
                <NumberInput
                  label={key}
                  value={v.value}
                  onChange={(n) => s.setGameValue(key, String(n))}
                />
              ) : (
                <input
                  aria-label={key}
                  value={v.value}
                  onChange={(e) => s.setGameValue(key, e.target.value)}
                />
              )}
            </label>
          ))}
          <div className="data-note">
            <Link2 size={16} />
            <span>
              Select a text or progress bar to connect it to a variable.
            </span>
          </div>
        </div>
      ) : !c ? (
        <div className="empty-inspector">
          <MousePointer2 size={30} />
          <h3>A little detail goes a long way</h3>
          <p>
            Select an element on the canvas or in Layers to edit its properties.
          </p>
          <GameContextSummary />
        </div>
      ) : (
        <div className="inspector-scroll" key={c.id}>
          <div className="inspector-heading">
            <Type size={22} />
            <strong>{labels[c.type]}</strong>
            <button
              className="danger icon-button"
              title="Delete component"
              onClick={() => s.apply(deleteComponent(c.id))}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <label className="property">
            <span>Name</span>
            <input
              aria-label="Name"
              value={c.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          <div className="property id-field">
            <span>ID</span>
            <code title={c.id}>{c.id.slice(0, 16)}</code>
          </div>
          <section className="property-section">
            <h3>Transform</h3>
            <div className="transform-grid">
              {number("X", c.position.x, (x) =>
                patch({ position: { ...c.position, x } }),
              )}
              {number("Y", c.position.y, (y) =>
                patch({ position: { ...c.position, y } }),
              )}
              {number(
                "Width",
                c.size.width,
                (width) => patch({ size: { ...c.size, width } }),
                24,
                s.schema.referenceResolution.width,
              )}
              {number(
                "Height",
                c.size.height,
                (height) => patch({ size: { ...c.size, height } }),
                24,
                s.schema.referenceResolution.height,
              )}
            </div>
            <div className="anchor-control">
              <span>Anchor</span>
              <div className="anchor-grid">
                {anchors.map((anchor) => (
                  <button
                    key={anchor}
                    aria-label={`Anchor ${anchor}`}
                    title={anchor}
                    className={c.anchor === anchor ? "active" : ""}
                    onClick={() =>
                      patch(
                        changeAnchor(c, s.schema.referenceResolution, anchor),
                      )
                    }
                  >
                    <i />
                  </button>
                ))}
              </div>
              <span className="anchor-name">
                {c.anchor.replaceAll("-", " ")}
                <ChevronDown size={12} />
              </span>
            </div>
            <p className="field-hint">
              Offsets in game pixels, relative to anchor.
            </p>
          </section>
          <section className="property-section">
            <h3>Appearance</h3>
            {["text", "button", "image"].includes(c.type) && (
              <label className="property">
                <span>Typography</span>
                <select
                  aria-label="Typography"
                  value={c.tokens?.typography ?? ""}
                  onChange={(e) => link("typography", e.target.value)}
                >
                  <option value="">Local style</option>
                  {typographyIds.map((id) => (
                    <option key={id} value={id}>
                      {s.designSystem.typography[id].name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {c.type !== "panel" && (
              <label className="property">
                <span>Color token</span>
                <select
                  aria-label="Color token"
                  value={c.tokens?.color ?? ""}
                  onChange={(e) => link("color", e.target.value)}
                >
                  <option value="">Local style</option>
                  {colorIds.map((id) => (
                    <option key={id} value={id}>
                      {s.designSystem.colors[id].name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="property">
              <span>Surface token</span>
              <select
                aria-label="Surface token"
                value={c.tokens?.backgroundColor ?? ""}
                onChange={(e) => link("backgroundColor", e.target.value)}
              >
                <option value="">Local style</option>
                {colorIds.map((id) => (
                  <option key={id} value={id}>
                    {s.designSystem.colors[id].name}
                  </option>
                ))}
              </select>
            </label>
            {c.tokens?.typography && (
              <p className="inheritance-note">
                <Link2 size={11} />
                {s.designSystem.typography[c.tokens.typography].name} ·{" "}
                {style.fontFamily} · {style.fontSize}px{" "}
                {c.styleOverrides?.fontSize !== undefined
                  ? "(local override)"
                  : "(inherited)"}
              </p>
            )}
            {Object.keys(c.styleOverrides ?? {}).length > 0 && (
              <div className="override-list">
                <span>LOCAL OVERRIDES</span>
                {Object.keys(c.styleOverrides!).map((key) => (
                  <button
                    key={key}
                    aria-label={`Reset ${key}`}
                    title="Reset to inherited value"
                    onClick={() => reset(key as keyof UIStyle)}
                  >
                    {key} <span>↺ Reset</span>
                  </button>
                ))}
              </div>
            )}

            {c.type !== "panel" && c.type !== "progressBar" && (
              <>
                <label className="property">
                  <span>{c.type === "image" ? "Icon" : "Text"}</span>
                  <input
                    aria-label="Text content"
                    value={c.text}
                    onChange={(e) => patch({ text: e.target.value })}
                  />
                </label>
                {number(
                  "Font Size",
                  style.fontSize,
                  (fontSize) =>
                    patch({
                      styleOverrides: { ...c.styleOverrides, fontSize },
                    }),
                  1,
                  240,
                )}
              </>
            )}
            {(c.type === "text" || c.type === "button") && (
              <>
                {c.generatedAssetKey && (
                  <label className="property generated-asset-field">
                    <span>Generated asset</span>
                    <div className="generated-asset-preview">
                      {s.generatedAssets[c.generatedAssetKey] && (
                        <img
                          src={s.generatedAssets[c.generatedAssetKey]}
                          alt=""
                          className="generated-asset-thumb"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => patch({ generatedAssetKey: undefined })}
                      >
                        Remove
                      </button>
                    </div>
                  </label>
                )}
                <label className="property">
                  <span>Emoji</span>
                  <input
                    aria-label="Emoji"
                    value={c.emoji ?? ""}
                    maxLength={8}
                    placeholder="e.g. 🥕"
                    onChange={(e) =>
                      patch({
                        emoji: e.target.value || undefined,
                        icon: e.target.value ? undefined : c.icon,
                      })
                    }
                  />
                </label>
                <label className="property">
                  <span>Chip icon</span>
                  <div className="icon-picker">
                    <button
                      type="button"
                      aria-label="No icon"
                      title="No icon"
                      className={!c.icon ? "active" : ""}
                      onClick={() => patch({ icon: undefined })}
                    >
                      <span className="icon-none">–</span>
                    </button>
                    {iconIds.map((id) => (
                      <button
                        type="button"
                        key={id}
                        aria-label={iconRegistry[id].label}
                        title={iconRegistry[id].label}
                        className={c.icon === id ? "active" : ""}
                        onClick={() => patch({ icon: id as IconId, emoji: undefined })}
                      >
                        <Icon id={id} size={15} />
                      </button>
                    ))}
                  </div>
                </label>
              </>
            )}
            {c.type !== "panel" && (
              <ColorField
                label={c.type === "progressBar" ? "Fill Color" : "Text Color"}
                value={style.color}
                onChange={(color) =>
                  patch({ styleOverrides: { ...c.styleOverrides, color } })
                }
              />
            )}
            <ColorField
              label="Background"
              value={style.backgroundColor}
              onChange={(backgroundColor) =>
                patch({
                  styleOverrides: { ...c.styleOverrides, backgroundColor },
                })
              }
            />
            {number(
              "Radius",
              style.borderRadius,
              (borderRadius) =>
                patch({
                  styleOverrides: { ...c.styleOverrides, borderRadius },
                }),
              0,
              500,
            )}
            {number(
              "Padding",
              style.padding,
              (padding) =>
                patch({ styleOverrides: { ...c.styleOverrides, padding } }),
              0,
              200,
            )}
            <label className="property opacity">
              <span>Opacity</span>
              <input
                aria-label="Opacity"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={style.opacity}
                onChange={(e) =>
                  patch({
                    styleOverrides: {
                      ...c.styleOverrides,
                      opacity: Number(e.target.value),
                    },
                  })
                }
              />
              <output>{Math.round(style.opacity * 100)}%</output>
            </label>
            {c.type === "progressBar" && (
              <>
                {number("Value", c.value, (value) => patch({ value }), 0)}
                {number("Maximum", c.max, (max) => patch({ max }), 1)}
              </>
            )}
          </section>
          {["text", "button", "progressBar"].includes(c.type) && (
            <section className="property-section">
              <h3>
                Data Binding <Link2 size={14} />
              </h3>
              <label className="property">
                <span>Variable</span>
                <select
                  aria-label="Binding variable"
                  value={c.binding?.variable ?? ""}
                  onChange={(e) =>
                    s.apply(
                      bindVariable(
                        c.id,
                        e.target.value
                          ? {
                              ...c.binding,
                              variable: e.target.value,
                              format: "{value}",
                            }
                          : undefined,
                      ),
                    )
                  }
                >
                  <option value="">None</option>
                  {Object.entries(s.gameData)
                    .filter(
                      ([, v]) =>
                        c.type !== "progressBar" || v.type === "number",
                    )
                    .map(([key]) => (
                      <option key={key}>{key}</option>
                    ))}
                </select>
              </label>
              {c.binding && c.type === "progressBar" && (
                <label className="property">
                  <span>Max variable</span>
                  <select
                    aria-label="Maximum binding"
                    value={c.binding.maxVariable ?? ""}
                    onChange={(e) =>
                      s.apply(
                        bindVariable(c.id, {
                          ...c.binding!,
                          maxVariable: e.target.value || undefined,
                        }),
                      )
                    }
                  >
                    <option value="">Fixed maximum</option>
                    {Object.entries(s.gameData)
                      .filter(([, v]) => v.type === "number")
                      .map(([key]) => (
                        <option key={key}>{key}</option>
                      ))}
                  </select>
                </label>
              )}
              {c.binding && c.type !== "progressBar" && (
                <label className="property">
                  <span>Format</span>
                  <input
                    aria-label="Binding format"
                    value={c.binding.format ?? "{value}"}
                    onChange={(e) =>
                      s.apply(
                        bindVariable(c.id, {
                          ...c.binding!,
                          format: e.target.value,
                        }),
                      )
                    }
                  />
                </label>
              )}
              {c.binding && (
                <p className={`binding-status ${bound?.error ? "error" : ""}`}>
                  <i className="tiny-dot live" />
                  {bound?.error ??
                    `Live · ${c.type === "progressBar" ? `${bound?.value} / ${bound?.max}` : bound?.text}`}
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </aside>
  );
}
