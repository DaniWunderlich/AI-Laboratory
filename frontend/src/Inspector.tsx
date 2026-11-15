import { t } from "./i18n";
import { useEffect, useState } from "react";
import { api } from "./api";
import type { Dataset, Inspection, Run } from "./types";
import { labels } from "./store";
import { Field, Term } from "./Help";
import { explanations } from "./learning";
import learningStyles from "./Learning.module.css";
import styles from "./Workbench.module.css";

const number = (value: number) => value.toFixed(5);
export function Inspector({
  run,
  epoch,
  dataset,
}: {
  run: Run;
  epoch: number;
  dataset: Dataset;
}) {
  const [sample, setSample] = useState(0);
  const [nodeId, setNodeId] = useState(
    run.snapshot.model.nodes.find((n) => n.type === "dense")?.id ?? "",
  );
  const [neuron, setNeuron] = useState(0);
  const [weight, setWeight] = useState(0);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("forward");
  const [result, setResult] = useState<Inspection | null>(null);
  const [error, setError] = useState("");
  const [matrixOpen, setMatrixOpen] = useState(
    () =>
      window.matchMedia?.("(min-width: 1100px) and (pointer: fine)").matches ??
      false,
  );
  useEffect(() => {
    let cancelled = false;
    setError("");
    setResult(null);
    api<Inspection>(`/runs/${run.id}/inspect`, {
      epoch,
      point: dataset.points[sample],
      target: dataset.targets[sample],
      type: mode,
      node_id: nodeId,
      neuron,
    })
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e.message));
      });
    return () => {
      cancelled = true;
    };
  }, [run.id, epoch, dataset, sample, nodeId, neuron, mode]);
  const dense = run.snapshot.model.nodes.filter((n) => n.type === "dense");
  const layer = result?.steps.find((s) => s.node_id === nodeId);
  const selectedStep = result?.steps[step];
  return (
    <div className={styles.inspector}>
      <div className={styles.inlineControls}>
        <Field label={t("Ansicht")} topic="forward">
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setStep(
                e.target.value === "backward"
                  ? run.snapshot.model.nodes.length - 1
                  : 0,
              );
            }}
          >
            <option value="forward">Forward Pass</option>
            <option value="backward">Backpropagation</option>
            <option value="neuron">{t("Einzelnes Neuron")}</option>
            <option value="weight_update">{t("SGD-Gewichtsschritt")}</option>
          </select>
        </Field>
        <Field label={t("Datenpunkt")} topic="dataset">
          <select
            value={sample}
            onChange={(e) => setSample(Number(e.target.value))}
          >
            {dataset.points.map((p, i) => (
              <option key={i} value={i}>
                {i + 1}: [{p.map((v) => v.toFixed(2)).join(", ")}] →{" "}
                {dataset.targets[i]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dense Layer" topic="dense">
          <select
            value={nodeId}
            onChange={(e) => {
              setNodeId(e.target.value);
              setNeuron(0);
              setWeight(0);
            }}
          >
            {dense.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id} · {n.parameters.units} {t("Neuronen")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Neuron" topic="neurons">
          <select
            value={neuron}
            onChange={(e) => setNeuron(Number(e.target.value))}
          >
            {Array.from(
              {
                length:
                  dense.find((n) => n.id === nodeId)?.parameters.units ?? 1,
              },
              (_, i) => (
                <option value={i} key={i}>
                  {i}
                </option>
              ),
            )}
          </select>
        </Field>
      </div>
      <details
        className={`${learningStyles.explanation} ${styles.inspectorHelp}`}
      >
        <summary>
          <Term
            topic={
              mode === "forward"
                ? "forward"
                : mode === "backward"
                  ? "gradient"
                  : mode === "neuron"
                    ? "weights"
                    : "sgd"
            }
          >
            {mode === "forward"
              ? t("Vom Datenpunkt zur Vorhersage")
              : mode === "backward"
                ? t("Welches Gewicht beeinflusst den Fehler?")
                : mode === "neuron"
                  ? t("Eine Recheneinheit genau ansehen")
                  : t("Eine Korrektur ausprobieren")}
          </Term>
        </summary>
        <p>
          {mode === "forward"
            ? t(
                "Beginne links bei Input und gehe Schritt für Schritt weiter. Die Eingaben eines Bausteins sind die Ausgaben seines Vorgängers. Am Ende kannst du die Vorhersage mit der richtigen Klasse vergleichen.",
              )
            : mode === "backward"
              ? t(
                  "Wir starten am Ausgang. Für jeden Baustein wird rückwärts berechnet, wie kleine Änderungen den Fehler beeinflussen. Das nennt man Backpropagation. Ein Gradient ist eine lokale Änderungsrichtung, keine Fehlerquote.",
                )
              : mode === "neuron"
                ? t(
                    "Jede Eingabe wird mit einem Gewicht multipliziert. Die Produkte werden addiert, dann kommt der Bias dazu. Darunter siehst du genau diese Rechnung für das gewählte Neuron.",
                  )
                : t(
                    "Wähle ein Gewicht. Wir ziehen Lernrate mal Gradient ab. Dies ist eine separate Demonstration auf einer Kopie für diesen einen Datenpunkt; dein gespeichertes Netz wird dabei nicht verändert.",
                  )}
        </p>
      </details>
      <p className={styles.annotation}>
        {t("Aus gespeichertem Checkpoint · Epoche ")}
        {epoch} {t("· ein Datenpunkt. Alle Werte werden neu berechnet.")}
      </p>
      {error && <p role="alert">{error}</p>}
      {!result && !error && <p>{t("Berechnung wird geladen …")}</p>}
      {result && (
        <>
          <div className={styles.readouts}>
            <span>
              <Term topic="probability">{t("P(Klasse 1)")}</Term>{" "}
              <strong>{number(result.probability)}</strong>
            </span>
            <span>
              {t("Erwartete Klasse ")}
              <strong>{dataset.targets[sample]}</strong>
            </span>
            <span>
              <Term topic="loss">Sample Loss</Term>{" "}
              <strong>{number(result.loss)}</strong>
            </span>
          </div>
          {mode === "forward" || mode === "backward" ? (
            <div className={styles.inspectionColumns}>
              <div className={styles.stepList}>
                {(mode === "backward"
                  ? [...result.steps].reverse()
                  : result.steps
                ).map((s) => {
                  const i = result.steps.indexOf(s);
                  return (
                    <button
                      key={s.node_id}
                      className={step === i ? styles.selectedStep : ""}
                      onClick={() => setStep(i)}
                    >
                      <span>
                        {mode === "backward" ? "←" : "→"}{" "}
                        {
                          labels[
                            run.snapshot.model.nodes.find(
                              (n) => n.id === s.node_id,
                            )!.type
                          ]
                        }
                      </span>
                      <small>{s.node_id}</small>
                    </button>
                  );
                })}
              </div>
              <div className={styles.calculation}>
                <h3>{selectedStep?.node_id}</h3>
                {selectedStep && (
                  <p>
                    {
                      explanations[
                        run.snapshot.model.nodes.find(
                          (node) => node.id === selectedStep.node_id,
                        )!.type
                      ].short
                    }
                  </p>
                )}
                <code
                  title={
                    mode === "backward"
                      ? t(
                          "Gradient des Loss nach dem Ausgang dieses Bausteins (Autograd).",
                        )
                      : t("Tensor vor und nach dieser Operation.")
                  }
                >
                  {mode === "backward"
                    ? `∂L/∂a = [${selectedStep?.output_gradient.map(number).join(", ")}]`
                    : `Input  [${selectedStep?.input.map(number).join(", ")}]\nOutput [${selectedStep?.output.map(number).join(", ")}]`}
                </code>
                <button
                  onClick={() =>
                    setStep((v) =>
                      mode === "backward"
                        ? Math.max(0, v - 1)
                        : Math.min(result.steps.length - 1, v + 1),
                    )
                  }
                >
                  {mode === "backward"
                    ? t("Vorheriger Baustein ←")
                    : t("Nächster Baustein →")}
                </button>
              </div>
            </div>
          ) : mode === "neuron" ? (
            <div className={styles.calculation}>
              <h3>z{neuron} = Σ xᵢwᵢ + b</h3>
              <code>
                {result.neuron?.products.map(number).join(" + ")} + (
                {number(result.neuron?.bias ?? 0)}) ={" "}
                {number(result.neuron?.linear_output ?? 0)}
              </code>
              <p>
                {t(
                  "Dies ist die lineare Ausgabe des Dense Layers. Eine folgende Aktivierung ist ein eigener Schritt im Forward Pass.",
                )}
              </p>
            </div>
          ) : (
            <div className={styles.calculation}>
              <Field label={t("Eingangsgewicht")} topic="weights">
                <select
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                >
                  {layer?.input.map((_, i) => (
                    <option value={i} key={i}>
                      w[{neuron}, {i}]
                    </option>
                  ))}
                </select>
              </Field>
              <h3>w′ = w − η · ∂L/∂w</h3>
              <code>
                {number(layer?.weights?.[neuron]?.[weight] ?? 0)} −{" "}
                {result.learning_rate} × (
                {number(layer?.weight_gradient?.[neuron]?.[weight] ?? 0)}) ={" "}
                {number(layer?.hypothetical_weights?.[neuron]?.[weight] ?? 0)}
              </code>
              <p>
                {t(
                  "Hypothetischer SGD-Schritt für diesen einzelnen Datenpunkt. Der gespeicherte Checkpoint und der ursprüngliche Run bleiben unverändert.",
                )}
              </p>
            </div>
          )}
          <details
            className={styles.matrix}
            open={matrixOpen}
            onToggle={(event) => setMatrixOpen(event.currentTarget.open)}
          >
            <summary>
              {t("Gewichte, Bias und Gradienten · ")}
              {nodeId}
            </summary>
            <p>
              {t(
                "Jede Zeile gehört zu einem Neuron. w0, w1 usw. sind die Gewichte seiner Eingaben, Bias ist der zusätzliche Summand. Die kleineren Zahlen mit ∂ darunter sind die Gradienten für diesen Datenpunkt.",
              )}
            </p>
            <Term topic="weights">{t("Gewichte und Bias verstehen")}</Term>{" "}
            <Term topic="gradient">{t("Gradienten verstehen")}</Term>
            <div className={styles.tableScroll}>
              <table>
                <thead>
                  <tr>
                    <th>Neuron</th>
                    {layer?.input.map((_, i) => (
                      <th key={i}>w{i}</th>
                    ))}
                    <th>Bias</th>
                    <th>∂L/∂b</th>
                  </tr>
                </thead>
                <tbody>
                  {layer?.weights?.map((row, i) => (
                    <tr key={i}>
                      <th>{i}</th>
                      {row.map((value, j) => (
                        <td
                          key={j}
                          title={`Gradient: ${number(layer.weight_gradient![i][j])}`}
                        >
                          {number(value)}
                          <small>
                            ∂ {number(layer.weight_gradient![i][j])}
                          </small>
                        </td>
                      ))}
                      <td>{number(layer.bias![i])}</td>
                      <td>{number(layer.bias_gradient![i])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
