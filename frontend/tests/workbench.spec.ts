import { expect, test, type Page } from "@playwright/test";

async function expectNoPageScroll(page: Page) {
  expect(
    await page.evaluate(() => ({
      height: document.scrollingElement!.scrollHeight,
      viewport: innerHeight,
      top: window.scrollY,
    })),
  ).toMatchObject({ top: 0 });
  expect(
    await page.evaluate(
      () => document.scrollingElement!.scrollHeight <= innerHeight + 1,
    ),
  ).toBe(true);
}

async function workbenchBounds(page: Page) {
  const canvas = await page.getByRole("application").boundingBox();
  const tabs = await page.getByRole("tablist").boundingBox();
  const panel = await page.getByRole("tabpanel").boundingBox();
  return {
    canvasY: canvas!.y,
    canvasHeight: canvas!.height,
    tabsY: tabs!.y,
    panelY: panel!.y,
    panelHeight: panel!.height,
  };
}

async function expectStableSplit(
  page: Page,
  baseline: Awaited<ReturnType<typeof workbenchBounds>>,
) {
  await expect
    .poll(async () => {
      const next = await workbenchBounds(page);
      return Math.max(
        ...Object.entries(baseline).map(([key, value]) =>
          Math.abs(next[key as keyof typeof next] - value),
        ),
      );
    })
    .toBeLessThanOrEqual(1);
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test(`desktop keeps canvas and live charts visible at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "AI Laboratory Startseite" }),
    ).toBeVisible();
    await expectNoPageScroll(page);
    await expect(page.getByText("Architektur gültig")).toBeVisible();
    const baseline = await workbenchBounds(page);
    for (const name of ["Training", "Inspector", "Vergleich", "Datensatz"]) {
      await page.getByRole("tab", { name, exact: true }).click();
      await expectStableSplit(page, baseline);
    }
    await page
      .getByLabel("Experimentname")
      .fill(`Desktop ${viewport.width} ${Date.now()}`);
    await page.getByRole("button", { name: "Training starten" }).click();
    await expectStableSplit(page, baseline);
    await expect(page.getByText("Abgeschlossen", { exact: true })).toBeVisible({
      timeout: 45000,
    });
    await expectNoPageScroll(page);
    await expectStableSplit(page, baseline);
    await expect(page.getByRole("application")).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole("img", { name: "Trainings- und Validierungs-Loss" }),
    ).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole("img", { name: "Trainings- und Validierungs-Accuracy" }),
    ).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByRole("img", {
        name: "Decision Boundary des gewählten Checkpoints",
      }),
    ).toBeInViewport({ ratio: 1 });
    await expect(page.getByLabel("Checkpoint", { exact: true })).toBeInViewport(
      { ratio: 1 },
    );
    await expect(
      page.getByLabel("Neuestem Checkpoint folgen", { exact: true }),
    ).toBeInViewport({ ratio: 1 });
    const panel = page.getByRole("tabpanel");
    await expect
      .poll(() =>
        panel.evaluate(
          (element) =>
            element.scrollHeight <= element.clientHeight + 1 &&
            element.scrollTop === 0,
        ),
      )
      .toBe(true);
    for (const name of ["Datensatz", "Inspector", "Vergleich", "Training"]) {
      await page.getByRole("tab", { name, exact: true }).click();
      await expectStableSplit(page, baseline);
    }
    await expect(
      page.getByText("Training verbessert", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `../.tmp/desktop-training-${viewport.width}.png`,
    });
    await page.getByText("Training verbessert", { exact: true }).click();
    await expect(
      page.getByText(/Auch 100 % belegen keine Leistung auf neuen Daten/),
    ).toBeVisible();
    await expectNoPageScroll(page);
    await expect
      .poll(() =>
        panel.evaluate(
          (element) =>
            element.scrollHeight <= element.clientHeight + 1 &&
            element.scrollTop === 0,
        ),
      )
      .toBe(true);
    await page
      .getByRole("button", { name: "Auswertung schließen", exact: true })
      .click();
    await page.getByLabel("Checkpoint", { exact: true }).selectOption("0");
    await expect(
      page.getByText("Checkpoint Epoche 0:", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Decision Boundary des gewählten Checkpoints",
      }),
    ).toBeInViewport({ ratio: 1 });
    await expect
      .poll(() =>
        panel.evaluate(
          (element) =>
            element.scrollHeight <= element.clientHeight + 1 &&
            element.scrollTop === 0,
        ),
      )
      .toBe(true);
  });
}

test("cards explain operations and configure activations with real function curves", async ({
  page,
}) => {
  await page.goto("/");
  const node = page.locator('[data-id="layer_2"]');
  await expect(
    node.getByText("Formt Zahlen sanft in den Bereich von −1 bis 1 um."),
  ).toBeVisible();
  await expect(
    node.getByRole("img", { name: /Funktionskurve Tanh/ }),
  ).toBeVisible();
  await node.getByRole("button", { name: "Tanh konfigurieren" }).click();
  await page
    .getByLabel("Aktivierungsfunktion", { exact: true })
    .selectOption("relu");
  await expect(
    page.getByRole("dialog").getByRole("img", { name: /Funktionskurve ReLU/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect(node.getByText("ReLU", { exact: true })).toBeVisible();
  await node.getByRole("button", { name: "ReLU löschen" }).click();
  await expect(node).toHaveCount(0);
});

test("higher epoch and checkpoint settings are accepted and persisted", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Experimentname")
    .fill(`Long training config ${Date.now()}`);
  await page.getByLabel("Epochen", { exact: true }).fill("1000");
  await page
    .getByText("Weitere Einstellungen: Batches, Seed und Checkpoints", {
      exact: true,
    })
    .click();
  await page.getByLabel("Checkpoint alle", { exact: true }).fill("10");
  await expect(
    page.getByText("99 reguläre Zwischenstände geplant", { exact: false }),
  ).toBeVisible();
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/experiments") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  const experiment = await (await saved).json();
  expect(experiment.definition.training.epochs).toBe(1000);
  expect(experiment.definition.training.checkpoint_interval).toBe(10);
  const capabilities = await (await request.get("/api/v1/capabilities")).json();
  expect(capabilities.max_epochs).toBeGreaterThan(300);
  expect(capabilities.max_checkpoints).toBeGreaterThan(20);
});

test("nearby ports preview and replace a connection only when the node is released", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const definition = {
    name: `Proximity ${Date.now()}`,
    model: {
      schema_version: 1,
      name: "Ports",
      nodes: [
        { id: "input", type: "input", parameters: { features: 2 } },
        { id: "first", type: "dense", parameters: { units: 4 } },
        { id: "replacement", type: "dense", parameters: { units: 1 } },
        { id: "output", type: "binary_output", parameters: {} },
      ],
      edges: [
        { source: "input", target: "first" },
        { source: "replacement", target: "output" },
      ],
    },
    layout: {
      input: { x: 0, y: 0 },
      first: { x: 350, y: 0 },
      replacement: { x: 100, y: 260 },
      output: { x: 700, y: 260 },
    },
  };
  const saved = await (
    await request.post("/api/v1/experiments", { data: definition })
  ).json();
  await page.goto("/");
  await page
    .getByRole("button", { name: definition.name, exact: true })
    .click();
  await expect(page.locator('[data-layout-ready="true"]')).toHaveCount(1);
  const input = page.locator('[data-id="input"]');
  const replacement = page.locator('[data-id="replacement"]');
  const from = await replacement
    .locator(".react-flow__handle.target")
    .boundingBox();
  const to = await input.locator(".react-flow__handle.source").boundingBox();
  const heading = await replacement.locator("strong").boundingBox();
  expect(from && to && heading).toBeTruthy();
  const start = { x: heading!.x + 20, y: heading!.y + 7 };
  const target = {
    x: start.x + to!.x + 28 - from!.x,
    y: start.y + to!.y - from!.y,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 20 });
  await expect(page.locator('[data-id="proximity-preview"]')).toBeVisible();
  await expect(
    page.locator('[aria-label="Edge from input to first"]'),
  ).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator('[data-id="proximity-preview"]')).toHaveCount(0);
  await expect(
    page.locator('[aria-label="Edge from input to first"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect
    .poll(async () => {
      const value = await (
        await request.get(`/api/v1/experiments/${saved.id}`)
      ).json();
      return value.definition.model.edges;
    })
    .toContainEqual({ source: "input", target: "replacement" });
});
