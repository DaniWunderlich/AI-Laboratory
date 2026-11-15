import type { Connection, Edge } from "@xyflow/react";
import type { LayerNode } from "./store";

export type PortConnection = Pick<Connection, "source" | "target">;

export function replacementEdges(
  nodes: LayerNode[],
  edges: Edge[],
  connection: PortConnection,
): Edge[] | null {
  const { source, target } = connection;
  const from = nodes.find((node) => node.id === source),
    to = nodes.find((node) => node.id === target);
  if (
    !from ||
    !to ||
    source === target ||
    from.data.kind === "binary_output" ||
    to.data.kind === "input"
  )
    return null;
  const remaining = edges.filter(
    (edge) => edge.source !== source && edge.target !== target,
  );
  const visited = new Set<string>();
  let current: string | undefined = target;
  while (current && !visited.has(current)) {
    if (current === source) return null;
    visited.add(current);
    current = remaining.find((edge) => edge.source === current)?.target;
  }
  if (to.data.kind === "binary_output") {
    if (from.data.kind === "sigmoid") return null;
    const seen = new Set<string>();
    let before: LayerNode | undefined = from;
    while (before && !seen.has(before.id)) {
      seen.add(before.id);
      if (before.data.kind === "input") return null;
      if (before.data.kind === "dense") {
        if (before.data.parameters.units !== 1) return null;
        break;
      }
      const parent = remaining.find(
        (edge) => edge.target === before!.id,
      )?.source;
      before = nodes.find((node) => node.id === parent);
    }
  }
  return remaining;
}

export function proximityConnection(
  nodes: LayerNode[],
  edges: Edge[],
  draggedId: string,
  zoom: number,
): PortConnection | null {
  const dragged = nodes.find((node) => node.id === draggedId);
  if (!dragged) return null;
  let nearest: PortConnection | null = null;
  let closest = 64 / zoom;
  for (const other of nodes) {
    if (other.id === draggedId) continue;
    for (const [source, target] of [
      [dragged, other],
      [other, dragged],
    ]) {
      if (
        edges.some(
          (edge) => edge.source === source.id && edge.target === target.id,
        )
      )
        continue;
      const connection = { source: source.id, target: target.id };
      if (!replacementEdges(nodes, edges, connection)) continue;
      const dx =
        target.position.x -
        (source.position.x + (source.measured?.width ?? 240));
      const dy =
        target.position.y +
        (target.measured?.height ?? 180) / 2 -
        (source.position.y + (source.measured?.height ?? 180) / 2);
      const distance = Math.hypot(dx, dy);
      if (distance < closest) {
        closest = distance;
        nearest = connection;
      }
    }
  }
  return nearest;
}
