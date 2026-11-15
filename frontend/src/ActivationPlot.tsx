import { t } from "./i18n";
import type { NodeKind } from "./types";
import styles from "./Node.module.css";

export function ActivationPlot({ kind }: { kind: NodeKind }) {
  if (!["relu", "tanh", "sigmoid"].includes(kind)) return null;
  const ymin = kind === "tanh" ? -1.25 : -0.2;
  const ymax = kind === "relu" ? 4.4 : 1.25;
  const x = (value: number) => 23 + ((value + 4) / 8) * 176;
  const y = (value: number) => 68 - ((value - ymin) / (ymax - ymin)) * 58;
  const points = Array.from({ length: 81 }, (_, i) => {
    const input = -4 + i / 10;
    const output =
      kind === "relu"
        ? Math.max(0, input)
        : kind === "tanh"
          ? Math.tanh(input)
          : 1 / (1 + Math.exp(-input));
    return `${x(input)},${y(output)}`;
  }).join(" ");
  return (
    <svg
      className={styles.plot}
      viewBox="0 0 220 88"
      role="img"
      aria-label={t`Funktionskurve ${kind === "relu" ? "ReLU" : kind === "tanh" ? "Tanh" : "Sigmoid"}: Eingang x, Ausgang y`}
    >
      <path
        d={`M23 ${y(0)}H200M${x(0)} 7V71`}
        stroke="var(--line)"
        strokeWidth="1"
        fill="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
      />
      <g fill="var(--muted)" fontSize="8">
        <text x="6" y="13">
          y
        </text>
        <text x="204" y={y(0) + 3}>
          x
        </text>
        <text x="21" y="82">
          −4
        </text>
        <text x="109" y="82">
          0
        </text>
        <text x="192" y="82">
          4
        </text>
        <text x="12" y={y(1) + 3}>
          1
        </text>
        {kind === "tanh" && (
          <text x="7" y={y(-1) + 3}>
            −1
          </text>
        )}
      </g>
    </svg>
  );
}
