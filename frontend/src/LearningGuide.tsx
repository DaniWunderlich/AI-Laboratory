import { t } from "./i18n";
import { useState } from "react";
import type { DatasetConfig, Metric, Run } from "./types";
import styles from "./Learning.module.css";

export type LearningStep =
  "data" | "model" | "train" | "results" | "inspect" | "compare";
const steps: {
  id: LearningStep;
  label: string;
  title: string;
  explanation: string;
  task: string;
  action: string;
}[] = [
  {
    id: "data",
    label: "Daten",
    title: "1. Was soll das Netz lernen?",
    explanation:
      "Ein neuronales Netz lernt aus Beispielen. Jeder Punkt hat zwei Eingabewerte und eine bekannte Antwort: Klasse 0 oder Klasse 1. Das Netz soll die Regel hinter diesen Antworten entdecken.",
    task: "Schau dir unten die Punkte an: Die Position sind die zwei Eingaben, die Farbe ist die richtige Antwort. Für den ersten Versuch eignet sich XOR mit nur vier Punkten.",
    action: "Datensatz ansehen",
  },
  {
    id: "model",
    label: "Bausteine",
    title: "2. Wie entsteht eine Vorhersage?",
    explanation:
      "Lies das Netz von links nach rechts: Input liefert Zahlen. Dense-Schichten mischen sie mit lernbaren Gewichten. Eine Aktivierung wie Tanh ermöglicht gekrümmte Regeln. Binary Output macht daraus eine Entscheidung zwischen zwei Klassen.",
    task: "Wähle eine Dense-Schicht aus. Ihre Neuronen sind kleine Recheneinheiten. Für den ersten Versuch kannst du die vorbereitete Architektur unverändert lassen.",
    action: "Schichteinstellungen öffnen",
  },
  {
    id: "train",
    label: "Lernen",
    title: "3. Das Netz übt an Beispielen",
    explanation:
      "Am Anfang sind die Gewichte zufällig. Das Netz sagt eine Antwort voraus, berechnet seinen Fehler und korrigiert seine Gewichte. Eine Epoche ist ein Durchgang durch alle Trainingsbeispiele.",
    task: "Lass zunächst die Vorgaben stehen. Starte das Training mit dem Button „Training starten“ oben. Beobachte danach den Fehlerwert (Loss) und den Anteil richtiger Antworten (Accuracy).",
    action: "Trainingsbereich ansehen",
  },
  {
    id: "results",
    label: "Ergebnisse",
    title: "4. Woran erkenne ich Fortschritt?",
    explanation:
      "Ein kleinerer Fehlerwert ist ein gutes Zeichen, wenn dieselben Daten bewertet werden. Accuracy zählt die richtigen Entscheidungen. Die Farbfläche zeigt, welche Klasse das Netz an jeder Stelle erwartet. Sie kann sich mit jedem gespeicherten Zustand verändern.",
    task: "Wähle unter Checkpoint zuerst Epoche 0 und danach den letzten Zustand. Vergleiche die Farbflächen: Welche bekannten Punkte liegen jetzt in der passenden Farbe?",
    action: "Trainingsergebnis ansehen",
  },
  {
    id: "inspect",
    label: "Hineinschauen",
    title: "5. Eine Vorhersage Schritt für Schritt",
    explanation:
      "Im Inspector kannst du einen Datenpunkt durch alle Bausteine verfolgen. Der Forward Pass rechnet von der Eingabe zur Vorhersage. Backpropagation bestimmt rückwärts, wie die Gewichte den Fehler beeinflussen.",
    task: "Wähle einen Datenpunkt und bleibe zunächst bei Forward Pass. Gehe mit „Nächster Baustein“ durch die Rechnung. Gewichte, Gradienten und Formeln kannst du anschließend in Ruhe erkunden.",
    action: "Inspector öffnen",
  },
  {
    id: "compare",
    label: "Ausprobieren",
    title: "6. Ändere eine Sache und vergleiche",
    explanation:
      "Eine einzelne Änderung lässt sich besser verstehen als fünf auf einmal. Jeder Trainingsstart erzeugt einen neuen Run, der seine ursprünglichen Einstellungen behält. So kannst du deine Vermutung an echten Ergebnissen prüfen.",
    task: "Notiere deine Vermutung. Ändere zum Beispiel nur die Lernrate von 0,5 auf 0,1, behalte die Seeds bei und trainiere dasselbe Experiment erneut. Wähle danach beide Runs im Vergleich aus. Musste der Fehler schneller oder langsamer sinken?",
    action: "Run-Vergleich öffnen",
  },
];

