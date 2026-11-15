import { expect, test } from "@playwright/test";

test("a beginner can follow the lesson through real training and inspection", async ({
  page,
}) => {
  await page.goto("/");
  const guide = page.getByRole("region", { name: "Geführter Einstieg" });
  await expect(
    guide.getByRole("heading", { name: "1. Was soll das Netz lernen?" }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Klasse 1", exact: true }).click();
  await expect(guide.getByRole("status")).toContainText("Klasse 0 richtig");
  await guide.getByRole("button", { name: "Klasse 0", exact: true }).click();
  await expect(guide.getByRole("status")).toContainText("Genau");
  await guide.getByRole("button", { name: "Weiter →" }).click();
  await guide
    .getByRole("button", { name: "Schichteinstellungen öffnen", exact: false })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Neuronen", exact: true }),
  ).toHaveValue("8");
  await page.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(page.getByText("Ungespeichert", { exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel("Batchgröße", { exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Hilfe: Lernrate", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("note")).toContainText("überspringen");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("note")).toHaveCount(0);
  await guide.getByRole("button", { name: "Weiter →" }).click();
  await page.getByLabel("Experimentname").fill(`Guided XOR ${Date.now()}`);
  await expect(page.getByText("Architektur gültig")).toBeVisible();
  await page.getByRole("button", { name: "Training starten" }).click();
  await expect(page.getByText("Abgeschlossen", { exact: true })).toBeVisible({
    timeout: 45000,
  });
  await guide.getByRole("button", { name: "Weiter →" }).click();
  await expect(guide.getByRole("status")).toContainText("100.0 %");
  await expect(guide.getByRole("status")).toContainText(
    "keine neuen Beispiele",
  );
  await page.getByLabel("Checkpoint", { exact: true }).selectOption("0");
  await guide.getByRole("button", { name: "Weiter →" }).click();
  await expect(page.getByText("Vom Datenpunkt zur Vorhersage")).toBeVisible();
  await page.getByRole("button", { name: "Nächster Baustein →" }).click();
  await expect(
    page.getByTitle("Tensor vor und nach dieser Operation."),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Weiter →" }).click();
  await expect(
    page.getByText(
      "Zum Vergleich brauchst du zwei Runs desselben Experiments.",
      { exact: false },
    ),
  ).toBeVisible();
});

test.describe("touch learning help", () => {
  test.use({ hasTouch: true });
  test("touch help fits the viewport and learning controls preserve a draft", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/");
    const guide = page.getByRole("region", { name: "Geführter Einstieg" });
    await page
      .getByLabel("Experimentname")
      .fill("Mein ungespeicherter Entwurf");
    page.once("dialog", (dialog) => dialog.dismiss());
    await guide.getByRole("button", { name: "XOR-Vorlage öffnen" }).click();
    await expect(page.getByLabel("Experimentname")).toHaveValue(
      "Mein ungespeicherter Entwurf",
    );
    await guide
      .getByRole("button", { name: "Lernbegleitung ausblenden" })
      .click();
    await expect(page.getByLabel("Experimentname")).toHaveValue(
      "Mein ungespeicherter Entwurf",
    );
    await page
      .getByRole("button", { name: "Hilfe: Lernrate", exact: true })
      .tap();
    const note = page.getByRole("note");
    await expect(note).toBeVisible();
    const box = (await note.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(900);
    await page.screenshot({
      path: "../.tmp/learning-mobile-help.png",
      fullPage: false,
    });
    await page.getByLabel("Experimentname").click();
    await expect(note).not.toBeVisible();
    await guide.getByRole("button", { name: "Lernbegleitung öffnen" }).click();
    await expect(
      guide.getByRole("heading", { name: "1. Was soll das Netz lernen?" }),
    ).toBeVisible();
  });
});
