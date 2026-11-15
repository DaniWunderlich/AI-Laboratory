import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LearningGuide } from "./LearningGuide";
import { template } from "./store";
import type { Metric, Run } from "./types";

afterEach(() => {
  cleanup();
  localStorage.clear();
});
const props = () => ({
  dataset: template().dataset,
  run: null,
  metrics: [],
  runCount: 0,
  onNavigate: vi.fn(),
  onXor: vi.fn(),
});

it("teaches XOR and navigates without replacing the experiment", () => {
  const options = props();
  render(<LearningGuide {...options} />);
  fireEvent.click(screen.getByRole("button", { name: "Klasse 1" }));
  expect(screen.getByRole("status").textContent).toContain("Klasse 0 richtig");
  fireEvent.click(screen.getByRole("button", { name: "Klasse 0" }));
  expect(screen.getByRole("status").textContent).toContain("Genau");
  fireEvent.click(screen.getByRole("button", { name: "Weiter →" }));
  expect(options.onNavigate).toHaveBeenCalledWith("model");
  expect(options.onXor).not.toHaveBeenCalled();
  expect(
    screen.getByRole("heading", { name: "2. Wie entsteht eine Vorhersage?" }),
  ).toBeTruthy();
});

it("shows actual selected-run metrics and explains the limits of XOR accuracy", () => {
  const options = props();
  const run = { id: "example", snapshot: template() } as Run;
  const metric = {
    epoch: 12,
    training_accuracy: 0.75,
    training_loss: 0.42,
  } as Metric;
  const { rerender } = render(<LearningGuide {...options} />);
  fireEvent.click(screen.getByRole("button", { name: "4. Ergebnisse" }));
  expect(screen.getByRole("status").textContent).toContain(
    "Noch keine Messwerte",
  );
  rerender(<LearningGuide {...options} run={run} metrics={[metric]} />);
  expect(screen.getByRole("status").textContent).toContain("75.0 %");
  expect(screen.getByRole("status").textContent).toContain("0.4200");
  expect(screen.getByRole("status").textContent).toContain(
    "keine neuen Beispiele",
  );
});

it("remembers collapsing the guide and lets the user reopen it", () => {
  const options = props();
  const first = render(<LearningGuide {...options} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Lernbegleitung ausblenden" }),
  );
  first.unmount();
  render(<LearningGuide {...options} />);
  expect(
    screen.queryByRole("heading", { name: "1. Was soll das Netz lernen?" }),
  ).toBe(null);
  fireEvent.click(
    screen.getByRole("button", { name: "Lernbegleitung öffnen" }),
  );
  expect(
    screen.getByRole("heading", { name: "1. Was soll das Netz lernen?" }),
  ).toBeTruthy();
});
