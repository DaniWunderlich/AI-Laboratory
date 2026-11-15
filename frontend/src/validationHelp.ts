import { t } from "./i18n";
const messages: Record<string, string> = {
  "Node IDs must be unique.":
    "Zwei Bausteine haben dieselbe Kennung. Öffne eine Vorlage neu oder entferne den doppelten Baustein.",
  "Unknown node type.":
    "Dieser Baustein wird noch nicht unterstützt. Verwende einen Baustein aus dem Werkzeugkasten.",
  "Unexpected or missing node parameters.":
    "Die Einstellungen dieses Bausteins passen nicht zu seinem Typ. Prüfe seine Eigenschaften oder füge ihn neu hinzu.",
  "Exactly one Input and one Binary Output are required.":
    "Dein Netz braucht genau einen Input als Anfang und einen Binary Output als Ende.",
  "Connection references a missing node.":
    "Eine Verbindung zeigt auf einen entfernten Baustein. Entferne sie und verbinde die vorhandenen Bausteine neu.",
  "Expected exactly one incoming connection (none for Input).":
    "Verbinde diesen Baustein mit genau einem Vorgänger. Nur Input hat keinen Vorgänger.",
  "Expected exactly one outgoing connection (none for Output).":
    "Verbinde diesen Baustein mit genau einem Nachfolger. Nur Binary Output hat keinen Nachfolger.",
  "Cycles are not allowed.":
    "Die Verbindungen bilden einen Kreis. Entferne eine Rückverbindung; die Zahlen sollen vom Input zum Output fließen.",
  "All nodes must belong to one connected, acyclic Input → Output chain.":
    "Verbinde alle Bausteine zu einer einzigen Kette von Input bis Binary Output, ohne Lücken, Abzweigungen oder Kreise.",
  "Binary Output requires exactly one logit. Add Dense(1).":
    "Der Output braucht eine einzige Zahl. Füge davor eine Dense-Schicht mit genau einem Neuron ein.",
  "Use logits: Sigmoid is not allowed directly before Binary Output.":
    "Entferne Sigmoid direkt vor Binary Output. Der Output übernimmt diese Umrechnung bereits selbst.",
  "At least one Dense layer is required.":
    "Füge mindestens eine Dense-Schicht ein. Ihre Gewichte ermöglichen dem Netz das Lernen.",
};

export function validationHelp(message: string) {
  if (messages[message]) return t(messages[message]);
  const range = /^(units|features) must be between (\d+) and (\d+)\.$/.exec(
    message,
  );
  if (range)
    return t`${t(range[1] === "units" ? "Wähle eine Neuronenzahl" : "Wähle eine Anzahl Eingabewerte")} zwischen ${range[2]} und ${range[3]}.`;
  const layers = /^At most (\d+) hidden Dense layers are allowed\.$/.exec(
    message,
  );
  if (layers)
    return t`Verwende höchstens ${layers[1]} versteckte Dense-Schichten. Entferne eine der zusätzlichen Schichten.`;
  const parameters =
    /^Model exceeds the (\d+) trainable parameter limit\.$/.exec(message);
  if (parameters)
    return t`Das Netz hat zu viele lernbare Zahlen. Reduziere Schichten oder Neuronen, bis höchstens ${parameters[1]} Parameter übrig sind.`;
  return message;
}
