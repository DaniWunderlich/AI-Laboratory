import { t } from "./i18n";
import { useRef } from "react";
import type { Metric, Run } from "./types";
import styles from "./Feedback.module.css";

export function learningTrend(metrics: Metric[]) {
  const first = metrics[0],
    last = metrics.at(-1);
  if (!first || !last || metrics.length < 2) return null;
  const delta = last.training_loss - first.training_loss;
  const tolerance = Math.max(1e-6, Math.abs(first.training_loss) * 0.01);
  const accuracy = last.training_accuracy - first.training_accuracy;
  const label =
    delta < -tolerance && accuracy >= -1e-6
      ? t("Training verbessert")
      : delta > tolerance && accuracy <= 1e-6
        ? t("Training verschlechtert")
        : Math.abs(delta) <= tolerance && Math.abs(accuracy) < 1e-6
          ? t("Kaum Veränderung")
          : t("Gemischtes Ergebnis");
  return {
    first,
    last,
    delta,
    accuracy,
    label,
    overfitting:
      first.validation_loss !== null &&
      last.validation_loss !== null &&
      delta < -tolerance &&
      last.validation_loss >
        first.validation_loss +
          Math.max(1e-6, Math.abs(first.validation_loss) * 0.01),
  };
}

function dataKey(run: Run) {
  return JSON.stringify(
    run.snapshot.dataset.type === "xor"
      ? { type: "xor" }
      : run.snapshot.dataset,
  );
}

export function TrainingFeedback({
  run,
  metrics,
  previous,
  previousMetrics,
}: {
  run: Run;
  metrics: Metric[];
  previous?: Run;
  previousMetrics: Metric[];
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const trend = learningTrend(metrics);
  if (!trend)
    return (
      <p className={styles.waiting}>
        {t(
          "Für eine Entwicklungsaussage werden mindestens zwei gemessene Epochen benötigt.",
        )}
      </p>
    );
  const old = previousMetrics.at(-1);
  const comparable =
    previous &&
    dataKey(previous) === dataKey(run) &&
    previous.snapshot.training.seed === run.snapshot.training.seed;
  return (
    <details
      ref={details}
      className={styles.feedback}
      onKeyDown={(event) => {
        if (event.key === "Escape" && details.current)
          details.current.open = false;
      }}
    >
      <summary>
        <strong>{trend.label}</strong> · Loss{" "}
        {trend.first.training_loss.toFixed(4)} →{" "}
        {trend.last.training_loss.toFixed(4)} {t("· Auswertung öffnen")}
      </summary>
      <div>
        <button
          type="button"
          onClick={() => {
            if (details.current) details.current.open = false;
          }}
        >
          {t("Auswertung schließen")}
        </button>
        <p>
          {t`Verglichen werden die erste gemessene Epoche (${trend.first.epoch}) und Epoche ${trend.last.epoch}, nicht der untrainierte Anfang. Der Fehlerwert änderte sich von ${trend.first.training_loss.toFixed(4)} auf ${trend.last.training_loss.toFixed(4)}. Die Trefferquote änderte sich von ${(trend.first.training_accuracy * 100).toFixed(1)} % auf ${(trend.last.training_accuracy * 100).toFixed(1)} %.`}
        </p>
        {trend.label === t("Kaum Veränderung") && (
          <p>
            {t(
              "Ändere beim nächsten Versuch nur eine Sache: Prüfe zunächst, ob eine nichtlineare Aktivierung vorhanden ist. Vergleiche anschließend eine andere Lernrate bei denselben Seeds.",
            )}
          </p>
        )}
        {trend.label === t("Training verschlechtert") && (
          <p>
            {t(
              "Eine kleinere Lernrate kann vorsichtigere Korrekturschritte ermöglichen. Mehr Epochen allein lösen eine ungeeignete Architektur oder instabiles Lernen nicht.",
            )}
          </p>
        )}
        {trend.overfitting && (
          <p className={styles.caution}>
            {t(
              "Während der Trainingsfehler sinkt, ist der Validierungsfehler gegenüber der ersten Messung gestiegen. Das kann auf Überanpassung hinweisen. Prüfe den ganzen Verlauf und vergleiche weniger Epochen oder ein kleineres Netz.",
            )}
          </p>
        )}
        {run.snapshot.dataset.type === "xor" ? (
          <p>
            {t(
              "Hier werden nur vier XOR-Trainingspunkte bewertet. Auch 100 % belegen keine Leistung auf neuen Daten.",
            )}
          </p>
        ) : (
          <p>
            {t(
              "Bewerte zusätzlich die zurückgehaltenen Daten: Validation Loss",
            )}{" "}
            {trend.last.validation_loss?.toFixed(4) ?? "—"}, Validation Accuracy{" "}
            {trend.last.validation_accuracy == null
              ? "—"
              : `${(trend.last.validation_accuracy * 100).toFixed(1)} %`}
            {t(". Eine einzelne Schwankung beweist noch keine Überanpassung.")}
          </p>
        )}
        {previous && old && (
          <p>
            {t("Gegenüber dem vorherigen abgeschlossenen Run")}{" "}
            {previous.id.slice(0, 8)}
            {t(": finaler Trainingsfehler")} {old.training_loss.toFixed(4)} →{" "}
            {trend.last.training_loss.toFixed(4)}
            {t(", Trefferquote")} {(old.training_accuracy * 100).toFixed(1)} % →{" "}
            {(trend.last.training_accuracy * 100).toFixed(1)} %.{" "}
            {comparable
              ? t(
                  "Datensatz und Trainings-Seed stimmen überein; prüfe im Vergleich auch Architektur, Lernrate und Epochenzahl.",
                )
              : t(
                  "Datensatz oder Trainings-Seed unterscheiden sich. Der Unterschied lässt sich deshalb nicht eindeutig einer einzelnen Änderung zuschreiben.",
                )}
          </p>
        )}
        {run.status !== "COMPLETED" && (
          <p>
            {t("Dieser Run ist")}{" "}
            {run.status === "RUNNING" || run.status === "VALIDATING"
              ? t("noch nicht abgeschlossen")
              : t("nicht vollständig abgeschlossen")}
            {t(
              ". Die Aussage bezieht sich nur auf die bisher gespeicherten Messungen.",
            )}
          </p>
        )}
      </div>
    </details>
  );
}
