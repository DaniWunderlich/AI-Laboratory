import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, it } from "vitest";
import { NodeDialog } from "./NodeDialog";
import { template, useEditor } from "./store";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

it("applies a neuron edit only when the dialog is submitted", () => {
  useEditor.getState().load(template());
  useEditor.getState().configure("layer_1");
  render(<NodeDialog />);
  fireEvent.change(screen.getByLabelText("Neuronen"), {
    target: { value: "12" },
  });
  expect(useEditor.getState().nodes[1].data.parameters.units).toBe(8);
  fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
  expect(useEditor.getState().nodes[1].data.parameters.units).toBe(12);
  expect(useEditor.getState().editing).toBe(null);
});

it("cancels an edit without changing the model", () => {
  useEditor.getState().load(template());
  useEditor.getState().configure("layer_1");
  render(<NodeDialog />);
  fireEvent.change(screen.getByLabelText("Neuronen"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
  expect(useEditor.getState().nodes[1].data.parameters.units).toBe(8);
  expect(useEditor.getState().dirty).toBe(false);
});

it("changes an activation and shows its mathematical curve", () => {
  useEditor.getState().load(template());
  useEditor.getState().configure("layer_2");
  render(<NodeDialog />);
  fireEvent.change(screen.getByLabelText("Aktivierungsfunktion"), {
    target: { value: "relu" },
  });
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("ReLU");
  expect(
    screen.getByRole("heading", { name: "ReLU konfigurieren" }),
  ).toBeTruthy();
  expect(screen.getByText(/Aus −2 wird 0, aus 3 bleibt 3/)).toBeTruthy();
  expect(useEditor.getState().nodes[2].data.kind).toBe("tanh");
  fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
  expect(useEditor.getState().nodes[2].data.kind).toBe("relu");
});
