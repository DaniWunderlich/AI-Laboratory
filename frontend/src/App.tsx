import { t } from "./i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { TrashIcon } from "./Icons";
import { Builder } from "./Builder";
import { TrainingFeedback } from "./TrainingFeedback";
import { TrainingCharts } from "./TrainingCharts";
import { bounds, Chart, dataOption, metricOption } from "./Chart";
import { Inspector } from "./Inspector";
import { TrainingFields } from "./TrainingFields";
import { Field, Term } from "./Help";
import { LearningGuide, type LearningStep } from "./LearningGuide";
import { Appearance } from "./Appearance";
import { usePreferences, locale } from "./preferences";
import { explanations } from "./learning";
import { validationHelp } from "./validationHelp";
import { labels, template, toModel, useEditor } from "./store";
import { useRun } from "./useRun";
import {
  terminal,
  type Dataset,
  type Experiment,
  type Metric,
  type NodeKind,
  type Run,
  type SavedExperiment,
  type Validation,
  type TrainingLimits,
} from "./types";
import styles from "./Workbench.module.css";

type Tab = "data" | "training" | "inspector" | "compare";
const tabs: { id: Tab; label: string }[] = [
  { id: "data", label: "Datensatz" },
  { id: "training", label: "Training" },
  { id: "inspector", label: "Inspector" },
  { id: "compare", label: "Vergleich" },
];
const statusLabels: Record<string, string> = {
  VALIDATING: "Wird vorbereitet",
  RUNNING: "Training läuft",
  COMPLETED: "Abgeschlossen",
  CANCELLED: "Abgebrochen",
  FAILED: "Fehlgeschlagen",
};

