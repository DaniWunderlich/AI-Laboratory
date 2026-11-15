import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ContextHelp, Field } from "./Help";

afterEach(cleanup);

it("opens help on hover and keeps clicked help open until Escape", () => {
  render(<ContextHelp topic="learning_rate" />);
  const button = screen.getByRole("button", { name: "Hilfe: Lernrate" });
  fireEvent.mouseEnter(button.parentElement!);
  expect(screen.getByRole("note").textContent).toContain("überspringen");
  fireEvent.click(button);
  fireEvent.mouseLeave(button.parentElement!);
  expect(button.getAttribute("aria-expanded")).toBe("true");
  fireEvent.keyDown(button, { key: "Escape" });
  expect(screen.queryByRole("note")).toBe(null);
  expect(document.activeElement).toBe(button);
});

it("closes clicked help with an outside press", () => {
  render(<ContextHelp topic="loss" />);
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByRole("note")).toBeTruthy();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("note")).toBe(null);
});

it("keeps labels and short descriptions associated with their input", () => {
  render(
    <Field label="Lernrate" topic="learning_rate">
      <input type="number" defaultValue={0.5} />
    </Field>,
  );
  const input = screen.getByLabelText("Lernrate");
  expect(
    document.getElementById(input.getAttribute("aria-describedby")!)
      ?.textContent,
  ).toContain("Korrekturschritt");
  expect(input.getAttribute("value")).toBe("0.5");
});