export function LearningGuide({
  dataset,
  run,
  metrics,
  runCount,
  onNavigate,
  onXor,
}: {
  dataset: DatasetConfig;
  run: Run | null;
  metrics: Metric[];
  runCount: number;
  onNavigate: (step: LearningStep, reveal?: boolean) => void;
  onXor: () => void;
}) {
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem("lab.learning.visible.v1") !== "false";
    } catch {
      return true;
    }
  });
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const original = steps[index];
  const current = {
    ...original,
    title: t(original.title),
    explanation: t(original.explanation),
    task: t(original.task),
    action: t(original.action),
  };
  const latest = metrics.at(-1);
  function move(next: number) {
    setIndex(next);
    setAnswer(null);
    onNavigate(steps[next].id);
  }
  function toggle() {
    setExpanded((value) => {
      try {
        localStorage.setItem("lab.learning.visible.v1", String(!value));
      } catch {
        /* Help works without browser storage. */
      }
      return !value;
    });
  }
  return (
    <section className={styles.guide} aria-label={t("Geführter Einstieg")}>
      <div className={styles.guideHeader}>
        <h2>{t("Lernbegleitung")}</h2>
        <button
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls="learning-guide-content"
        >
          {expanded
            ? t("Lernbegleitung ausblenden")
            : t("Lernbegleitung öffnen")}
        </button>
      </div>
      {expanded && (
        <div id="learning-guide-content">
          <ol className={styles.steps} aria-label={t("Lernschritte")}>
            {steps.map((step, i) => (
              <li key={step.id}>
                <button
                  aria-current={i === index ? "step" : undefined}
                  onClick={() => move(i)}
                >
                  {i + 1}. {t(step.label)}
                </button>
              </li>
            ))}
          </ol>
          <div className={styles.guideBody}>
            <div>
              <h3>{current.title}</h3>
              <p>{current.explanation}</p>
              {current.id === "data" && dataset.type === "xor" && (
                <>
                  <p>
                    <strong>{t("XOR bedeutet „entweder oder“:")}</strong>{" "}
                    {t(
                      "Stell dir zwei Schalter vor. Das Licht soll nur an sein, wenn genau einer an ist.",
                    )}
                  </p>
                  <table className={styles.xorTable}>
                    <caption>{t("Vier Beispiele für die XOR-Regel")}</caption>
                    <thead>
                      <tr>
                        <th>{t("Schalter 1")}</th>
                        <th>{t("Schalter 2")}</th>
                        <th>{t("Licht / Klasse")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [0, 0, 0],
                        [0, 1, 1],
                        [1, 0, 1],
                        [1, 1, 0],
                      ].map(([a, b, y]) => (
                        <tr key={`${a}${b}`}>
                          <td>
                            {a} · {a ? t("an") : t("aus")}
                          </td>
                          <td>
                            {b} · {b ? t("an") : t("aus")}
                          </td>
                          <td>
                            {y} · {y ? t("an") : t("aus")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>
                    {t(
                      "Zum Mitdenken: Beide Schalter sind an. Welche Klasse ist richtig?",
                    )}
                  </p>
                  <div className={styles.answer}>
                    {[0, 1].map((value) => (
                      <button
                        key={value}
                        aria-pressed={answer === value}
                        onClick={() => setAnswer(value)}
                      >
                        {t("Klasse ")}
                        {value}
                      </button>
                    ))}
                  </div>
                  {answer !== null && (
                    <p className={styles.feedback} role="status">
                      {answer === 0
                        ? t(
                            "Genau: Klasse 0. Bei XOR leuchtet das Licht nur bei genau einem eingeschalteten Schalter.",
                          )
                        : t(
                            "Bei zwei eingeschalteten Schaltern ist hier Klasse 0 richtig. XOR unterscheidet sich vom gewöhnlichen „oder“: Genau einer muss an sein.",
                          )}
                    </p>
                  )}
                </>
              )}
              {current.id === "data" && dataset.type !== "xor" && (
                <p>
                  {t("Du arbeitest gerade mit")}{" "}
                  {dataset.type === "moons"
                    ? t("zwei Halbmonden")
                    : t("zwei Kreisen")}
                  {t(
                    ". Für eine überschaubare erste Aufgabe kannst du ausdrücklich die XOR-Vorlage öffnen.",
                  )}
                </p>
              )}
              {current.id === "results" && (
                <p className={styles.feedback} role="status">
                  {latest && run
                    ? t`Ausgewählter Run: Nach ${latest.epoch} Epochen sind ${(latest.training_accuracy * 100).toFixed(1)} % der Trainingsbeispiele richtig. Der Fehlerwert beträgt ${latest.training_loss.toFixed(4)}. ${run.snapshot.dataset.type === "xor" ? "Hier werden nur die vier XOR-Trainingspunkte geprüft, keine neuen Beispiele." : "Vergleiche zusätzlich die Validierungswerte der zurückgehaltenen Beispiele."}`
                    : t(
                        "Noch keine Messwerte für einen ausgewählten Run. Trainiere zuerst oder wähle einen gespeicherten Run aus. Danach kannst du hier deinen Lernfortschritt einordnen.",
                      )}
                </p>
              )}
              {current.id === "compare" && (
                <p className={styles.feedback}>
                  {runCount < 2
                    ? t(
                        "Zum Vergleich brauchst du zwei Runs desselben Experiments. Speichere es und starte ein zweites Training.",
                      )
                    : t(
                        "Für dieses Experiment sind mehrere Runs verfügbar. Prüfe beim Vergleich auch Daten, Seeds und Architektur.",
                      )}
                </p>
              )}
              {run && ["results", "inspect"].includes(current.id) && (
                <p>
                  {t(
                    "Die Anzeigen gehören zum ausgewählten Run. Spätere Änderungen am Editor verändern diesen gespeicherten Versuch nicht.",
                  )}
                </p>
              )}
            </div>
            <div className={styles.task}>
              <strong>{t("JETZT SELBST AUSPROBIEREN")}</strong>
              <p>{current.task}</p>
              <button onClick={() => onNavigate(current.id, true)}>
                {current.action} →
              </button>
              {current.id === "data" && (
                <>
                  <p>
                    {t(
                      "Mit der Vorlage beginnst du ein neues Experiment. Speichere eigene Änderungen vorher.",
                    )}
                  </p>
                  <button onClick={onXor}>{t("XOR-Vorlage öffnen")}</button>
                </>
              )}
            </div>
          </div>
          <div className={styles.guideFooter}>
            <span>
              {t("Schritt ")}
              {index + 1} {t("von ")}
              {steps.length}
            </span>
            <div>
              <button disabled={index === 0} onClick={() => move(index - 1)}>
                {t("← Zurück")}
              </button>
              <button
                disabled={index === steps.length - 1}
                onClick={() => move(index + 1)}
              >
                {t("Weiter →")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
