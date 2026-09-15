import {
  absolutePosition,
  anchoredPosition,
  type Binding,
  type UIComponent,
  type UISchema,
} from "./schema";
export type UIOperation =
  | { action: "createComponent"; component: UIComponent }
  | {
      action: "updateComponent";
      id: string;
      patch: Partial<Omit<UIComponent, "id" | "type">>;
    }
  | { action: "deleteComponent"; id: string }
  | { action: "moveComponent"; id: string; x: number; y: number }
  | {
      action: "resizeComponent";
      id: string;
      width: number;
      height: number;
      x?: number;
      y?: number;
    }
  | { action: "bindVariable"; id: string; binding?: Binding };
export const createComponent = (component: UIComponent): UIOperation => ({
  action: "createComponent",
  component,
});
export const updateComponent = (
  id: string,
  patch: Partial<Omit<UIComponent, "id" | "type">>,
): UIOperation => ({ action: "updateComponent", id, patch });
export const deleteComponent = (id: string): UIOperation => ({
  action: "deleteComponent",
  id,
});
export const moveComponent = (
  id: string,
  x: number,
  y: number,
): UIOperation => ({ action: "moveComponent", id, x, y });
export const resizeComponent = (
  id: string,
  width: number,
  height: number,
  x?: number,
  y?: number,
): UIOperation => ({ action: "resizeComponent", id, width, height, x, y });
export const bindVariable = (id: string, binding?: Binding): UIOperation => ({
  action: "bindVariable",
  id,
  binding,
});
export function applyUIOperation(schema: UISchema, op: UIOperation): UISchema {
  if (op.action === "createComponent") {
    if (schema.components.length >= 100)
      throw new Error("This MVP supports up to 100 components.");
    if (schema.components.some((c) => c.id === op.component.id))
      throw new Error("Duplicate component ID");
    return { ...schema, components: [...schema.components, op.component] };
  }
  if (!schema.components.some((c) => c.id === op.id))
    throw new Error("Component no longer exists.");
  if (op.action === "deleteComponent")
    return {
      ...schema,
      components: schema.components.filter((c) => c.id !== op.id),
    };
  return {
    ...schema,
    components: schema.components.map((c) => {
      if (c.id !== op.id) return c;
      if (op.action === "updateComponent") return { ...c, ...op.patch };
      if (op.action === "bindVariable") return { ...c, binding: op.binding };
      const res = schema.referenceResolution;
      if (op.action === "moveComponent") {
        const x = Math.max(0, Math.min(res.width - c.size.width, op.x));
        const y = Math.max(0, Math.min(res.height - c.size.height, op.y));
        return { ...c, position: anchoredPosition(c, res, x, y) };
      }
      const p = absolutePosition(c, res);
      const x = Math.max(0, Math.min(res.width - 24, op.x ?? p.x)),
        y = Math.max(0, Math.min(res.height - 24, op.y ?? p.y));
      const next = {
        ...c,
        size: {
          width: Math.max(24, Math.min(res.width - x, op.width)),
          height: Math.max(24, Math.min(res.height - y, op.height)),
        },
      };
      return { ...next, position: anchoredPosition(next, res, x, y) };
    }),
  };
}
