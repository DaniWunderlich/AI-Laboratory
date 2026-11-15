import { t } from "./i18n";
const source = {
  dataset: {
    title: "Datensatz",
    short: "Beispiele, an denen das Netz eine Regel lernen soll.",
    detail:
      "Jeder Punkt hat zwei Eingabewerte (seine Position) und eine bekannte Klasse, hier 0 oder 1. Beim Training sieht das Netz sowohl die Eingaben als auch die richtige Antwort. Später soll es die Klasse selbst vorhersagen.",
  },
  input: {
    title: "Input · Eingabe",
    short: "Hier kommen die beiden Zahlen eines Datenpunkts ins Netz.",
    detail:
      "Die zwei Features sind die x- und y-Koordinate des Punkts. Der Input-Baustein lernt selbst nichts; er gibt diese Werte an den nächsten Baustein weiter.",
  },
  dense: {
    title: "Dense · vollständig verbundene Schicht",
    short: "Mischt die Eingangswerte mit lernbaren Gewichten.",
    detail:
      "Jedes Neuron bekommt alle Werte der vorherigen Schicht. Es multipliziert sie mit Gewichten und addiert einen Bias. Beim Training ändern sich diese Gewichte und Bias-Werte. Eine nachfolgende Aktivierung wie Tanh macht daraus eine nichtlineare Verarbeitung.",
  },
  neurons: {
    title: "Neuronen",
    short: "Kleine Recheneinheiten in dieser Schicht.",
    detail:
      "Ein Neuron kombiniert seine Eingaben zu einer neuen Zahl. Mehr Neuronen geben dem Netz mehr Möglichkeiten, Muster zu erfassen, garantieren aber kein besseres Ergebnis. Probiere später 4 statt 8 Neuronen und vergleiche die Runs bei gleichem Seed.",
  },
  relu: {
    title: "ReLU · Aktivierung",
    short: "Lässt positive Zahlen durch und setzt negative auf null.",
    detail:
      "Beispiel: Aus −2 wird 0, aus 3 bleibt 3. Diese Nichtlinearität hilft einem mehrschichtigen Netz, auch Regeln mit geknickten statt nur geraden Grenzen darzustellen.",
  },
  tanh: {
    title: "Tanh · Aktivierung",
    short: "Formt Zahlen sanft in den Bereich von −1 bis 1 um.",
    detail:
      "Diese gekrümmte Funktion gibt dem Netz die Möglichkeit, nichtlineare Zusammenhänge zu lernen. Für das vorbereitete XOR-Netz ist sie ein guter Start. Ohne eine solche Nichtlinearität bleiben mehrere Dense-Schichten zusammen eine lineare Abbildung.",
  },
  sigmoid: {
    title: "Sigmoid · Aktivierung",
    short: "Formt eine Zahl in einen Wert zwischen 0 und 1 um.",
    detail:
      "Große positive Zahlen werden nahe 1, große negative nahe 0. Hier darf dieser Baustein im Inneren des Netzes stehen. Direkt vor Binary Output ist er nicht erlaubt, weil die Umrechnung dort bereits zur Auswertung gehört.",
  },
  binary_output: {
    title: "Binary Output · Entscheidung zwischen zwei Klassen",
    short: "Gibt an, wie stark das Netz Klasse 1 erwartet.",
    detail:
      "Die letzte Dense-Schicht muss genau eine Zahl liefern: den Logit. Zur Anzeige wird daraus ein Wert zwischen 0 und 1. Ab 0,5 ordnen wir den Punkt Klasse 1 zu, sonst Klasse 0. Ein Wert nahe 1 ist keine Garantie für eine richtige Antwort.",
  },
  parameters: {
    title: "Parameter",
    short: "Die Zahlen, die das Netz beim Lernen selbst verändert.",
    detail:
      "Gewichte bestimmen den Einfluss der Eingaben, Bias-Werte verschieben die Rechnung. Diese lernbaren Zahlen sind etwas anderes als Lernrate oder Epochenzahl: Letztere legst du vor dem Training fest.",
  },
  shape: {
    title: "Tensorform · Anzahl der Werte",
    short: "Zeigt, wie viele Zahlen ein Baustein empfängt und weitergibt.",
    detail:
      "[batch, 8] bedeutet: acht Werte pro Beispiel, für mehrere Beispiele zugleich. Dense(8) erzeugt acht Werte; eine Aktivierung verändert die Werte, aber nicht ihre Anzahl. Binary Output benötigt genau einen Wert pro Beispiel.",
  },
  learning_rate: {
    title: "Lernrate",
    short: "Wie groß ein einzelner Korrekturschritt ausfällt.",
    detail:
      "Eine kleine Lernrate macht vorsichtige, oft langsame Schritte. Eine zu große kann das Ziel überspringen und das Lernen instabil machen. Lass für den ersten XOR-Versuch 0,5 stehen. Ändere danach nur diesen Wert, etwa auf 0,1, um den Unterschied zu erkennen.",
  },
  epochs: {
    title: "Epoche · eine Lernrunde",
    short: "Eine Epoche verarbeitet alle Trainingsbeispiele einmal.",
    detail:
      "300 Epochen bedeuten 300 Durchgänge durch die Trainingsdaten. Das Netz darf seine Gewichte dabei immer wieder korrigieren. Mehr Runden helfen nicht unbegrenzt: Bei neuen Daten kann die Leistung trotz gutem Training schlecht sein.",
  },
  batch_size: {
    title: "Batchgröße",
    short: "Wie viele Beispiele gemeinsam einen Korrekturschritt bestimmen.",
    detail:
      "Bei 200 Trainingspunkten und Batchgröße 32 erfolgen mehrere Gewichtsschritte pro Epoche. Bei XOR gibt es nur vier Punkte: Auch eine Batchgröße von 32 verwendet dann alle vier zusammen. Kleine Batches können einen unruhigeren Verlauf ergeben.",
  },
  seed: {
    title: "Seed · Startzahl für den Zufall",
    short: "Mit gleicher Startzahl lässt sich ein Versuch besser wiederholen.",
    detail:
      "Beim Training legt der Seed die zufälligen Anfangsgewichte und die Reihenfolge der Beispiele fest. Beim Datensatz bestimmt er dessen Erzeugung und Aufteilung. Halte beide Seeds beim Vergleich gleich und ändere möglichst nur eine Sache. Über verschiedene Softwareumgebungen sind Ergebnisse nicht zwingend bitgenau gleich.",
  },
  checkpoint_interval: {
    title: "Checkpoint-Abstand",
    short: "Nach wie vielen Epochen Gewichte gespeichert werden.",
    detail:
      "Bei Abstand 15 kannst du die Modellgewichte von Epoche 15, 30, 45 usw. untersuchen. Zusätzlich werden der Anfang und das Ende gespeichert. Metriken gibt es für jede Epoche; vollständige Gewichte nur für Checkpoints. Die Trainingskonfiguration zeigt, wie viele Zwischenstände erlaubt sind.",
  },
  checkpoint: {
    title: "Checkpoint · gespeicherter Modellzustand",
    short: "Ein Foto der Gewichte zu einer bestimmten Epoche.",
    detail:
      "Wähle Epoche 0 und dann einen späteren Zustand. Die Farbfläche wird jeweils mit genau diesen Gewichten neu berechnet. Damit kannst du sehen, wie sich die Trennfläche entwickelt hat. Die aktuellen Metriken des ganzen Runs und der ausgewählte frühere Zustand sind unterschiedliche Dinge.",
  },
  samples: {
    title: "Datenpunkte",
    short: "So viele Beispiele werden für den Datensatz erzeugt.",
    detail:
      "Mehr Beispiele zeigen dem Netz mehr Varianten der Regel, kosten aber mehr Rechenzeit. Ein Teil wird zum Lernen genutzt, der Testanteil wird zur späteren Prüfung zurückgehalten. XOR besitzt immer genau vier Punkte.",
  },
  noise: {
    title: "Noise · Rauschen",
    short: "Zufällige Verschiebungen machen die Punkte unordentlicher.",
    detail:
      "Bei 0 liegen die synthetischen Punkte klar auf ihren Grundformen. Mit mehr Rauschen können sich die Klassen überlappen. Perfekte Zuordnung wird dann schwieriger oder unmöglich. Das ist eine Eigenschaft der Daten, nicht automatisch ein Fehler des Netzes.",
  },
  test_size: {
    title: "Testanteil · zurückgehaltene Beispiele",
    short: "Diese Daten werden bei den Gewichtsschritten nicht benutzt.",
    detail:
      "0,2 bedeutet 20 Prozent der Punkte. Ihre Ergebnisse heißen hier Validation Loss und Validation Accuracy. Sie helfen zu prüfen, wie gut das Netz auf ungelernten Beispielen abschneidet. Beide Klassen sind im Split vertreten. Für die vier XOR-Punkte gibt es keinen separaten Testanteil.",
  },
  loss: {
    title: "Loss · Fehlerwert",
    short: "Bewertet, wie weit die Vorhersagen von den Antworten abweichen.",
    detail:
      "Kleiner ist besser, wenn du denselben Datensatz und dieselbe Loss-Funktion vergleichst. Der Fehlerwert berücksichtigt auch, wie überzeugt das Netz bei einer falschen Antwort ist. Er ist keine Fehlerquote in Prozent und kann größer als 1 sein.",
  },
  accuracy: {
    title: "Accuracy · Anteil richtiger Antworten",
    short: "75 Prozent bedeuten drei richtige Antworten von vier.",
    detail:
      "Wir verwenden 0,5 als Entscheidungsschwelle für Klasse 1. Accuracy zählt dann, wie viele Entscheidungen stimmen. Bei XOR mit vier Trainingspunkten sind 100 Prozent noch kein Nachweis, dass ein Netz auf neuen Beispielen gut arbeitet.",
  },
  validation: {
    title: "Validation · Prüfung mit zurückgehaltenen Daten",
    short: "Zeigt die Leistung auf Beispielen, mit denen nicht gelernt wird.",
    detail:
      "Sinkt der Trainingsfehler, während der Validierungsfehler steigt, kann das Netz die Trainingsdaten zu stark auswendig lernen: Overfitting. Das ist ein Hinweis, kein Beweis aus einer einzelnen Schwankung. Bei XOR zeigen wir ausschließlich Trainingswerte.",
  },
  boundary: {
    title: "Decision Boundary · Entscheidungsgrenze",
    short:
      "Die Farbfläche zeigt, welche Klasse das Netz an jeder Stelle erwartet.",
    detail:
      "Blau steht für Klasse 0, Orange für Klasse 1. Am Übergang ist die Vorhersage ungefähr 0,5. Die Punkte zeigen die bekannten Antworten. Liegt ein Punkt in der Fläche der anderen Klasse, ordnet das Netz ihn falsch zu. Die Fläche stammt aus echten Vorhersagen des gewählten Checkpoints.",
  },
  probability: {
    title: "P(Klasse 1) · vorhergesagte Wahrscheinlichkeit",
    short: "0,8 entspricht einer Vorhersage von 80 Prozent für Klasse 1.",
    detail:
      "Das ist die Ausgabe des Modells, keine gemessene Sicherheit. Mit einer Schwelle von 0,5 wird daraus die Entscheidung für Klasse 0 oder 1. Vergleiche sie mit der bekannten Antwort des ausgewählten Datenpunkts.",
  },
  forward: {
    title: "Forward Pass · vorwärts rechnen",
    short: "Verfolge, wie aus zwei Eingaben eine Vorhersage wird.",
    detail:
      "Jeder Baustein erhält Zahlen vom vorherigen und berechnet seine Ausgabe. Wähle die Schritte von Input bis Binary Output aus. Dabei werden noch keine Gewichte verändert.",
  },
  gradient: {
    title: "Gradient · Einfluss auf den Fehler",
    short: "Zeigt, wie eine kleine Änderung den Fehler beeinflussen würde.",
    detail:
      "Ein positiver Gewichtsgradient bedeutet: Wird dieses Gewicht etwas größer, steigt der Fehler lokal. SGD bewegt es deshalb in die Gegenrichtung. Bei negativem Gradienten ist es umgekehrt. Backpropagation berechnet diese Einflüsse vom Ausgang zurück durch das Netz.",
  },
  weights: {
    title: "Gewichte und Bias",
    short:
      "Gewichte regeln den Einfluss jeder Eingabe; Bias verschiebt das Ergebnis.",
    detail:
      "Beispiel: 2 × 0,5 + 1 × (−0,2) + 0,1 ergibt 0,9. Die Faktoren 0,5 und −0,2 sind Gewichte, 0,1 ist der Bias. Beim Lernen werden diese Zahlen angepasst. Eine Aktivierung ist anschließend eine eigene Operation.",
  },
  sgd: {
    title: "SGD · Lernen in Korrekturschritten",
    short:
      "Verringert den Fehler, indem Gewichte gegen den Gradienten bewegt werden.",
    detail:
      "Die Rechnung lautet: neues Gewicht = altes Gewicht − Lernrate × Gradient. Der Inspector demonstriert einen solchen Schritt für genau einen Datenpunkt auf einer Kopie. Das muss nicht dem damaligen Trainingsschritt mit einer ganzen Batch entsprechen.",
  },
  run: {
    title: "Run · ein Trainingsversuch",
    short: "Jeder Trainingsstart erzeugt einen eigenen gespeicherten Versuch.",
    detail:
      "Ein Run behält seine Daten, Architektur, Einstellungen und Ergebnisse. Änderungen am geöffneten Experiment ändern frühere Runs nicht. Speichere denselben Versuch mit einer anderen Lernrate und starte erneut, um beide Runs zu vergleichen.",
  },
} as const;

export const explanations = new Proxy(source, {
  get(target, key: keyof typeof source) {
    const entry = target[key];
    return (
      entry && {
        title: t(entry.title),
        short: t(entry.short),
        detail: t(entry.detail),
      }
    );
  },
});
export type HelpTopic = keyof typeof explanations;
