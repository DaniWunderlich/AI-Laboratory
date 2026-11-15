import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { learningTrend, TrainingFeedback } from "./TrainingFeedback";
import { template } from "./store";
import type { Metric, Run } from "./types";

afterEach(cleanup);
const metric = (
  epoch: number,
  loss: number,
  accuracy: number,
  validation_loss: number | null = null,
): Metric => ({
  epoch,
  training_loss: loss,
  training_accuracy: accuracy,
  validation_loss,
  validation_accuracy: validation_loss === null ? null : 0.5,
  learning_rate: 0.5,
  epoch_duration_ms: 1,
});
it("distinguishes improvement, degradation and conflicting metrics", () => {
  expect(learningTrend([metric(1, 0.7, 0.5), metric(2, 0.2, 1)])?.label).toBe(
    "Training verbessert",
  );
  expect(learningTrend([metric(1, 0.2, 1), metric(2, 0.7, 0.5)])?.label).toBe(
    "Training verschlechtert",
  );
  expect(
    learningTrend([metric(1, 0.7, 0.5), metric(2, 0.2, 0.25)])?.label,
  ).toBe("Gemischtes Ergebnis");
  expect(
    learningTrend([metric(1, 0.7, 0.5), metric(2, 0.7001, 0.5)])?.label,
  ).toBe("Kaum Veränderung");
  expect(learningTrend([metric(1, 0.7, 0.5)])).toBe(null);
});
it("flags diverging training and validation curves without claiming a diagnosis", () => {
  expect(
    learningTrend([metric(1, 0.7, 0.5, 0.6), metric(2, 0.2, 1, 0.9)])
      ?.overfitting,
  ).toBe(true);
});
it("qualifies comparisons with different seeds and preserves the XOR caveat", () => {
  const run = {
    id: "current",
    status: "COMPLETED",
    snapshot: template(),
  } as Run;
  const previous = {
    ...run,
    id: "previous",
    snapshot: { ...template(), training: { ...template().training, seed: 1 } },
  };
  render(
    <TrainingFeedback
      run={run}
      metrics={[metric(1, 0.7, 0.5), metric(2, 0.2, 1)]}
      previous={previous}
      previousMetrics={[metric(1, 0.3, 0.75)]}
    />,
  );
  expect(
    screen.getByText(/Datensatz oder Trainings-Seed unterscheiden/),
  ).toBeTruthy();
  expect(
    screen.getByText(/Auch 100 % belegen keine Leistung auf neuen Daten/),
  ).toBeTruthy();
});