export function App() {
  const { language, theme } = usePreferences();
  const editor = useEditor();
  const [config, setConfig] = useState<Experiment>(() => template());
  const currentConfig = useRef(config);
  currentConfig.current = config;
  const [experimentId, setExperimentId] = useState<string | null>(null);
  const [experiments, setExperiments] = useState<SavedExperiment[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("data");
  const [templateKey, setTemplateKey] = useState(0);
  const [configDirty, setConfigDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [healthy, setHealthy] = useState(false);
  const [preview, setPreview] = useState<Dataset | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [runData, setRunData] = useState<Dataset | null>(null);
  const [epoch, setEpoch] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);
  const [boundary, setBoundary] = useState<number[][] | undefined>();
  const [compareId, setCompareId] = useState("");
  const [compareMetrics, setCompareMetrics] = useState<Metric[]>([]);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [limits, setLimits] = useState<TrainingLimits>({
    max_epochs: 10000,
    max_checkpoints: 200,
  });
  const [previousMetrics, setPreviousMetrics] = useState<Metric[]>([]);
  const workspace = useRef<HTMLElement>(null);
  const canvasArea = useRef<HTMLDivElement>(null);
  const { run, metrics, checkpoints, error: liveError } = useRun(runId);
  const active = Boolean(run && !terminal(run.status));
  const selectedEpoch = follow ? checkpoints.at(-1)?.epoch : epoch;
  const checkpointMetric = metrics.find(
    (metric) => metric.epoch === selectedEpoch,
  );
  const dirty = editor.dirty || configDirty;
  const previousRun = runs.find(
    (item) =>
      item.id !== run?.id &&
      item.status === "COMPLETED" &&
      item.started_at < (run?.started_at ?? ""),
  );

  useEffect(() => {
    let cancelled = false;
    setPreviousMetrics([]);
    if (previousRun)
      api<Metric[]>(`/runs/${previousRun.id}/metrics`)
        .then((values) => {
          if (!cancelled) setPreviousMetrics(values);
        })
        .catch((error) => {
          if (!cancelled) setError(error.message);
        });
    return () => {
      cancelled = true;
    };
  }, [previousRun?.id]);

  const refreshExperiments = useCallback(
    async () => setExperiments(await api<SavedExperiment[]>("/experiments")),
    [],
  );
  useEffect(() => {
    let disposed = false;
    const check = () =>
      api("/healthz/ready")
        .then(() => {
          if (!disposed) setHealthy(true);
        })
        .catch(() => {
          if (!disposed) setHealthy(false);
        });
    void check();
    void api<TrainingLimits>("/capabilities")
      .then(setLimits)
      .catch((error) => setError(error.message));
    void refreshExperiments().catch((e) => setError(e.message));
    const timer = setInterval(check, 15000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [refreshExperiments]);
  useEffect(() => {
    if (!experimentId) {
      setRuns([]);
      return;
    }
    let disposed = false;
    api<Run[]>(`/experiments/${experimentId}/runs`)
      .then((data) => {
        if (!disposed) setRuns(data);
      })
      .catch((e) => setError(e.message));
    return () => {
      disposed = true;
    };
  }, [experimentId, runId, run?.status]);
  useEffect(() => {
    let disposed = false;
    const timer = setTimeout(() => {
      const state = useEditor.getState();
      api<Validation>(
        "/models/validate",
        toModel(state.nodes, state.edges, config.name),
      )
        .then((report) => {
          if (!disposed) useEditor.setState({ validation: report });
        })
        .catch((e) => {
          if (!disposed) setError(e.message);
        });
    }, 250);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [editor.revision, config.name]);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    setPreview(null);
    setPreviewError("");
    const maxPoints = limits.max_points ?? 10000;
    if (
      config.dataset.type !== "xor" &&
      (!Number.isInteger(config.dataset.samples) ||
        config.dataset.samples < 20 ||
        config.dataset.samples > maxPoints)
    ) {
      setPreviewError(t`Bitte 20 bis ${maxPoints} Datenpunkte eingeben.`);
      return;
    }
    const timer = setTimeout(() => {
      api<Dataset>(
        "/datasets/generate",
        config.dataset,
        undefined,
        controller.signal,
      )
        .then((data) => {
          if (!disposed) setPreview(data);
        })
        .catch((e) => {
          if (!disposed)
            setPreviewError(
              controller.signal.aborted
                ? t(
                    "Die Datensatzerzeugung hat zu lange gedauert. Bitte erneut versuchen.",
                  )
                : e.message,
            );
        });
    }, 300);
    const timeout = setTimeout(() => controller.abort(), 15000);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [config.dataset, limits.max_points, language]);
  useEffect(() => {
    let disposed = false;
    setRunData(null);
    if (run)
      api<Dataset>("/datasets/generate", run.snapshot.dataset)
        .then((data) => {
          if (!disposed) setRunData(data);
        })
        .catch((e) => {
          if (!disposed) setError(e.message);
        });
    return () => {
      disposed = true;
    };
  }, [run?.id]);
  useEffect(() => {
    let disposed = false;
    setBoundary(undefined);
    if (
      run &&
      runData &&
      selectedEpoch !== undefined &&
      selectedEpoch !== null
    ) {
      const [xmin, xmax, ymin, ymax] = bounds(runData);
      const points = Array.from({ length: 1600 }, (_, i) => [
        xmin + ((i % 40) / 39) * (xmax - xmin),
        ymin + (Math.floor(i / 40) / 39) * (ymax - ymin),
      ]);
      api<{ probabilities: number[] }>(`/runs/${run.id}/predict`, {
        epoch: selectedEpoch,
        points,
      })
        .then((data) => {
          if (!disposed)
            setBoundary(
              points.map((point, i) => [...point, data.probabilities[i]]),
            );
        })
        .catch((e) => {
          if (!disposed) setError(e.message);
        });
    }
    return () => {
      disposed = true;
    };
  }, [run?.id, runData, selectedEpoch]);
  useEffect(() => {
    let disposed = false;
    setCompareMetrics([]);
    if (compareId)
      api<Metric[]>(`/runs/${compareId}/metrics`)
        .then((data) => {
          if (!disposed) setCompareMetrics(data);
        })
        .catch((e) => {
          if (!disposed) setError(e.message);
        });
    return () => {
      disposed = true;
    };
  }, [compareId]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function definition(): Experiment {
    const state = useEditor.getState();
    return {
      ...currentConfig.current,
      model: toModel(state.nodes, state.edges, currentConfig.current.name),
      layout: Object.fromEntries(state.nodes.map((n) => [n.id, n.position])),
    };
  }
  function editConfig(next: Experiment) {
    setConfig(next);
    setConfigDirty(true);
    setNotice("");
  }
  function clearRun() {
    setRunId(null);
    setCompareId("");
    setEpoch(null);
    setFollow(true);
  }
  function load(saved: SavedExperiment) {
    if (
      dirty &&
      !window.confirm(
        t("Ungespeicherte Änderungen verwerfen und Experiment öffnen?"),
      )
    )
      return;
    setConfig(saved.definition);
    editor.load(saved.definition);
    setExperimentId(saved.id);
    clearRun();
    setTemplateKey((v) => v + 1);
    setConfigDirty(false);
    setNotice("Experiment geladen.");
    setError("");
  }
  function newTemplate(linear = false) {
    if (
      dirty &&
      !window.confirm(
        t("Ungespeicherte Änderungen verwerfen und Vorlage öffnen?"),
      )
    )
      return;
    const next = template(linear);
    setConfig(next);
    editor.load(next);
    setExperimentId(null);
    clearRun();
    setConfigDirty(false);
    setTemplateKey((v) => v + 1);
    setNotice("Neue lokale Versuchsanordnung.");
    setError("");
  }
  async function perform(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const snapshot = definition();
    const saved = await api<SavedExperiment>(
      experimentId ? `/experiments/${experimentId}` : "/experiments",
      snapshot,
      experimentId ? "PUT" : "POST",
    );
    setExperimentId(saved.id);
    if (JSON.stringify(definition()) === JSON.stringify(snapshot)) {
      useEditor.setState({ dirty: false });
      setConfigDirty(false);
    }
    await refreshExperiments();
    setNotice("Experiment lokal gespeichert.");
    return saved;
  }
  async function train() {
    const saved = await save();
    const started = await api<Run>(`/experiments/${saved.id}/runs`, {});
    setRunId(started.id);
    setEpoch(null);
    setFollow(true);
    setTab("training");
    setWorkspaceOpen(true);
    setNotice("Training gestartet.");
  }
  function deleteExperiment(id: string, name: string) {
    if (
      !window.confirm(
        t`Experiment „${name}“ und zugehörige Run-Einträge lokal löschen?`,
      )
    )
      return;
    void perform(async () => {
      await api(`/experiments/${id}`, undefined, "DELETE");
      await refreshExperiments();
      if (id === experimentId) {
        setConfigDirty(false);
        useEditor.setState({ dirty: false });
        setExperimentId(null);
        clearRun();
      }
      setNotice(
        id === experimentId
          ? "Experiment gelöscht; die aktuelle Architektur bleibt als Entwurf geöffnet."
          : "Experiment gelöscht.",
      );
    });
  }
  function navigateLesson(step: LearningStep, reveal = false) {
    if (step === "model") {
      editor.select(
        editor.nodes.find((node) => node.data.kind === "dense")?.id ?? null,
      );
      if (reveal)
        editor.configure(
          editor.nodes.find((node) => node.data.kind === "dense")?.id ?? null,
        );
      if (
        reveal &&
        !window.matchMedia("(min-width: 1100px) and (pointer: fine)").matches
      )
        canvasArea.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      return;
    }
    setTab(
      step === "data"
        ? "data"
        : step === "inspect"
          ? "inspector"
          : step === "compare"
            ? "compare"
            : "training",
    );
    setWorkspaceOpen(true);
    if (
      reveal &&
      !window.matchMedia("(min-width: 1100px) and (pointer: fine)").matches
    )
      requestAnimationFrame(() =>
        workspace.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
  }
  const lossOption = useMemo(() => metricOption(metrics), [metrics, language]);
  const accuracyOption = useMemo(
    () => metricOption(metrics, undefined, true),
    [metrics, language],
  );
  const previewOption = useMemo(
    () => (preview ? dataOption(preview) : null),
    [preview, language, theme],
  );
  const runOption = useMemo(
    () => (runData ? dataOption(runData, boundary) : null),
    [runData, boundary, language, theme],
  );
  const comparisonOption = useMemo(
    () => metricOption(metrics, compareMetrics),
    [metrics, compareMetrics, language],
  );
  const latest = metrics.at(-1);
  const compared = runs.find((r) => r.id === compareId);

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <a
          className={styles.brand}
          href="/"
          aria-label={t("AI Laboratory Startseite")}
        >
          <span className={styles.logo}>
            A<span>I</span>
          </span>
          <span>
            AI Laboratory<small>{t("Neuronale Netze untersuchen")}</small>
          </span>
        </a>
        <div className={styles.headerRight}>
          <Appearance />
          <span className={healthy ? styles.online : styles.offline}>
            <i />
            {healthy ? t("Backend verbunden") : t("Backend nicht erreichbar")}
          </span>
          <span className={styles.localBadge}>LOCAL / CPU</span>
        </div>
      </header>
      <div className={styles.experimentBar}>
        <div>
          <span className={styles.eyebrow}>
            {t("EXPERIMENT · BINÄRE KLASSIFIKATION")}
          </span>
          <div className={styles.nameRow}>
            <input
              aria-label={t("Experimentname")}
              maxLength={120}
              value={config.name}
              onChange={(e) => editConfig({ ...config, name: e.target.value })}
            />
            <span className={styles.draft}>
              {dirty
                ? t("Ungespeichert")
                : experimentId
                  ? t("Gespeichert")
                  : t("Entwurf")}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            disabled={busy || !config.name.trim()}
            onClick={() =>
              void perform(async () => {
                await save();
              })
            }
          >
            {t("Speichern")}
          </button>
          <button
            className={styles.primary}
            disabled={
              busy ||
              active ||
              !healthy ||
              !editor.validation?.valid ||
              !config.name.trim()
            }
            onClick={() => void perform(train)}
          >
            {t("▶ Training starten")}
          </button>
        </div>
      </div>
      <main className={styles.main}>
        <aside className={styles.library}>
          <span className={styles.eyebrow}>{t("WERKZEUGKASTEN")}</span>
          <h2>{t("Bausteine")}</h2>
          <p className={styles.libraryIntro}>
            {t("Ziehen oder klicken.")}
            <br />
            {t("Verbinden und ausprobieren.")}
          </p>
          <div className={styles.nodeLibrary}>
            {(Object.keys(labels) as NodeKind[]).map((kind) => (
              <button
                key={kind}
                title={explanations[kind].short}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("application/lab-node", kind)
                }
                onClick={() => editor.add(kind)}
              >
                <span>
                  {kind === "dense"
                    ? "▦"
                    : kind === "input"
                      ? "↳"
                      : kind === "binary_output"
                        ? "◎"
                        : "ƒ"}
                </span>
                {labels[kind]}
                <small>+</small>
              </button>
            ))}
          </div>
          <LearningGuide
            dataset={config.dataset}
            run={run}
            metrics={metrics}
            runCount={runs.length}
            onNavigate={navigateLesson}
            onXor={() => newTemplate()}
          />
          <div className={styles.sidebarSection}>
            <h2>{t("Startpunkt wählen")}</h2>
            <button onClick={() => newTemplate()}>XOR · Hidden Layer ↗</button>
            <button onClick={() => newTemplate(true)}>
              {t("XOR · Lineares Netz ↗")}
            </button>
          </div>
          <div className={styles.sidebarSection}>
            <h2>
              {t("Meine Experimente")}{" "}
              <small>{experiments.length.toString().padStart(2, "0")}</small>
            </h2>
            <div className={styles.experimentList}>
              {experiments.length ? (
                experiments.map((e) => (
                  <div className={styles.experimentCard} key={e.id}>
                    <button
                      key={e.id}
                      aria-label={e.name}
                      className={
                        experimentId === e.id ? styles.activeExperiment : ""
                      }
                      onClick={() => load(e)}
                    >
                      {e.name}
                      <small>
                        {new Date(e.updated_at).toLocaleDateString(locale())}
                      </small>
                    </button>
                    <button
                      className={styles.deleteExperiment}
                      aria-label={t`Experiment „${e.name}“ löschen`}
                      title={t("Experiment löschen")}
                      disabled={busy || (active && experimentId === e.id)}
                      onClick={() => deleteExperiment(e.id, e.name)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))
              ) : (
                <p>{t("Noch keine gespeicherten Experimente.")}</p>
              )}
            </div>
          </div>
        </aside>
        <div className={styles.center}>
          <div className={styles.modelBar}>
            <span>
              <b>{editor.nodes.length}</b> {t("Bausteine ")}
              <em>/</em> <b>{editor.validation?.parameter_count ?? "—"}</b>{" "}
              <Term topic="parameters">{t("Parameter")}</Term>
            </span>
            <span
              className={
                editor.validation?.valid ? styles.valid : styles.invalid
              }
            >
              {editor.validation
                ? editor.validation.valid
                  ? t("✓ Architektur gültig")
                  : t("Architektur prüfen")
                : t("Validierung …")}
            </span>
          </div>
          <div ref={canvasArea} className={styles.canvasArea}>
            <Builder templateKey={templateKey} />
          </div>
          {editor.validation && !editor.validation.valid && (
            <div className={styles.validation} role="alert">
              {editor.validation.errors.map((e, i) => (
                <button
                  key={i}
                  onClick={() => e.node_id && editor.select(e.node_id)}
                >
                  {e.node_id
                    ? `${labels[editor.nodes.find((node) => node.id === e.node_id)!.data.kind]}: `
                    : ""}
                  {validationHelp(e.message)}
                </button>
              ))}
            </div>
          )}
          <section ref={workspace} className={styles.workspace}>
            <div className={styles.tabBar}>
              <div role="tablist" aria-label={t("Laborbereiche")}>
                {tabs.map((item) => (
                  <button
                    role="tab"
                    aria-selected={tab === item.id}
                    key={item.id}
                    className={tab === item.id ? styles.activeTab : ""}
                    onClick={() => {
                      setTab(item.id);
                      setWorkspaceOpen(true);
                    }}
                  >
                    {t(item.label)}
                  </button>
                ))}
              </div>
              <button
                aria-label={
                  workspaceOpen
                    ? t("Arbeitsbereich einklappen")
                    : t("Arbeitsbereich öffnen")
                }
                onClick={() => setWorkspaceOpen((v) => !v)}
              >
                {workspaceOpen ? "−" : "+"}
              </button>
            </div>
            {workspaceOpen && (
              <div
                className={`${styles.workspaceBody} ${run ? (tab === "training" ? styles.trainingWorkspace : tab === "inspector" ? styles.inspectorWorkspace : tab === "compare" ? styles.compareWorkspace : "") : ""}`}
                role="tabpanel"
              >
                {tab === "data" && (
                  <div className={styles.dataWorkspace}>
                    <div className={styles.datasetControls}>
                      <span className={styles.eyebrow}>
                        {t("DATASET PLAYGROUND")}
                      </span>
                      <h3>{t("Datensatz")}</h3>
                      <Field label={t("Datensatz")} topic="dataset">
                        <select
                          value={config.dataset.type}
                          onChange={(e) =>
                            editConfig({
                              ...config,
                              dataset: {
                                ...config.dataset,
                                type: e.target
                                  .value as Experiment["dataset"]["type"],
                              },
                            })
                          }
                        >
                          <option value="xor">XOR</option>
                          <option value="moons">Two Moons</option>
                          <option value="circles">Circles</option>
                        </select>
                      </Field>
                      {config.dataset.type !== "xor" && (
                        <div className={styles.fieldGrid}>
                          <Field label={t("Datenpunkte")} topic="samples">
                            <input
                              type="number"
                              min={20}
                              max={limits.max_points ?? 10000}
                              value={config.dataset.samples}
                              onChange={(e) =>
                                editConfig({
                                  ...config,
                                  dataset: {
                                    ...config.dataset,
                                    samples: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </Field>
                          <Field label="Noise" topic="noise">
                            <input
                              type="number"
                              min={0}
                              max={0.5}
                              step={0.01}
                              value={config.dataset.noise}
                              onChange={(e) =>
                                editConfig({
                                  ...config,
                                  dataset: {
                                    ...config.dataset,
                                    noise: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </Field>
                          <Field label={t("Datensatz-Seed")} topic="seed">
                            <input
                              type="number"
                              min={0}
                              max={2147483647}
                              value={config.dataset.seed}
                              onChange={(e) =>
                                editConfig({
                                  ...config,
                                  dataset: {
                                    ...config.dataset,
                                    seed: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </Field>
                          <Field label={t("Testanteil")} topic="test_size">
                            <input
                              type="number"
                              min={0.1}
                              max={0.4}
                              step={0.05}
                              value={config.dataset.test_size}
                              onChange={(e) =>
                                editConfig({
                                  ...config,
                                  dataset: {
                                    ...config.dataset,
                                    test_size: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </Field>
                        </div>
                      )}
                      <p>
                        {config.dataset.type === "xor"
                          ? t(
                              "XOR: Nur wenn die beiden Eingaben verschieden sind, lautet die richtige Klasse 1. Blau zeigt Klasse 0, Orange zeigt Klasse 1. Eine einzige gerade Linie kann diese vier Punkte nicht richtig trennen.",
                            )
                          : t(
                              "Blaue und orange Punkte gehören zu den beiden Klassen. Rauten werden zur Prüfung zurückgehalten: Mit diesen Beispielen verändert das Netz seine Gewichte nicht.",
                            )}
                      </p>
                    </div>
                    <div className={styles.datasetPlot}>
                      {previewOption ? (
                        <Chart
                          option={previewOption}
                          label={t("Datensatz als Scatterplot")}
                          height="calc(100% - 22px)"
                        />
                      ) : previewError ? (
                        <p role="alert">{previewError}</p>
                      ) : (
                        <p role="status">{t("Datensatz wird erzeugt …")}</p>
                      )}
                      <span className={styles.plotNote}>
                        {preview?.train.length ?? 0} Training /{" "}
                        {preview?.test.length ?? 0} Validation{" "}
                        {config.dataset.type === "xor" &&
                          t("· XOR ohne separate Validierung")}
                      </span>
                    </div>
                  </div>
                )}
                {tab !== "data" && (
                  <>
                    <div className={styles.runSelector}>
                      <Field label="Training Run" topic="run">
                        <select
                          aria-label="Training Run"
                          value={runId ?? ""}
                          onChange={(e) => {
                            setRunId(e.target.value || null);
                            setEpoch(null);
                            setFollow(true);
                          }}
                        >
                          <option value="">{t("Run auswählen")}</option>
                          {runs.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.id.slice(0, 8)} · {t(statusLabels[r.status])} ·{" "}
                              {r.snapshot.dataset.type}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {active && (
                        <button
                          className={styles.danger}
                          disabled={busy || run?.cancel_requested}
                          onClick={() =>
                            void perform(async () => {
                              await api(`/runs/${run!.id}/cancel`, {});
                              setNotice("Abbruch angefordert.");
                            })
                          }
                        >
                          {run?.cancel_requested
                            ? t("Abbruch angefordert …")
                            : t("Training abbrechen")}
                        </button>
                      )}
                    </div>
                    {liveError && (
                      <p className={styles.trainingAlert} role="status">
                        {liveError}
                      </p>
                    )}
                    {run ? (
                      <>
                        <div className={styles.runStatus}>
                          <span className={active ? styles.valid : ""}>
                            {t(statusLabels[run.status])}
                          </span>
                          <span>
                            Run {run.id.slice(0, 8)} ·{" "}
                            {run.snapshot.dataset.type.toUpperCase()} · Seed{" "}
                            {run.snapshot.training.seed} ·{" "}
                            {run.snapshot.model.nodes.length} {t("Bausteine")}
                          </span>
                        </div>
                        {run.error_message && (
                          <p className={styles.trainingAlert} role="alert">
                            {run.error_message}
                          </p>
                        )}
                        {tab === "training" && (
                          <>
                            <div className={styles.readouts}>
                              <span>
                                <Term topic="epochs">{t("Epoche")}</Term>{" "}
                                <strong>
                                  {latest?.epoch ?? 0}
                                  <small>
                                    {" "}
                                    / {run.snapshot.training.epochs}
                                  </small>
                                </strong>
                              </span>
                              <span>
                                <Term topic="loss">Training Loss</Term>{" "}
                                <strong>
                                  {latest?.training_loss.toFixed(4) ?? "—"}
                                </strong>
                              </span>
                              <span>
                                <Term topic="accuracy">Accuracy</Term>{" "}
                                <strong>
                                  {latest
                                    ? `${(latest.training_accuracy * 100).toFixed(1)}%`
                                    : "—"}
                                </strong>
                              </span>
                              <span>
                                {t("Trainingszeit")}{" "}
                                <strong>
                                  {(
                                    metrics.reduce(
                                      (sum, m) => sum + m.epoch_duration_ms,
                                      0,
                                    ) / 1000
                                  ).toFixed(2)}{" "}
                                  s
                                </strong>
                              </span>
                            </div>
                            <progress
                              max={run.snapshot.training.epochs}
                              value={latest?.epoch ?? 0}
                              aria-label={t("Trainingsfortschritt")}
                            />

                            <TrainingFeedback
                              run={run}
                              metrics={metrics}
                              previous={previousRun}
                              previousMetrics={previousMetrics}
                            />
                            <TrainingCharts
                              className={styles.trainingPlots}
                              loss={lossOption}
                              accuracy={accuracyOption}
                              boundary={runOption}
                            />
                          </>
                        )}
                        {(tab === "training" || tab === "inspector") && (
                          <div
                            className={`${styles.timeline} ${tab === "training" ? styles.trainingTimeline : ""}`}
                          >
                            <span className={styles.eyebrow}>
                              {t("GESPEICHERTE MODELLZUSTÄNDE")}
                            </span>
                            <div className={styles.inlineControls}>
                              <Field label="Checkpoint" topic="checkpoint">
                                <select
                                  aria-label="Checkpoint"
                                  value={selectedEpoch ?? ""}
                                  onChange={(e) => {
                                    setEpoch(Number(e.target.value));
                                    setFollow(false);
                                  }}
                                >
                                  <option disabled value="">
                                    {t("Noch kein Checkpoint")}
                                  </option>
                                  {checkpoints.map((c) => (
                                    <option key={c.id} value={c.epoch}>
                                      {t("Epoche ")}
                                      {c.epoch}
                                      {c.epoch === 0
                                        ? t(" · Initialisierung")
                                        : ""}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                              <label
                                className={styles.checkbox}
                                title={t("Neuestem Checkpoint folgen")}
                              >
                                <input
                                  type="checkbox"
                                  checked={follow}
                                  onChange={(e) => {
                                    setFollow(e.target.checked);
                                    setEpoch(selectedEpoch ?? null);
                                  }}
                                />
                                {t("Neuestem Checkpoint folgen")}
                              </label>
                            </div>
                            <p>
                              {t("Checkpoint Epoche ")}
                              {selectedEpoch ?? "—"}:{" "}
                              {checkpointMetric
                                ? `Training Loss ${checkpointMetric.training_loss.toFixed(4)} · Accuracy ${(checkpointMetric.training_accuracy * 100).toFixed(1)}%`
                                : t("Initialisierung ohne Trainingsmetrik")}
                            </p>
                            <p>
                              {t(
                                "Nur diese Epochen besitzen gespeicherte Gewichte. Die Metriken sind für jede abgeschlossene Epoche verfügbar.",
                              )}
                            </p>
                          </div>
                        )}
                        {tab === "inspector" &&
                          (runData &&
                          selectedEpoch !== undefined &&
                          selectedEpoch !== null ? (
                            <Inspector
                              key={run.id}
                              run={run}
                              epoch={selectedEpoch}
                              dataset={runData}
                            />
                          ) : (
                            <p>
                              {t(
                                "Der Inspector wird mit dem ersten gespeicherten Checkpoint verfügbar.",
                              )}
                            </p>
                          ))}
                        {tab === "compare" && (
                          <>
                            <details className={styles.compareHelp}>
                              <summary>{t("Vergleich richtig lesen")}</summary>
                              <p>
                                {t(
                                  "Vergleiche möglichst zwei Runs, bei denen du nur eine Einstellung geändert hast. Gleiche Datensätze und Seeds machen Unterschiede besser nachvollziehbar. Ein niedrigerer Trainingsfehler allein bedeutet noch keine bessere Leistung auf neuen Daten.",
                                )}
                              </p>
                            </details>
                            <label className={styles.compareSelector}>
                              {t("Vergleichen mit")}
                              <select
                                aria-label={t("Vergleichen mit")}
                                value={compareId}
                                onChange={(e) => setCompareId(e.target.value)}
                              >
                                <option value="">
                                  {t("Zweiten Run auswählen")}
                                </option>
                                {runs
                                  .filter((r) => r.id !== run.id)
                                  .map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.id.slice(0, 8)} ·{" "}
                                      {r.snapshot.dataset.type} · LR{" "}
                                      {r.snapshot.training.learning_rate}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            {compared ? (
                              <>
                                <div className={styles.comparisonResults}>
                                  <div>
                                    <RunSummary run={run} metrics={metrics} />
                                  </div>
                                  <div>
                                    <RunSummary
                                      run={compared}
                                      metrics={compareMetrics}
                                    />
                                  </div>
                                  <div className={styles.comparisonChart}>
                                    <Chart
                                      option={comparisonOption}
                                      label={t(
                                        "Loss-Vergleich zweier Trainingsläufe",
                                      )}
                                      height="100%"
                                    />
                                  </div>
                                </div>
                                <p className={styles.annotation}>
                                  {t(
                                    "Gemeinsame Epochenachse. Datensätze, Seeds und Architekturen können sich unterscheiden; die Konfigurationen stehen oben.",
                                  )}
                                </p>
                              </>
                            ) : (
                              <p>
                                {t(
                                  "Trainiere das Experiment ein zweites Mal, zum Beispiel mit einer anderen Lernrate, und vergleiche die Ergebnisse.",
                                )}
                              </p>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <p className={styles.emptyState}>
                        {t("Baue dein Netz und starte das erste Training.")}
                        <br />
                        {t("Hier werden echte Ergebnisse sichtbar.")}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        </div>
        <div className={styles.rightColumn}>
          <aside className={styles.trainingSettings}>
            <h2>{t("Training konfigurieren")}</h2>
            <p>
              {t(
                "Für den ersten XOR-Versuch kannst du die Vorgaben übernehmen. Ändere später nur einen Wert und vergleiche die Ergebnisse.",
              )}
            </p>
            <TrainingFields
              config={config.training}
              limits={limits}
              onChange={(training) => editConfig({ ...config, training })}
            />
            <p>
              Max. {limits.max_epochs.toLocaleString(locale())}{" "}
              {t("Epochen und")} {limits.max_checkpoints}{" "}
              {t("reguläre Checkpoints. Ein Training gleichzeitig.")}
            </p>
            {experimentId && (
              <button
                className={styles.danger}
                disabled={busy || active}
                onClick={() => deleteExperiment(experimentId, config.name)}
              >
                {t("Experiment löschen")}
              </button>
            )}
          </aside>
        </div>
      </main>
      <footer className={styles.footer}>
        <span>
          <i className={styles.liveDot} />{" "}
          {error ? (
            <span role="alert" className={styles.errorText}>
              {error}
            </span>
          ) : (
            t(notice) || t("Bereit.")
          )}
        </span>
        <span>
          AI LABORATORY <b>0.1</b> {t("· LOKALES LABOR")}
        </span>
      </footer>
    </div>
  );
}

function RunSummary({ run, metrics }: { run: Run; metrics: Metric[] }) {
  const report = run.snapshot;
  return (
    <div className={styles.runSummary}>
      <h3>{run.id.slice(0, 8)}</h3>
      <dl>
        <dt>{t("Epochen")}</dt>
        <dd>
          {metrics.at(-1)?.epoch ?? 0} / {report.training.epochs}
        </dd>
        <dt>{t("Trainingszeit")}</dt>
        <dd>
          {(
            metrics.reduce((s, m) => s + m.epoch_duration_ms, 0) / 1000
          ).toFixed(3)}{" "}
          s
        </dd>
        <dt>Training Accuracy</dt>
        <dd>{((metrics.at(-1)?.training_accuracy ?? 0) * 100).toFixed(1)}%</dd>
        <dt>Training Loss</dt>
        <dd>{metrics.at(-1)?.training_loss.toFixed(5) ?? "—"}</dd>
        <dt>Validation Loss</dt>
        <dd>{metrics.at(-1)?.validation_loss?.toFixed(5) ?? "—"}</dd>
        <dt>Validation Accuracy</dt>
        <dd>
          {metrics.at(-1)?.validation_accuracy == null
            ? "—"
            : `${(metrics.at(-1)!.validation_accuracy! * 100).toFixed(1)}%`}
        </dd>
        <dt>{t("Datensatz")}</dt>
        <dd>
          {report.dataset.type} / Seed {report.dataset.seed}
        </dd>
        <dt>{t("Datenkonfiguration")}</dt>
        <dd>
          {report.dataset.samples} / Noise {report.dataset.noise} / Test{" "}
          {report.dataset.test_size}
        </dd>
        <dt>{t("Training-Seed")}</dt>
        <dd>{report.training.seed}</dd>
        <dt>{t("Lernrate / Batch")}</dt>
        <dd>
          {report.training.learning_rate} / {report.training.batch_size}
        </dd>
        <dt>{t("Parameter")}</dt>
        <dd>{countParameters(report)}</dd>
      </dl>
      <p>
        {report.model.nodes
          .map(
            (n) =>
              `${labels[n.type]}${n.parameters.units ? `(${n.parameters.units})` : ""}`,
          )
          .join(" → ")}
      </p>
    </div>
  );
}
function countParameters(experiment: Experiment) {
  let width = 2,
    count = 0;
  const nodes = new Map(experiment.model.nodes.map((n) => [n.id, n]));
  let node = experiment.model.nodes.find((n) => n.type === "input");
  const visited = new Set<string>();
  while (node && !visited.has(node.id)) {
    visited.add(node.id);
    if (node.type === "dense") {
      count += (width + 1) * node.parameters.units;
      width = node.parameters.units;
    }
    const target = experiment.model.edges.find(
      (e) => e.source === node!.id,
    )?.target;
    node = target ? nodes.get(target) : undefined;
  }
  return count;
}
