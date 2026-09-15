// Lightweight SVG icon system for structured GameUI components (see
// UIComponent.icon in schema.ts). Reuses lucide-react, already a project
// dependency, instead of adding a new one — small, tree-shakeable,
// component-based (never emoji, never external image URLs), so AI- and
// manually-created "chips" (icon + value, e.g. a coin counter or health
// readout) render the same lightweight vector icons either way.
import {
  Heart,
  Coins,
  Star,
  Gem,
  Clock,
  Timer,
  Backpack,
  Map,
  Home,
  Settings,
  Trophy,
  Flag,
  Zap,
  Shield,
  Key,
  Check,
  TriangleAlert,
  Carrot,
  Leaf,
  Apple,
  Wheat,
  Hand,
  Sword,
  FlaskConical,
  Fish,
  TreePine,
  Mountain,
  type LucideIcon,
} from "lucide-react";
export const iconIds = [
  "heart",
  "coins",
  "star",
  "gem",
  "clock",
  "timer",
  "backpack",
  "map",
  "home",
  "settings",
  "trophy",
  "flag",
  "zap",
  "shield",
  "key",
  "check",
  "warning",
  "carrot",
  "leaf",
  "apple",
  "wheat",
  "hand",
  "sword",
  "potion",
  "fish",
  "wood",
  "stone",
] as const;
export type IconId = (typeof iconIds)[number];
export const iconRegistry: Record<IconId, { icon: LucideIcon; label: string }> = {
  heart: { icon: Heart, label: "Heart / Health" },
  coins: { icon: Coins, label: "Coins / Currency" },
  star: { icon: Star, label: "Star / Rating" },
  gem: { icon: Gem, label: "Gem / Premium currency" },
  clock: { icon: Clock, label: "Clock / Time of day" },
  timer: { icon: Timer, label: "Timer / Countdown" },
  backpack: { icon: Backpack, label: "Backpack / Inventory" },
  map: { icon: Map, label: "Map / Objective" },
  home: { icon: Home, label: "Home / Base" },
  settings: { icon: Settings, label: "Settings" },
  trophy: { icon: Trophy, label: "Trophy / Achievement" },
  flag: { icon: Flag, label: "Flag / Checkpoint" },
  zap: { icon: Zap, label: "Lightning / Energy, speed" },
  shield: { icon: Shield, label: "Shield / Defense, armor" },
  key: { icon: Key, label: "Key / Unlock" },
  check: { icon: Check, label: "Check / Objective complete" },
  warning: { icon: TriangleAlert, label: "Warning / Alert" },
  carrot: { icon: Carrot, label: "Carrot / Crop, farming resource" },
  leaf: { icon: Leaf, label: "Leaf / Plant, nature, generic crop" },
  apple: { icon: Apple, label: "Apple / Food resource" },
  wheat: { icon: Wheat, label: "Wheat / Harvest, farming" },
  hand: { icon: Hand, label: "Hand / Interact, touch action" },
  sword: { icon: Sword, label: "Sword / Combat, weapon, attack" },
  potion: { icon: FlaskConical, label: "Potion / Consumable, buff" },
  fish: { icon: Fish, label: "Fish / Catch, aquatic resource" },
  wood: { icon: TreePine, label: "Wood / Crafting material" },
  stone: { icon: Mountain, label: "Stone / Crafting material, terrain" },
};
// Deterministic fallback for when a truly ideal icon id doesn't exist in
// the registry above. The AI is constrained to iconIds by the structured
// schema (it literally cannot emit an id outside this set), so this exists
// as prompt guidance — it documents the same mapping we ask the model to
// use, and gives the rest of the app one place to resolve a fuzzy concept
// (e.g. from a semanticRole) to a real icon id if ever needed.
export const iconFallbacks: Record<string, IconId> = {
  vegetable: "leaf",
  crop: "leaf",
  plant: "leaf",
  treasure: "gem",
  currency: "coins",
  money: "coins",
  item: "backpack",
  inventory: "backpack",
  bag: "backpack",
  objective: "flag",
  quest: "map",
  goal: "flag",
  status: "heart",
  health: "heart",
  energy: "zap",
  stamina: "zap",
  time: "clock",
  countdown: "timer",
  weapon: "sword",
  combat: "sword",
  material: "stone",
  crafting: "wood",
  food: "apple",
};
export function isIconId(value: unknown): value is IconId {
  return typeof value === "string" && (iconIds as readonly string[]).includes(value);
}
export function Icon({
  id,
  size = 16,
  className,
}: {
  id: IconId;
  size?: number;
  className?: string;
}) {
  const Cmp = iconRegistry[id].icon;
  return <Cmp size={size} className={className} aria-hidden="true" />;
}
