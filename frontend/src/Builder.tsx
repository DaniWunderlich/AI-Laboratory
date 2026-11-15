import { t } from "./i18n";
import { useEffect, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import { labels, useEditor, type LayerNode } from "./store";
import type { NodeKind } from "./types";
import { explanations } from "./learning";
import {
  proximityConnection,
  replacementEdges,
  type PortConnection,
} from "./connections";
import { ActivationPlot } from "./ActivationPlot";
import { ConfigIcon, TrashIcon } from "./Icons";
import { NodeDialog } from "./NodeDialog";
import { usePreferences } from "./preferences";
import styles from "./Workbench.module.css";
import nodeStyles from "./Node.module.css";

function Layer({ id, data, selected }: NodeProps<LayerNode>) {
  usePreferences();
  const shape = useEditor((state) => state.validation?.shapes[id]);
  const invalid = useEditor((state) =>
    state.validation?.errors.some((error) => error.node_id === id),
  );
  const configure = useEditor((state) => state.configure),
    remove = useEditor((state) => state.remove);
  return (
    <div
      className={`${styles.layer} ${selected ? styles.layerSelected : ""} ${invalid ? styles.layerInvalid : ""}`}
    >
      {data.kind !== "input" && (
        <Handle type="target" position={Position.Left} />
      )}
      <div className={nodeStyles.heading}>
        <strong>
          {labels[data.kind]}
          {data.kind === "dense" ? ` (${data.parameters.units})` : ""}
        </strong>
        <div className={`${nodeStyles.actions} nodrag nopan`}>
          <button
            type="button"
            aria-label={t`${labels[data.kind]} konfigurieren`}
            title={t("Einstellungen und Erklärung")}
            onClick={(event) => {
              event.stopPropagation();
              configure(id);
            }}
          >
            <ConfigIcon />
          </button>
          <button
            type="button"
            aria-label={t`${labels[data.kind]} löschen`}
            title={t("Baustein löschen")}
            onClick={(event) => {
              event.stopPropagation();
              remove(id);
            }}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
      <p className={nodeStyles.description}>{explanations[data.kind].short}</p>
      <ActivationPlot kind={data.kind} />
      <small>
        {shape
          ? `[${shape.input.join(", ")}] → [${shape.output.join(", ")}]`
          : data.kind === "input"
            ? t("2 Eingabewerte pro Punkt")
            : data.kind === "dense"
              ? t("Ausgabe = gewichtete Summe + Bias")
              : data.kind === "binary_output"
                ? t("Klasse 1 ab Wahrscheinlichkeit 0,5")
                : t("Eingang x → Ausgang y")}
      </small>
      {data.kind !== "binary_output" && (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}
const nodeTypes = { layer: Layer };

function Canvas({ templateKey }: { templateKey: number }) {
  const editor = useEditor();
  const flow = useReactFlow<LayerNode>();
  const wrapper = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<PortConnection | null>(null);
  const [fittedKey, setFittedKey] = useState(-1);
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      void flow
        .fitView({
          padding: 0.14,
          minZoom: 0.75,
        })
        .then(() => {
          if (!cancelled) setFittedKey(templateKey);
        });
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [templateKey, flow]);
  useEffect(() => {
    const container = wrapper.current!;
    let size = { width: container.clientWidth, height: container.clientHeight };
    const observer = new ResizeObserver(() => {
      const width = container.clientWidth,
        height = container.clientHeight;
      if (
        size.width > 0 &&
        size.height > 0 &&
        width > 0 &&
        height > 0 &&
        (width !== size.width || height !== size.height)
      ) {
        const viewport = flow.getViewport();
        void flow.setViewport({
          ...viewport,
          x: viewport.x + (width - size.width) / 2,
          y: viewport.y + (height - size.height) / 2,
        });
      }
      size = { width, height };
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [flow]);
  function candidate(node: LayerNode) {
    const state = useEditor.getState();
    return proximityConnection(
      state.nodes.map((item) => (item.id === node.id ? node : item)),
      state.edges,
      node.id,
      flow.getZoom(),
    );
  }
  const edges: Edge[] = preview
    ? [
        ...editor.edges,
        {
          ...preview,
          id: "proximity-preview",
          type: "smoothstep",
          selectable: false,
          deletable: false,
          focusable: false,
          style: {
            strokeDasharray: "6 4",
            strokeWidth: 3,
            stroke: "var(--accent)",
          },
        },
      ]
    : editor.edges;
  return (
    <div
      ref={wrapper}
      className={styles.canvas}
      data-layout-ready={fittedKey === templateKey}
      onPointerCancel={() => setPreview(null)}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") setPreview(null);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const kind = event.dataTransfer.getData(
          "application/lab-node",
        ) as NodeKind;
        if (kind in labels)
          editor.add(
            kind,
            flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          );
      }}
    >
      <div className={styles.canvasCaption}>{t("NETZWERK")}</div>
      <ReactFlow<LayerNode>
        nodes={editor.nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={editor.onNodesChange}
        onEdgesChange={(changes) =>
          editor.onEdgesChange(
            changes.filter(
              (change) =>
                !("id" in change) || change.id !== "proximity-preview",
            ),
          )
        }
        onConnect={editor.connect}
        onNodeClick={(_, node) => editor.select(node.id)}
        onPaneClick={() => editor.select(null)}
        onNodeDragStart={() => setPreview(null)}
        onNodeDrag={(_, node) => setPreview(candidate(node))}
        onNodeDragStop={(_, node) => {
          const connection = candidate(node);
          if (connection)
            editor.connect({
              ...connection,
              sourceHandle: null,
              targetHandle: null,
            });
          setPreview(null);
        }}
        isValidConnection={(connection) =>
          replacementEdges(editor.nodes, editor.edges, connection) !== null
        }
        fitView
        minZoom={0.25}
        maxZoom={1.6}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background gap={22} size={1} color="var(--line)" />
        <Controls showInteractive={false} />
      </ReactFlow>
      <p className={styles.canvasHint}>
        {preview
          ? t("Loslassen zum Verbinden · Belegte Ports werden neu verbunden")
          : t("Bausteine an den Ports annähern oder Ports direkt verbinden")}
      </p>
      <NodeDialog />
    </div>
  );
}

export function Builder({ templateKey }: { templateKey: number }) {
  return (
    <ReactFlowProvider>
      <Canvas templateKey={templateKey} />
    </ReactFlowProvider>
  );
}
