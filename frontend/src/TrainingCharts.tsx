import { t } from "./i18n";
import type { EChartsOption } from "echarts";
import { Chart } from "./Chart";
import { Term } from "./Help";
import styles from "./TrainingCharts.module.css";

export function TrainingCharts({
  loss,
  accuracy,
  boundary,
  className = "",
}: {
  loss: EChartsOption;
  accuracy: EChartsOption;
  boundary: EChartsOption | null;
  className?: string;
}) {
  return (
    <div
      className={`${styles.charts} ${className}`}
      aria-label={t("Trainingsdiagramme")}
    >
      <div className={styles.card}>
        <h2>
          <Term topic="loss">{t("Loss · Fehlerwert")}</Term>
        </h2>
        <div className={styles.plot}>
          <div className={styles.fill}>
            <Chart
              option={loss}
              label={t("Trainings- und Validierungs-Loss")}
              height="100%"
            />
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <h2>
          <Term topic="accuracy">{t("Accuracy · Trefferquote")}</Term>
        </h2>
        <div className={styles.plot}>
          <div className={styles.fill}>
            <Chart
              option={accuracy}
              label={t("Trainings- und Validierungs-Accuracy")}
              height="100%"
            />
          </div>
        </div>
      </div>
      <div className={styles.card}>
        <h2>
          <Term topic="boundary">{t("Wie sieht dein Netz die Daten?")}</Term>
        </h2>
        <div className={styles.plot}>
          <div className={styles.fill}>
            {boundary ? (
              <Chart
                option={boundary}
                label={t("Decision Boundary des gewählten Checkpoints")}
                height="100%"
              />
            ) : (
              <p className={styles.pending}>
                {t(
                  "Die Entscheidungsfläche wird mit dem ersten Checkpoint verfügbar.",
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
