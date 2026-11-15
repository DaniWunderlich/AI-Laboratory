import { t } from "./i18n";
import { create } from "zustand";
import { replacementEdges } from "./connections";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type {
  Experiment,
  Model,
  ModelNode,
  NodeKind,
  Validation,
} from "./types";

export type LayerNode = Node<
  { kind: NodeKind; parameters: Record<string, number> },
  "layer"
>;
export const labels: Record<NodeKind, string> = {
  input: "Input",
  dense: "Dense",
  relu: "ReLU",
  tanh: "Tanh",
  sigmoid: "Sigmoid",
  binary_output: "Binary Output",
};

export function template(linear = false): Experiment {
  const kinds: NodeKind[] = linear
    ? ["input", "dense", "binary_output"]
    : ["input", "dense", "tanh", "dense", "binary_output"];
  const nodes = kinds.map((type, i): ModelNode => ({
    id: `layer_${i}`,
    type,
    parameters:
      type === "input"
        ? { features: 2 }
        : type === "dense"
          ? { units: i === 1 && !linear ? 8 : 1 }
          : {},
  }));
  return {
    name: linear ? t("XOR · Lineares Netz") : t("XOR · Mein erstes Netz"),
    description: "",
    model: {
      schema_version: 1,
      name: "XOR Network",
      nodes,
      edges: nodes
        .slice(1)
        .map((n, i) => ({ source: nodes[i].id, target: n.id })),
    },
    layout: Object.fromEntries(
      nodes.map((n, i) => [n.id, { x: i * 290, y: 100 }]),
    ),
    dataset: {
      type: "xor",
      samples: 200,
      noise: 0.1,
      seed: 42,
      test_size: 0.2,
    },
    training: {
      optimizer: "sgd",
      learning_rate: 0.5,
      epochs: 300,
      batch_size: 32,
      seed: 42,
      checkpoint_interval: 15,
    },
  };
}

export function toFlow(experiment: Experiment): {
  nodes: LayerNode[];
  edges: Edge[];
} {
  return {
    nodes: experiment.model.nodes.map((node, i) => ({
      id: node.id,
      type: "layer",
      position: experiment.layout[node.id] ?? { x: i * 290, y: 100 },
      data: { kind: node.type, parameters: node.parameters },
    })),
    edges: experiment.model.edges.map((edge, i) => ({
      ...edge,
      id: `edge_${i}`,
      type: "smoothstep",
    })),
  };
}

export function toModel(
  nodes: LayerNode[],
  edges: Edge[],
  name: string,
): Model {
  return {
    schema_version: 1,
    name,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.data.kind,
      parameters: n.data.parameters,
    })),
    edges: edges.map(({ source, target }) => ({ source, target })),
  };
}

type EditorStore = {
  nodes: LayerNode[];
  edges: Edge[];
  selected: string | null;
  editing: string | null;
  validation: Validation | null;
  dirty: boolean;
  revision: number;
  load: (experiment: Experiment) => void;
  onNodesChange: (changes: NodeChange<LayerNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  connect: (connection: Connection) => void;
  add: (kind: NodeKind, position?: { x: number; y: number }) => void;
  update: (id: string, parameter: string, value: number) => void;
  remove: (id: string) => void;
  select: (id: string | null) => void;
  configure: (id: string | null) => void;
  activation: (id: string, kind: "relu" | "tanh" | "sigmoid") => void;
};
const initial = toFlow(template());
export const useEditor = create<EditorStore>((set) => ({
  ...initial,
  selected: "layer_1",
  editing: null,
  validation: null,
  dirty: false,
  revision: 0,
  load: (experiment) =>
    set((state) => ({
      ...toFlow(experiment),
      selected: null,
      editing: null,
      validation: null,
      dirty: false,
      revision: state.revision + 1,
    })),
  onNodesChange: (changes) =>
    set((state) => {
      const changed = changes.some(
        (c) => c.type !== "select" && c.type !== "dimensions",
      );
      return {
        nodes: applyNodeChanges(changes, state.nodes),
        dirty: changed || state.dirty,
        validation: changed ? null : state.validation,
        revision: state.revision + (changed ? 1 : 0),
      };
    }),
  onEdgesChange: (changes) =>
    set((state) => {
      const changed = changes.some((change) => change.type !== "select");
      return {
        edges: applyEdgeChanges(changes, state.edges),
        dirty: changed || state.dirty,
        validation: changed ? null : state.validation,
        revision: state.revision + (changed ? 1 : 0),
      };
    }),
  connect: (connection) =>
    set((state) => {
      const remaining = replacementEdges(state.nodes, state.edges, connection);
      if (!remaining) return {};
      return {
        edges: addEdge({ ...connection, type: "smoothstep" }, remaining),
        dirty: true,
        validation: null,
        revision: state.revision + 1,
      };
    }),
  add: (kind, position) =>
    set((state) => {
      const id = `node_${crypto.randomUUID()}`;
      const parameters: Record<string, number> =
        kind === "input"
          ? { features: 2 }
          : kind === "dense"
            ? { units: 8 }
            : {};
      return {
        nodes: [
          ...state.nodes,
          {
            id,
            type: "layer",
            position: position ?? { x: 140, y: 280 },
            data: { kind, parameters },
          },
        ],
        selected: id,
        dirty: true,
        validation: null,
        revision: state.revision + 1,
      };
    }),
  update: (id, parameter, value) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                parameters: { ...n.data.parameters, [parameter]: value },
              },
            }
          : n,
      ),
      dirty: true,
      validation: null,
      revision: state.revision + 1,
    })),
  remove: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selected: null,
      editing: state.editing === id ? null : state.editing,
      dirty: true,
      validation: null,
      revision: state.revision + 1,
    })),
  select: (selected) => set({ selected }),
  configure: (editing) =>
    set((state) => ({ editing, selected: editing ?? state.selected })),
  activation: (id, kind) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id && ["relu", "tanh", "sigmoid"].includes(node.data.kind)
          ? { ...node, data: { ...node.data, kind } }
          : node,
      ),
      validation: null,
      dirty: true,
      revision: state.revision + 1,
    })),
}));
