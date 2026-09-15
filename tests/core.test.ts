import test from "node:test";
import assert from "node:assert/strict";
import {
  makeComponent,
  absolutePosition,
  changeAnchor,
  anchors,
  initialSchema,
  initialGameData,
  resolveBinding,
  templateComponents,
} from "../src/editor/schema";
import {
  applyUIOperation,
  createComponent,
  moveComponent,
  resizeComponent,
  bindVariable,
  deleteComponent,
  updateComponent,
} from "../src/editor/operations";
import { validateSchema, validateProject } from "../src/editor/validation";
import {
  serializeUISchema,
  saveProject,
  loadProject,
  STORAGE_KEY,
} from "../src/editor/persistence";
import { interpretUICommand } from "../src/ai/mockAI";
const empty = () => ({ ...initialSchema(), components: [] });
test("all anchors round trip without shifting visual location", () => {
  const c = makeComponent("text");
  for (const anchor of anchors) {
    const next = {
      ...c,
      ...changeAnchor(c, { width: 1920, height: 1080 }, anchor),
    };
    assert.deepEqual(
      absolutePosition(next, { width: 1920, height: 1080 }),
      c.position,
    );
  }
});
test("create, move, resize, bind, update, delete share one schema", () => {
  const c = makeComponent("text", {
    anchor: "top-right",
    position: { x: -40, y: 40 },
  });
  let s = applyUIOperation(empty(), createComponent(c));
  s = applyUIOperation(s, moveComponent(c.id, 1500, 120));
  assert.equal(s.components[0].position.x, -140);
  s = applyUIOperation(s, resizeComponent(c.id, 360, 120));
  assert.deepEqual(absolutePosition(s.components[0], s.referenceResolution), {
    x: 1500,
    y: 120,
  });
  s = applyUIOperation(s, bindVariable(c.id, { variable: "Coins" }));
  assert.equal(resolveBinding(s.components[0], initialGameData).text, "124");
  s = applyUIOperation(
    s,
    updateComponent(c.id, { style: { ...c.style, fontSize: 48 } }),
  );
  assert.equal(s.components[0].style.fontSize, 48);
  s = applyUIOperation(s, deleteComponent(c.id));
  assert.equal(s.components.length, 0);
});
test("move clamps edges and resize retains minimum", () => {
  const c = makeComponent("panel");
  let s = applyUIOperation(empty(), createComponent(c));
  s = applyUIOperation(s, moveComponent(c.id, 9999, -100));
  assert.deepEqual(absolutePosition(s.components[0], s.referenceResolution), {
    x: 1520,
    y: 0,
  });
  s = applyUIOperation(s, resizeComponent(c.id, 0, 0));
  assert.deepEqual(s.components[0].size, { width: 24, height: 24 });
});
test("live numeric/string bindings and maximum binding", () => {
  const c = makeComponent("progressBar", {
    binding: { variable: "PlayerHealth", maxVariable: "MaxHealth" },
  });
  assert.equal(resolveBinding(c, initialGameData).value, 75);
  assert.equal(
    resolveBinding(c, {
      ...initialGameData,
      PlayerHealth: { type: "number", value: 20 },
    }).value,
    20,
  );
  assert.equal(resolveBinding(c, initialGameData).max, 100);
  assert.ok(
    resolveBinding(
      { ...c, binding: { variable: "SelectedItem" } },
      initialGameData,
    ).error,
  );
  assert.ok(
    resolveBinding({ ...c, binding: { variable: "missing" } }, initialGameData)
      .error,
  );
  assert.ok(
    resolveBinding(c, {
      ...initialGameData,
      MaxHealth: { type: "number", value: 0 },
    }).error,
  );
  assert.equal(
    resolveBinding(
      makeComponent("text", { binding: { variable: "SelectedItem" } }),
      initialGameData,
    ).text,
    "Carrot",
  );
});
test("all templates are valid independently editable primitives", () => {
  for (const name of ["HUD", "Inventory", "Dialogue", "Pause Menu"]) {
    const s = templateComponents(name)
      .map(createComponent)
      .reduce(applyUIOperation, empty());
    validateSchema(s);
    assert.ok(s.components.length > 1);
  }
});
test("save/load restores exactly and export produces a valid portable definition", () => {
  const items = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      setItem: (k: string, v: string) => items.set(k, v),
      getItem: (k: string) => items.get(k) ?? null,
    },
  });
  const project = {
    name: "Happy Harvest",
    engine: "Unity" as const,
    schema: initialSchema(),
    gameData: initialGameData,
    savedAt: new Date().toISOString(),
  };
  saveProject(project);
  assert.deepEqual(loadProject(), project);
  validateSchema(JSON.parse(serializeUISchema(project.schema)));
  items.set(STORAGE_KEY, '{"invalid":true}');
  assert.throws(loadProject);
});
test("invalid schema and corrupt project rejected", () => {
  assert.throws(() => validateSchema({}));
  const s = initialSchema();
  s.components[0].position.x = NaN;
  assert.throws(() => validateSchema(s));
  assert.throws(() =>
    validateProject({ schema: initialSchema(), gameData: [], name: "bad" }),
  );
  const duplicate = initialSchema();
  duplicate.components.push(duplicate.components[0]);
  assert.throws(() => validateSchema(duplicate));
});
test("mock commands produce schema operations; unsupported commands are explicit", async () => {
  const operations = await interpretUICommand(
    "Add a health bar",
    empty(),
    initialGameData,
  );
  validateSchema(operations.reduce(applyUIOperation, empty()));
  await assert.rejects(
    () => interpretUICommand("do magic", empty(), initialGameData),
    /Mock mode/,
  );
});
