// Ready-made, offline UI content — no AI/API call, no cost, works the
// instant a game is set up. Two kinds, both requested alongside the AI
// generation pipeline (which remains available from the AI Assistant panel
// for a bespoke, screenshot-aware result):
//  - HUD packs: one full, pre-composed HUD per design direction, using the
//    same chip/cluster patterns and Design System tokens the AI targets, so
//    a "Cozy pack" and an AI "Generate Cozy HUD" look like the same family.
//  - Component presets: small, individually reusable pieces (a resource
//    chip, a player-status cluster, an objective chip, etc.) for building a
//    HUD up by hand, one polished piece at a time.
import { makeComponent, type UIComponent } from "./schema";
import type { IconId } from "./icons";
import { designDirections, type DesignDirection } from "@/ai/schemas";
export { designDirections };
interface Visual {
  icon?: IconId;
  emoji?: string;
}
const PACK_VISUALS: Record<
  DesignDirection,
  { energy: Visual; resource: Visual & { name: string }; objective: Visual & { name: string } }
> = {
  Cozy: {
    energy: { emoji: "⚡" },
    resource: { emoji: "🥕", name: "Carrots" },
    objective: { emoji: "⭐", name: "Harvest Goal" },
  },
  Arcade: {
    energy: { icon: "zap" },
    resource: { icon: "coins", name: "Coins" },
    objective: { icon: "trophy", name: "High Score" },
  },
  Minimal: {
    energy: { icon: "zap" },
    resource: { icon: "coins", name: "Coins" },
    objective: { icon: "flag", name: "Objective" },
  },
  Fantasy: {
    energy: { icon: "potion" },
    resource: { icon: "gem", name: "Gold" },
    objective: { icon: "map", name: "Quest" },
  },
  "Sci-Fi": {
    energy: { icon: "zap" },
    resource: { icon: "gem", name: "Credits" },
    objective: { icon: "flag", name: "Mission" },
  },
};
const chipTokens = {
  typography: "heading" as const,
  color: "textPrimary" as const,
  backgroundColor: "surface" as const,
  padding: "m" as const,
  borderRadius: "l" as const,
};
// A full, pre-composed HUD for one design direction — the same visual
// vocabulary (rounded translucent chips, icon/emoji + bold value, grouped
// clusters) the AI is instructed to produce, but assembled deterministically
// so it's instantly available with zero API calls and zero cost. Bound to
// the sample Game Data every fresh project starts with, so it renders live
// immediately; rebinding to a real game's variables is a normal Inspector
// edit afterward.
export function buildHudPack(direction: DesignDirection): UIComponent[] {
  const v = PACK_VISUALS[direction];
  return [
    makeComponent("progressBar", {
      name: "Health Bar",
      anchor: "top-left",
      position: { x: 56, y: 60 },
      size: { width: 360, height: 34 },
      binding: { variable: "PlayerHealth", maxVariable: "MaxHealth" },
      tokens: { color: "success", borderRadius: "l" },
      aiGenerated: false,
    }),
    makeComponent("text", {
      name: "Energy",
      anchor: "top-left",
      position: { x: 56, y: 112 },
      size: { width: 220, height: 78 },
      binding: { variable: "Stamina", format: "{value}" },
      icon: v.energy.icon,
      emoji: v.energy.emoji,
      tokens: chipTokens,
      aiGenerated: false,
    }),
    makeComponent("text", {
      name: v.resource.name,
      anchor: "top-right",
      position: { x: -56, y: 56 },
      size: { width: 240, height: 86 },
      binding: { variable: "Coins", format: "{value}" },
      icon: v.resource.icon,
      emoji: v.resource.emoji,
      tokens: chipTokens,
      aiGenerated: false,
    }),
    makeComponent("text", {
      name: v.objective.name,
      anchor: "top-right",
      position: { x: -56, y: 158 },
      size: { width: 240, height: 78 },
      binding: { variable: "Score", format: "Score {value}" },
      icon: v.objective.icon,
      emoji: v.objective.emoji,
      tokens: chipTokens,
      aiGenerated: false,
    }),
    makeComponent("text", {
      name: "Status",
      anchor: "bottom-left",
      position: { x: 56, y: -56 },
      size: { width: 560, height: 80 },
      text: "Ready to play",
      tokens: {
        typography: "body",
        color: "textPrimary",
        backgroundColor: "surface",
        padding: "m",
        borderRadius: "l",
      },
      aiGenerated: false,
    }),
  ];
}
export interface ComponentPreset {
  id: string;
  name: string;
  description: string;
  build: () => UIComponent[];
}
// Small, reusable, already-polished pieces — build a HUD up by hand one
// piece at a time, each one editable exactly like an AI- or pack-created
// component (same operation system, same Design System inheritance).
export const componentPresets: ComponentPreset[] = [
  {
    id: "resource-chip",
    name: "Resource Chip",
    description: "Icon/emoji + a bold bound value — currency, a collectible, any counted resource.",
    build: () => [
      makeComponent("text", {
        name: "Resource Chip",
        icon: "coins",
        size: { width: 220, height: 84 },
        binding: { variable: "Coins", format: "{value}" },
        tokens: chipTokens,
        aiGenerated: false,
      }),
    ],
  },
  {
    id: "status-cluster",
    name: "Player Status Cluster",
    description: "A health bar grouped with an energy chip — the top-left player readout.",
    build: () => [
      makeComponent("progressBar", {
        name: "Health Bar",
        size: { width: 320, height: 32 },
        binding: { variable: "PlayerHealth", maxVariable: "MaxHealth" },
        tokens: { color: "success", borderRadius: "l" },
        aiGenerated: false,
      }),
      makeComponent("text", {
        name: "Energy",
        icon: "zap",
        position: { x: 0, y: 44 },
        size: { width: 200, height: 72 },
        binding: { variable: "Stamina" },
        tokens: { ...chipTokens, typography: "body" },
        aiGenerated: false,
      }),
    ],
  },
  {
    id: "objective-chip",
    name: "Objective Chip",
    description: "Icon + short label for the player's current goal.",
    build: () => [
      makeComponent("text", {
        name: "Objective",
        icon: "flag",
        text: "Find the exit",
        size: { width: 280, height: 78 },
        tokens: { ...chipTokens, typography: "body" },
        aiGenerated: false,
      }),
    ],
  },
  {
    id: "inventory-chip",
    name: "Inventory Chip",
    description: "Backpack icon + item count.",
    build: () => [
      makeComponent("text", {
        name: "Inventory",
        icon: "backpack",
        text: "3 items",
        size: { width: 220, height: 78 },
        tokens: { ...chipTokens, typography: "body" },
        aiGenerated: false,
      }),
    ],
  },
  {
    id: "action-button",
    name: "Circular Action Button",
    description: "A round, touch-style control surface with a strong central icon.",
    build: () => [
      makeComponent("button", {
        name: "Action",
        icon: "hand",
        text: "",
        anchor: "bottom-right",
        position: { x: -56, y: -56 },
        size: { width: 112, height: 112 },
        styleOverrides: { borderRadius: 56 },
        tokens: { backgroundColor: "primary", color: "textPrimary", padding: "m" },
        aiGenerated: false,
      }),
    ],
  },
];
