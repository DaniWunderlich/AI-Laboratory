import { t } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { Field, Term } from "./Help";
import { ActivationPlot } from "./ActivationPlot";
import { explanations } from "./learning";
import { labels, useEditor } from "./store";
import styles from "./Node.module.css";

function DialogBody({ id }: { id: string }) {
  const editor = useEditor();
  const node = editor.nodes.find((n) => n.id === id);
  const dialog = useRef<HTMLDialogElement>(null);
  const [units, setUnits] = useState(node?.data.parameters.units ?? 8);
  const [activation, setActivation] = useState(node?.data.kind ?? "tanh");
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  if (!node) return null;
  const kind = node.data.kind;
  const displayedKind = ["relu", "tanh", "sigmoid"].includes(kind)
    ? activation
    : kind;
  const shape = editor.validation?.shapes[id];
  const configurable =
    kind === "dense" || ["relu", "tanh", "sigmoid"].includes(kind);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="node-dialog-title"
      onCancel={() => editor.configure(null)}
      onClose={() => editor.configure(null)}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (kind === "dense") editor.update(id, "units", units);
          else if (
            activation === "relu" ||
            activation === "tanh" ||
            activation === "sigmoid"
          )
            editor.activation(id, activation);
          editor.configure(null);
        }}
      >
        <div className={styles.dialogHeader}>
          <h2 id="node-dialog-title">
            {labels[displayedKind]} {t("konfigurieren")}
          </h2>
          <button
            type="button"
            aria-label={t("Baustein-Dialog schließen")}
            onClick={() => editor.configure(null)}
          >
            ×
          </button>
        </div>
        <p>{explanations[displayedKind].detail}</p>
        {kind === "dense" && (
          <Field label={t("Neuronen")} topic="neurons">
            <input
              autoFocus
              type="number"
              required
              min={1}
              max={64}
              value={units}
              onChange={(event) => setUnits(Number(event.target.value))}
            />
          </Field>
        )}
        {["relu", "tanh", "sigmoid"].includes(kind) && (
          <>
            <Field label={t("Aktivierungsfunktion")} topic={displayedKind}>
              <select
                value={activation}
                onChange={(event) =>
                  setActivation(event.target.value as typeof activation)
                }
              >
                <option value="relu">ReLU</option>
                <option value="tanh">Tanh</option>
                <option value="sigmoid">Sigmoid</option>
              </select>
            </Field>
            <ActivationPlot kind={activation} />
          </>
        )}
        {kind === "input" && (
          <p>
            {t(
              "Die vorhandenen Datensätze liefern zwei Eingabewerte pro Punkt. Diese Anzahl bleibt hier fest.",
            )}
          </p>
        )}
        {kind === "binary_output" && (
          <p>
            {t(
              "Der Output erwartet einen Logit. Ab einer vorhergesagten Wahrscheinlichkeit von 0,5 wird Klasse 1 gewählt.",
            )}
          </p>
        )}
        {shape && (
          <details>
            <summary>{t("Tensorformen und technische Details")}</summary>
            <Term topic="shape">{t("Tensorform")}</Term>
            <dl>
              <dt>{t("Eingang")}</dt>
              <dd>[{shape.input.join(", ")}]</dd>
              <dt>{t("Ausgang")}</dt>
              <dd>[{shape.output.join(", ")}]</dd>
            </dl>
            <code>{id}</code>
          </details>
        )}
        <div className={styles.dialogActions}>
          <button type="button" onClick={() => editor.configure(null)}>
            {t("Abbrechen")}
          </button>
          {configurable && (
            <button
              type="submit"
              disabled={
                kind === "dense" &&
                (!Number.isInteger(units) || units < 1 || units > 64)
              }
            >
              {t("Übernehmen")}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}

export function NodeDialog() {
  const editing = useEditor((state) => state.editing);
  return editing ? <DialogBody key={editing} id={editing} /> : null;
}
