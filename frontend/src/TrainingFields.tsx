import { t } from "./i18n";
import { Field, Term } from "./Help";
import type { TrainingConfig, TrainingLimits } from "./types";
import styles from "./Workbench.module.css";
import learningStyles from "./Learning.module.css";

const fields = [
  { key: "learning_rate", label: "Lernrate", min: 0.001, max: 5, step: 0.05 },
  { key: "epochs", label: "Epochen", min: 1, max: 10000, step: 1 },
  { key: "batch_size", label: "Batchgröße", min: 1, max: 1000, step: 1 },
  { key: "seed", label: "Training-Seed", min: 0, max: 2147483647, step: 1 },
  {
    key: "checkpoint_interval",
    label: "Checkpoint alle",
    min: 1,
    max: 10000,
    step: 1,
  },
] as const;

export function TrainingFields({
  config,
  onChange,
  limits,
}: {
  config: TrainingConfig;
  onChange: (next: TrainingConfig) => void;
  limits: TrainingLimits;
}) {
  const checkpoints = Math.floor(
    (config.epochs - 1) / config.checkpoint_interval,
  );
  const recommendedInterval = Math.max(
    1,
    Math.ceil((config.epochs - 1) / limits.max_checkpoints),
  );
  function field(entry: (typeof fields)[number]) {
    return (
      <Field key={entry.key} label={t(entry.label)} topic={entry.key}>
        <input
          type="number"
          min={entry.min}
          max={
            entry.key === "epochs" || entry.key === "checkpoint_interval"
              ? limits.max_epochs
              : entry.key === "batch_size"
                ? (limits.max_points ?? entry.max)
                : entry.max
          }
          step={entry.step}
          value={config[entry.key]}
          onChange={(event) =>
            onChange({ ...config, [entry.key]: Number(event.target.value) })
          }
        />
      </Field>
    );
  }
  return (
    <>
      <div className={styles.fieldGrid}>{fields.slice(0, 2).map(field)}</div>
      <details className={learningStyles.advanced}>
        <summary>
          {t("Weitere Einstellungen: Batches, Seed und Checkpoints")}
        </summary>
        <div className={styles.fieldGrid}>{fields.slice(2).map(field)}</div>
        <p role="status">
          {checkpoints} {t("reguläre Zwischenstände geplant, höchstens")}{" "}
          {limits.max_checkpoints}{" "}
          {t("erlaubt. Anfang und Ende werden zusätzlich gespeichert.")}
        </p>
        {checkpoints > limits.max_checkpoints && (
          <button
            type="button"
            onClick={() =>
              onChange({ ...config, checkpoint_interval: recommendedInterval })
            }
          >
            {t("Abstand auf ")}
            {recommendedInterval} {t("Epochen setzen")}
          </button>
        )}
        <Term topic="sgd">{t("Lernverfahren: SGD")}</Term>
        <p>
          {t(
            "Das Netz rechnet auf der CPU. Der Fehlerwert für die zwei Klassen wird mit BCEWithLogitsLoss berechnet.",
          )}
        </p>
      </details>
    </>
  );
}
