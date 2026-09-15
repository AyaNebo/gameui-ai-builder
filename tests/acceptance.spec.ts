import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { validateSchema } from "../src/editor/validation";
test("complete Milestone 1–2 acceptance workflow", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (e) => runtimeErrors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "GameUI AI" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connected Unity · Mock adapter" }),
  ).toBeVisible();
  await expect(
    page.getByAltText(
      "Cozy farming game with a rabbit exploring a sunlit garden",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Unreal/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Godot/ })).toBeDisabled();
  await page.getByRole("button", { name: "Game View", exact: true }).click();
  await expect(page.locator(".resize-handle")).toHaveCount(0);
  await page.getByRole("button", { name: "UI Edit Mode", exact: true }).click();
  await page
    .locator(".component-grid")
    .getByRole("button", { name: "Text", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Text");
  const selected = page.locator(".ui-element.selected");
  const oldX = Number(
      await page
        .getByRole("spinbutton", { name: "X", exact: true })
        .inputValue(),
    ),
    oldY = Number(
      await page
        .getByRole("spinbutton", { name: "Y", exact: true })
        .inputValue(),
    );
  let box = (await selected.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 45,
    box.y + box.height / 2 + 22,
    { steps: 10 },
  );
  await page.mouse.up();
  const canvasBox = (await page.getByTestId("game-canvas").boundingBox())!;
  const scale = canvasBox.width / 1920;
  expect(
    Number(
      await page
        .getByRole("spinbutton", { name: "X", exact: true })
        .inputValue(),
    ),
  ).toBeCloseTo(oldX + 45 / scale, 0);
  expect(
    Number(
      await page
        .getByRole("spinbutton", { name: "Y", exact: true })
        .inputValue(),
    ),
  ).toBeCloseTo(oldY + 22 / scale, 0);
  const widthBefore = Number(
    await page
      .getByRole("spinbutton", { name: "Width", exact: true })
      .inputValue(),
  );
  const handle = await page
    .getByRole("button", { name: "Resize se", exact: true })
    .boundingBox();
  await page.mouse.move(
    handle!.x + handle!.width / 2,
    handle!.y + handle!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle!.x + handle!.width / 2 + 40,
    handle!.y + handle!.height / 2 + 20,
    { steps: 10 },
  );
  await page.mouse.up();
  expect(
    Number(
      await page
        .getByRole("spinbutton", { name: "Width", exact: true })
        .inputValue(),
    ),
  ).toBeGreaterThan(widthBefore);
  await page
    .getByRole("spinbutton", { name: "Font Size", exact: true })
    .fill("48");
  await expect(selected).toHaveCSS("font-size", "48px");
  await page
    .getByRole("textbox", { name: "Text Color", exact: true })
    .fill("#ffcc00");
  await expect(selected).toHaveCSS("color", "rgb(255, 204, 0)");
  await page
    .getByRole("textbox", { name: "Background", exact: true })
    .fill("#223344");
  await expect(selected).toHaveCSS("background-color", "rgb(34, 51, 68)");
  const beforeAnchor = (await selected.boundingBox())!;
  await page
    .getByRole("button", { name: "Anchor bottom-right", exact: true })
    .click();
  const afterAnchor = (await selected.boundingBox())!;
  expect(afterAnchor.x).toBeCloseTo(beforeAnchor.x, 1);
  expect(afterAnchor.y).toBeCloseTo(beforeAnchor.y, 1);
  await page
    .getByRole("combobox", { name: "Binding variable", exact: true })
    .selectOption("Coins");
  await expect(selected.locator(":scope > span").first()).toHaveText("124");
  await page
    .locator(".panel-tabs")
    .getByRole("button", { name: "Game Data", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Coins", exact: true })
    .fill("125");
  await expect(selected.locator(":scope > span").first()).toHaveText("125");
  await page
    .locator(".panel-tabs")
    .getByRole("button", { name: "Inspector", exact: true })
    .click();
  await page
    .locator(".component-grid")
    .getByRole("button", { name: "Progress Bar", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Binding variable", exact: true })
    .selectOption("PlayerHealth");
  await page
    .getByRole("combobox", { name: "Maximum binding", exact: true })
    .selectOption("MaxHealth");
  await expect(selected.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "75",
  );
  await expect(selected.locator(".progress-fill")).toHaveAttribute(
    "style",
    /75%/,
  );
  await page
    .locator(".panel-tabs")
    .getByRole("button", { name: "Game Data", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "PlayerHealth", exact: true })
    .fill("20");
  await expect(selected.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "20",
  );
  await expect(selected.locator(".progress-fill")).toHaveAttribute(
    "style",
    /20%/,
  );
  await page.getByRole("button", { name: "Save Project", exact: true }).click();
  const saved = await page.evaluate(() =>
    localStorage.getItem("gameui-project-v1"),
  );
  expect(saved).toBeTruthy();
  await page.reload();
  await expect(page.locator(".ui-element")).toHaveCount(6);
  await expect(
    page.locator('[data-component-type="text"]').last(),
  ).toContainText("125");
  await expect(
    page.getByRole("progressbar", { name: "Progress Bar", exact: true }),
  ).toHaveAttribute("aria-valuenow", "20");
  expect(
    await page.evaluate(() => localStorage.getItem("gameui-project-v1")),
  ).toEqual(saved);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export UI System", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("happy-harvest.gameui.json");
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  validateSchema(exported);
  expect(exported).toEqual(JSON.parse(saved!).schema);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".canvas-caption")).toContainText("Playing mock");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator(".canvas-caption")).toContainText("Paused");
  expect(runtimeErrors).toEqual([]);
  await page.screenshot({ path: "tests/acceptance.png", fullPage: true });
});
test("templates, undo, delete, mock commands, invalid save recovery", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".template-card").filter({ hasText: "Inventory" }).click();
  await expect(page.locator(".ui-element")).toHaveCount(9);
  await page.getByRole("button", { name: "Undo (⌘Z)", exact: true }).click();
  await expect(page.locator(".ui-element")).toHaveCount(4);
  await page.getByRole("button", { name: "Redo (⌘⇧Z)", exact: true }).click();
  await expect(page.locator(".ui-element")).toHaveCount(9);
  await page
    .locator(".layers-list")
    .getByRole("button", { name: "Inventory Slot 4" })
    .click();
  await page.keyboard.press("Delete");
  await expect(page.locator(".ui-element")).toHaveCount(8);
  await page
    .getByRole("button", { name: "Add a health bar", exact: true })
    .click();
  await expect(page.locator(".ui-element")).toHaveCount(9);
  await page
    .getByRole("textbox", { name: "AI command", exact: true })
    .fill("invent an entire game");
  await page.getByRole("button", { name: "Send command", exact: true }).click();
  await expect(page.locator(".chat-log")).toContainText(
    "Mock mode supports the four suggestion commands",
  );
  await page.getByRole("button", { name: "Save Project", exact: true }).click();
  await page.evaluate(() =>
    localStorage.setItem("gameui-project-v1", '{"bad":true}'),
  );
  await page.reload();
  await expect(page.locator(".ui-element")).toHaveCount(4);
  await expect(page.locator(".toast")).toContainText(
    "Saved project could not be loaded",
  );
});
test("numeric drafting, icon appearance and desktop layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".ui-element")).toHaveCount(4);
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(1440);
  await page.screenshot({ path: "docs/editor-preview.png", fullPage: true });
  await page
    .locator(".component-grid")
    .getByRole("button", { name: "Image / Icon", exact: true })
    .click();
  const size = page.getByRole("spinbutton", { name: "Font Size", exact: true });
  await size.fill("");
  await size.pressSequentially("90");
  await expect(size).toHaveValue("90");
  await expect(page.locator(".ui-element.selected")).toHaveCSS(
    "font-size",
    "90px",
  );
  const width = page.getByRole("spinbutton", { name: "Width", exact: true });
  await width.fill("");
  await width.pressSequentially("60");
  await width.blur();
  await expect(width).toHaveValue("60");
  await expect(page.locator(".ui-element.selected")).toHaveCSS("width", "60px");
  const x = page.getByRole("spinbutton", { name: "X", exact: true });
  await x.fill("");
  await x.pressSequentially("-20");
  await x.blur();
  await expect(x).toHaveValue("-20");
  await page.getByRole("button", { name: "Save Project", exact: true }).click();
});
