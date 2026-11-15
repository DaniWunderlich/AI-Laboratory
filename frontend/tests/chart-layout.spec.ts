import { expect, test, type Page } from "@playwright/test";

async function expectStableCharts(page: Page) {
  const measurements = await page
    .getByRole("tabpanel")
    .evaluate(async (panel) => {
      const samples: { height: number; canvasHeight: number }[][] = [];
      for (let frame = 0; frame < 120; frame++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const sizes = Array.from(
          panel.querySelectorAll('[role="img"]'),
          (chart) => ({
            height: chart.getBoundingClientRect().height,
            canvasHeight:
              chart.querySelector("canvas")?.getBoundingClientRect().height ??
              0,
          }),
        );
        samples.push(sizes);
        // Stop a broken renderer before it can allocate an enormous canvas.
        if (sizes.some((size) => size.height > 1000)) break;
      }
      return samples;
    });
  expect(measurements.length).toBe(120);
  for (const sizes of measurements) {
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) {
      expect(size.height).toBeGreaterThanOrEqual(130);
      expect(size.height).toBeLessThanOrEqual(320);
      expect(size.canvasHeight).toBeLessThanOrEqual(320);
    }
  }
}

for (const width of [1440, 390]) {
  test(`training charts stay bounded through live updates and tab switches at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let navigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigations++;
    });
    await page.goto("/");
    await expect(page.getByText("Architektur gültig")).toBeVisible();
    await page
      .getByLabel("Experimentname")
      .fill(`Chart stability ${width} ${Date.now()}`);
    await page.getByRole("button", { name: "Training starten" }).click();
    await expect(
      page.getByRole("img", { name: "Trainings- und Validierungs-Loss" }),
    ).toBeVisible();
    await expectStableCharts(page);
    await expect(page.getByText("Abgeschlossen", { exact: true })).toBeVisible({
      timeout: 45000,
    });
    await expectStableCharts(page);
    const chart = page.getByRole("img", {
      name: "Trainings- und Validierungs-Loss",
    });
    const previousWidth = (await chart.boundingBox())!.width;
    await page.setViewportSize({
      width: width === 1440 ? 1100 : 600,
      height: 900,
    });
    await expect
      .poll(async () => (await chart.boundingBox())!.width)
      .not.toBe(previousWidth);
    await expectStableCharts(page);
    await page.getByRole("tab", { name: "Datensatz", exact: true }).click();
    await expectStableCharts(page);
    await page.getByRole("tab", { name: "Training", exact: true }).click();
    await expectStableCharts(page);
    expect(navigations).toBe(1);
  });
}
