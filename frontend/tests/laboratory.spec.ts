import { expect, test } from "@playwright/test";

test("build, validate, train, inspect, compare and reopen a real XOR experiment", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("Backend verbunden")).toBeVisible();
  await expect(page.getByText("Architektur gültig")).toBeVisible();
  const name = `Browser XOR ${Date.now()}`;
  await page.getByLabel("Experimentname").fill(name);
  await page.getByRole("button", { name: "Training starten" }).click();
  await expect(page.getByText("Abgeschlossen", { exact: true })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.getByText("100.0%", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Decision Boundary des gewählten Checkpoints",
    }),
  ).toBeVisible();
  await page.getByLabel("Checkpoint", { exact: true }).selectOption("0");
  await expect(
    page.getByText("Checkpoint Epoche 0:", { exact: false }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Inspector" }).click();
  await expect(page.getByText("Sample Loss", { exact: false })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Ansicht", exact: true })
    .selectOption("weight_update");
  await expect(page.getByText("w′ = w − η · ∂L/∂w")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Ansicht", exact: true })
    .selectOption("backward");
  await expect(
    page.getByTitle(
      "Gradient des Loss nach dem Ausgang dieses Bausteins (Autograd).",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Training starten" }).click();
  await expect(page.getByText("Abgeschlossen", { exact: true })).toBeVisible({
    timeout: 45000,
  });
  await page.getByRole("tab", { name: "Vergleich" }).click();
  const firstRun = await page
    .getByRole("combobox", { name: "Vergleichen mit" })
    .locator("option")
    .nth(1)
    .getAttribute("value");
  await page
    .getByRole("combobox", { name: "Vergleichen mit" })
    .selectOption(firstRun!);
  await expect(
    page.getByRole("img", { name: "Loss-Vergleich zweier Trainingsläufe" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name, exact: true }).click();
  await expect(page.getByLabel("Experimentname")).toHaveValue(name);
  await expect(page.getByText("Architektur gültig")).toBeVisible();
  await page.getByRole("tab", { name: "Training", exact: true }).click();
  await expect(
    page.getByLabel("Training Run", { exact: true }).locator("option"),
  ).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("invalid editor state prevents training and deleting a node removes its edges", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Architektur gültig")).toBeVisible();
  await page
    .locator('[data-id="layer_1"]')
    .getByRole("button", { name: "Dense konfigurieren" })
    .click();
  await page
    .getByRole("spinbutton", { name: "Neuronen", exact: true })
    .fill("65");
  await expect(page.getByRole("button", { name: "Übernehmen" })).toBeDisabled();
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await page
    .locator('[data-id="layer_3"]')
    .getByRole("button", { name: "Dense konfigurieren" })
    .click();
  await page
    .getByRole("spinbutton", { name: "Neuronen", exact: true })
    .fill("2");
  await page.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Training starten" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Der Output braucht eine einzige Zahl.", { exact: false }),
  ).toBeVisible();
  await page
    .locator('[data-id="layer_3"]')
    .getByRole("button", { name: "Dense löschen" })
    .click();
  await expect(
    page.getByText(
      "Verbinde alle Bausteine zu einer einzigen Kette von Input bis Binary Output, ohne Lücken, Abzweigungen oder Kreise.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "▦ Dense +", exact: true }).click();
  await page.getByRole("button", { name: "Fit View", exact: true }).click();
  const newLayer = page.locator('.react-flow__node[data-id^="node_"]');
  await newLayer.getByRole("button", { name: "Dense konfigurieren" }).click();
  await page
    .getByRole("spinbutton", { name: "Neuronen", exact: true })
    .fill("1");
  await page.getByRole("button", { name: "Übernehmen" }).click();
  const replacement = page
    .locator(".react-flow__node")
    .filter({ hasText: "Dense (1)" });
  await page.locator('[data-id="layer_2"] .react-flow__handle.source').click();
  await replacement.locator(".react-flow__handle.target").click();
  await replacement.locator(".react-flow__handle.source").click();
  await page.locator('[data-id="layer_4"] .react-flow__handle.target').click();
  await expect(page.getByText("Architektur gültig")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Training starten" }),
  ).toBeEnabled();
});

test("mobile and tablet workbench stays within viewport", async ({ page }) => {
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByText("Architektur gültig")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../.tmp/workbench-${width}.png`,
      fullPage: true,
    });
  }
});
