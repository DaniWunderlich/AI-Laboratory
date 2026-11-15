import { beforeEach, describe, expect, it } from "vitest";
import { template, toFlow, toModel, useEditor } from "./store";

beforeEach(() => useEditor.getState().load(template()));
describe("model editor", () => {
  it("round trips domain definitions without editor-specific metadata", () => {
    const original = template();
    const flow = toFlow(original);
    expect(toModel(flow.nodes, flow.edges, original.model.name)).toEqual(
      original.model,
    );
    expect(
      Object.keys(toModel(flow.nodes, flow.edges, "Test").nodes[0]),
    ).toEqual(["id", "type", "parameters"]);
  });
  it("adds, edits and removes a layer including its connections", () => {
    const store = useEditor.getState();
    store.add("dense", { x: 2, y: 3 });
    const node = useEditor.getState().nodes.at(-1)!;
    store.update(node.id, "units", 16);
    store.connect({
      source: "layer_4",
      target: node.id,
      sourceHandle: null,
      targetHandle: null,
    });
    expect(useEditor.getState().nodes.at(-1)!.data.parameters.units).toBe(16);
    store.remove(node.id);
    expect(useEditor.getState().nodes).toHaveLength(5);
    expect(useEditor.getState().edges.some((e) => e.target === node.id)).toBe(
      false,
    );
    expect(useEditor.getState().dirty).toBe(true);
  });
  it("keeps tensor metadata out of serialized models", () => {
    const store = useEditor.getState();
    useEditor.setState({
      validation: {
        valid: true,
        errors: [],
        shapes: {},
        parameter_count: 33,
        order: [],
      },
    });
    store.update("layer_1", "units", 4);
    expect(useEditor.getState().validation).toBe(null);
    const model = toModel(
      useEditor.getState().nodes,
      useEditor.getState().edges,
      "Changed",
    );
    expect(model.nodes[1].parameters.units).toBe(4);
  });
});
