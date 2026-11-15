import { expect, test, type Page } from "@playwright/test";

async function noOverviewScroll(page: Page) {
  await expect
    .poll(() =>
      page
        .getByRole("tabpanel")
        .evaluate((el) => el.scrollHeight - el.clientHeight),
    )
    .toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(
      () =>
        document.scrollingElement!.scrollHeight <= innerHeight + 1 &&
        scrollY === 0,
    ),
  ).toBe(true);
}

test("language and appearance persist without replacing the draft, including activation help", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Experimentname").fill("Mein eigener Versuch");
  await page
    .getByRole("button", { name: "Dunkler Modus", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Sprache auswählen", exact: true })
    .click();
  await page.getByRole("button", { name: "🇬🇧 English", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Dataset", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Experiment name")).toHaveValue(
    "Mein eigener Versuch",
  );
  await expect(
    page.getByRole("heading", { name: "Learning guide", exact: true }),
  ).toBeVisible();
  const activation = page.locator('[data-id="layer_2"]');
  await expect(
    activation.getByText("Smoothly maps numbers into the range −1 to 1."),
  ).toBeVisible();
  await activation
    .getByRole("button", { name: "Configure Tanh", exact: true })
    .click();
  await page
    .getByLabel("Activation function", { exact: true })
    .selectOption("relu");
  await expect(
    page.getByRole("heading", { name: "ReLU settings" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Example: −2 becomes 0, while 3 remains 3/),
  ).toBeVisible();
  const close = page.getByRole("button", {
    name: "Close building block dialog",
  });
  expect(
    await close.evaluate((el) => ({
      align: getComputedStyle(el).alignItems,
      justify: getComputedStyle(el).justifyContent,
    })),
  ).toEqual({ align: "center", justify: "center" });
  await page.screenshot({ path: "../.tmp/dark-english-dialog.png" });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(activation.getByText("Tanh", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Light mode", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Light mode", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("2000 moons and circles render, invalid values and request failures stop loading and recover", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Datensatz", { exact: true }).selectOption("moons");
  await page.getByLabel("Datenpunkte", { exact: true }).fill("2000");
  await expect(
    page.getByText("1600 Training / 400 Validation", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Datensatz als Scatterplot" }),
  ).toBeVisible();
  await page.getByLabel("Datensatz", { exact: true }).selectOption("circles");
  await expect(
    page.getByText("1600 Training / 400 Validation", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Datenpunkte", { exact: true }).fill("10001");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Bitte 20 bis 10000 Datenpunkte" }),
  ).toBeVisible();
  await expect(page.getByText("Datensatz wird erzeugt …")).toHaveCount(0);
  await page.route(
    "**/datasets/generate",
    (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Test: Datensatz nicht verfügbar" }),
      }),
    { times: 1 },
  );
  await page.getByLabel("Datenpunkte", { exact: true }).fill("2000");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Test: Datensatz nicht verfügbar" }),
  ).toBeVisible();
  await expect(page.getByText("Datensatz wird erzeugt …")).toHaveCount(0);
  await page.getByLabel("Datenpunkte", { exact: true }).fill("2001");
  await expect(
    page.getByRole("img", { name: "Datensatz als Scatterplot" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Test: Datensatz nicht verfügbar" }),
  ).toHaveCount(0);
});

test("each saved experiment can be deleted independently without losing the current draft", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByLabel("Experimentname").fill(`Delete target ${Date.now()}`);
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/experiments") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  const target = await (await saved).json();
  await page
    .getByRole("button", { name: "XOR · Hidden Layer ↗", exact: true })
    .click();
  await page.getByLabel("Experimentname").fill("Diesen Entwurf behalten");
  const trash = page.getByRole("button", {
    name: `Experiment „${target.name}“ löschen`,
    exact: true,
  });
  page.once("dialog", (d) => d.dismiss());
  await trash.click();
  await expect(trash).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await trash.click();
  await expect(trash).toHaveCount(0);
  expect((await request.get(`/api/v1/experiments/${target.id}`)).status()).toBe(
    404,
  );
  await expect(page.getByLabel("Experimentname")).toHaveValue(
    "Diesen Entwurf behalten",
  );
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`inspector and comparison show simultaneous panels at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const plot = page.getByRole("img", { name: "Datensatz als Scatterplot" });
    await expect(plot).toBeVisible();
    expect((await plot.boundingBox())!.width).toBeLessThanOrEqual(440);
    await page
      .getByLabel("Experimentname")
      .fill(`Panels ${viewport.width} ${Date.now()}`);
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Training starten" }).click();
      await expect(
        page.getByText("Abgeschlossen", { exact: true }),
      ).toBeVisible({ timeout: 45000 });
    }
    await page.getByRole("tab", { name: "Inspector", exact: true }).click();
    await expect(page.getByText("Sample Loss", { exact: false })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Nächster Baustein →", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    await expect(
      page.getByText("Gewichte, Bias und Gradienten ·", { exact: false }),
    ).toBeInViewport({ ratio: 1 });
    await noOverviewScroll(page);
    await page.screenshot({ path: `../.tmp/inspector-${viewport.width}.png` });
    for (const mode of ["backward", "neuron", "weight_update"]) {
      await page.getByLabel("Ansicht", { exact: true }).selectOption(mode);
      await expect(
        page.getByText("Sample Loss", { exact: false }),
      ).toBeVisible();
      await noOverviewScroll(page);
    }
    await page.getByRole("tab", { name: "Vergleich", exact: true }).click();
    await page
      .getByLabel("Vergleichen mit", { exact: true })
      .selectOption({ index: 1 });
    await expect(
      page.getByRole("img", { name: "Loss-Vergleich zweier Trainingsläufe" }),
    ).toBeInViewport({ ratio: 1 });
    for (const item of await page
      .getByText("Validation Accuracy", { exact: true })
      .all())
      await expect(item).toBeInViewport({ ratio: 1 });
    await noOverviewScroll(page);
    await page.screenshot({ path: `../.tmp/compare-${viewport.width}.png` });
    await page
      .getByRole("button", { name: "Dunkler Modus", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await noOverviewScroll(page);
    await page.screenshot({
      path: `../.tmp/compare-dark-${viewport.width}.png`,
      animations: "disabled",
    });
  });
}
