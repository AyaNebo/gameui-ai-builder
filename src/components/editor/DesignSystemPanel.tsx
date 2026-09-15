"use client";
import { useState } from "react";
import { Type, Palette, ArrowLeftRight, Radius, Link2 } from "lucide-react";
import { useEditor } from "@/editor/store";
import {
  typographyIds,
  colorIds,
  spacingIds,
  radiusIds,
  type TypographyId,
} from "@/editor/designSystem";
import { NumberInput } from "./NumberInput";
import { ColorField } from "./Inspector";
export function DesignSystemPanel() {
  const s = useEditor(),
    [group, setGroup] = useState<
      "typography" | "colors" | "spacing" | "radius"
    >("typography"),
    [id, setId] = useState<TypographyId>("heading");
  const token = s.designSystem.typography[id];
  const update = (changes: Partial<typeof token>) =>
    s.apply({
      action: "updateDesignToken",
      tokenType: "typography",
      tokenId: id,
      changes,
    });
  return (
    <aside className="library design-system-panel panel">
      <div className="library-head">
        <h2>Design System</h2>
        <p>One change. Every linked element.</p>
      </div>
      <div className="token-group-tabs">
        {(
          [
            { key: "typography", label: "Typography", icon: Type },
            { key: "colors", label: "Colors", icon: Palette },
            { key: "spacing", label: "Spacing", icon: ArrowLeftRight },
            { key: "radius", label: "Radius", icon: Radius },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={group === key ? "active" : ""}
            onClick={() => setGroup(key)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      {group === "typography" ? (
        <>
          <div className="typography-list">
            {typographyIds.map((key) => {
              const t = s.designSystem.typography[key];
              return (
                <button
                  aria-label={`Typography ${t.name}`}
                  key={key}
                  className={id === key ? "selected" : ""}
                  onClick={() => setId(key)}
                >
                  <span
                    className="token-letter"
                    style={{
                      fontFamily: t.fontFamily,
                      fontWeight: t.fontWeight,
                    }}
                  >
                    Aa
                  </span>
                  <span>
                    <strong>{t.name}</strong>
                    <small>
                      {t.fontFamily} / {t.fontSize} / {t.fontWeight}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
          <section className="token-editor" key={id}>
            <div className="section-heading">
              <h3>{token.name}</h3>
              <span>GLOBAL TOKEN</span>
            </div>
            <label className="setup-field">
              Font family
              <select
                aria-label="Token font family"
                value={token.fontFamily}
                onChange={(e) => update({ fontFamily: e.target.value })}
              >
                {[
                  "Arial",
                  "Georgia",
                  "Verdana",
                  "Courier New",
                  "system-ui",
                ].map((font) => (
                  <option key={font}>{font}</option>
                ))}
              </select>
            </label>
            <label className="setup-field">
              Font Size
              <NumberInput
                label="Token Font Size"
                value={token.fontSize}
                min={1}
                max={240}
                onChange={(fontSize) => update({ fontSize })}
              />
            </label>
            <label className="setup-field">
              Font Weight
              <select
                aria-label="Token font weight"
                value={token.fontWeight}
                onChange={(e) => update({ fontWeight: Number(e.target.value) })}
              >
                {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => (
                  <option key={n} value={n}>
                    {n}
                    {n === 400 ? " · Regular" : n === 700 ? " · Bold" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="setup-field">
              Line Height
              <NumberInput
                label="Token Line Height"
                value={token.lineHeight}
                min={0.5}
                max={3}
                onChange={(lineHeight) => update({ lineHeight })}
              />
            </label>
            <div
              className="token-sample"
              style={{
                fontFamily: token.fontFamily,
                fontSize: Math.min(token.fontSize, 48),
                fontWeight: token.fontWeight,
                lineHeight: token.lineHeight,
              }}
            >
              Level up.
            </div>
            <p className="token-inheritance">
              <Link2 size={13} />
              {
                s.schema.components.filter((c) => c.tokens?.typography === id)
                  .length
              }{" "}
              linked elements
            </p>
          </section>
        </>
      ) : group === "colors" ? (
        <section className="color-tokens">
          {colorIds.map((key) => (
            <div className="color-token" key={key}>
              <ColorField
                label={s.designSystem.colors[key].name}
                value={s.designSystem.colors[key].value}
                onChange={(value) =>
                  s.apply({
                    action: "updateDesignToken",
                    tokenType: "colors",
                    tokenId: key,
                    changes: { value },
                  })
                }
              />
              <small>
                {
                  s.schema.components.filter(
                    (c) =>
                      c.tokens?.color === key ||
                      c.tokens?.backgroundColor === key,
                  ).length
                }{" "}
                linked elements
              </small>
            </div>
          ))}
        </section>
      ) : (
        <section className="numeric-tokens">
          {(group === "spacing" ? spacingIds : radiusIds).map((key) => {
            const t = (
              group === "spacing"
                ? s.designSystem.spacing
                : s.designSystem.radius
            )[key as "s"];
            return (
              <label className="property" key={`${group}-${key}`}>
                <span>{t.name}</span>
                <NumberInput
                  label={`${group} ${t.name}`}
                  min={0}
                  max={500}
                  value={t.value}
                  onChange={(value) => {
                    if (group === "spacing")
                      s.apply({
                        action: "updateDesignToken",
                        tokenType: "spacing",
                        tokenId: key,
                        changes: { value },
                      });
                    else
                      s.apply({
                        action: "updateDesignToken",
                        tokenType: "radius",
                        tokenId: key as "s" | "m" | "l",
                        changes: { value },
                      });
                  }}
                />
              </label>
            );
          })}
        </section>
      )}
      <p className="system-footnote">
        Token values are game pixels. Local overrides stay independent until you
        reset them.
      </p>
    </aside>
  );
}
