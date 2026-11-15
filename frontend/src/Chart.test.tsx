import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Chart } from "./Chart";

const mock = vi.hoisted(() => ({
  init: vi.fn(),
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
  on: vi.fn(),
  width: 400,
  height: 240,
}));
vi.mock("echarts/core", () => ({ use: vi.fn(), init: mock.init }));

let notifyResize: () => void;
const disconnect = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  mock.width = 400;
  mock.height = 240;
  mock.init.mockReturnValue({
    setOption: mock.setOption,
    resize: mock.resize,
    dispose: mock.dispose,
    on: mock.on,
    getWidth: () => mock.width,
    getHeight: () => mock.height,
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        notifyResize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("updates live data on the existing chart and disposes it on unmount", () => {
  const first = { series: [{ type: "line" as const, data: [[1, 0.7]] }] };
  const next = {
    series: [
      {
        type: "line" as const,
        data: [
          [1, 0.7],
          [2, 0.4],
        ],
      },
    ],
  };
  const { rerender, unmount } = render(<Chart option={first} label="Loss" />);
  expect(screen.getByRole("img").style.height).toBe("240px");
  rerender(<Chart option={next} label="Loss" />);
  expect(mock.init).toHaveBeenCalledTimes(1);
  expect(mock.setOption).toHaveBeenLastCalledWith(
    expect.objectContaining(next),
    { notMerge: true },
  );
  expect(mock.dispose).not.toHaveBeenCalled();
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(mock.dispose).toHaveBeenCalledOnce();
});

it("resizes only when the container geometry actually changes", () => {
  render(<Chart option={{}} label="Loss" />);
  const container = screen.getByRole("img");
  let width = 400;
  Object.defineProperties(container, {
    clientWidth: { get: () => width },
    clientHeight: { get: () => 240 },
  });
  notifyResize();
  expect(mock.resize).not.toHaveBeenCalled();
  width = 300;
  notifyResize();
  expect(mock.resize).toHaveBeenCalledWith({ width: 300, height: 240 });
  mock.width = 300;
  notifyResize();
  expect(mock.resize).toHaveBeenCalledOnce();
  width = 0;
  notifyResize();
  expect(mock.resize).toHaveBeenCalledOnce();
});

it("uses the latest point handler without recreating the chart", () => {
  const first = vi.fn(),
    next = vi.fn();
  const { rerender } = render(
    <Chart option={{}} label="Data" onPoint={first} />,
  );
  rerender(<Chart option={{}} label="Data" onPoint={next} />);
  const click = mock.on.mock.calls[0][1];
  click({ data: { sampleIndex: 2 } });
  expect(next).toHaveBeenCalledWith(2);
  expect(first).not.toHaveBeenCalled();
  expect(mock.init).toHaveBeenCalledOnce();
});
