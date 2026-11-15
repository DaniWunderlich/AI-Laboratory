import { expect, it } from "vitest";
import { proximityConnection, replacementEdges } from "./connections";
import { template, toFlow, useEditor } from "./store";

it("atomically replaces both occupied ports without leaving duplicate connections", () => {
  const flow = toFlow(template());
  useEditor.getState().load(template());
  useEditor
    .getState()
    .connect({
      source: "layer_0",
      target: "layer_2",
      sourceHandle: null,
      targetHandle: null,
    });
  const edges = useEditor.getState().edges;
  expect(
    edges.some((e) => e.source === "layer_0" && e.target === "layer_2"),
  ).toBe(true);
  expect(
    edges.some((e) => e.source === "layer_0" && e.target === "layer_1"),
  ).toBe(false);
  expect(
    edges.some((e) => e.source === "layer_1" && e.target === "layer_2"),
  ).toBe(false);
  expect(edges).toHaveLength(flow.edges.length - 1);
});

it("rejects cycles even when conflicting edges would be replaced", () => {
  const { nodes, edges } = toFlow(template());
  expect(
    replacementEdges(nodes, edges, { source: "layer_2", target: "layer_1" }),
  ).toBe(null);
  expect(
    replacementEdges(nodes, edges, { source: "layer_4", target: "layer_2" }),
  ).toBe(null);
  expect(
    replacementEdges(nodes, edges, { source: "layer_0", target: "layer_4" }),
  ).toBe(null);
});

it("measures actual port distance and keeps the snap radius constant on screen", () => {
  const { nodes } = toFlow(template());
  const pair = nodes
    .slice(0, 2)
    .map((n, i) => ({
      ...n,
      position: { x: i * 280, y: 0 },
      measured: { width: 240, height: 180 },
    }));
  expect(proximityConnection(pair, [], pair[1].id, 1)).toEqual({
    source: pair[0].id,
    target: pair[1].id,
  });
  expect(proximityConnection(pair, [], pair[1].id, 2)).toBe(null);
  pair[1].position.y = 100;
  expect(proximityConnection(pair, [], pair[1].id, 1)).toBe(null);
});

it("does not suggest an existing edge and ignores incompatible output ports", () => {
  const { nodes, edges } = toFlow(template());
  expect(
    proximityConnection(nodes.slice(0, 2), edges.slice(0, 1), "layer_1", 1),
  ).toBe(null);
  nodes[2].data.kind = "sigmoid";
  expect(
    replacementEdges(nodes, [], { source: nodes[2].id, target: nodes[4].id }),
  ).toBe(null);
});
