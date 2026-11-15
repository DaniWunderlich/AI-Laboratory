import { t } from "./i18n";
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import type { Dataset, Metric } from "./types";
import { usePreferences } from "./preferences";

echarts.use([
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export function Chart({
  option,
  onPoint,
  label,
  height = 240,
}: {
  option: EChartsOption;
  onPoint?: (index: number) => void;
  label: string;
  height?: number | string;
}) {
  const theme = usePreferences((state) => state.theme);
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<ReturnType<typeof echarts.init> | null>(null);
  const pointHandler = useRef(onPoint);
  pointHandler.current = onPoint;

  useEffect(() => {
    const container = element.current!;
    const chart = echarts.init(container);
    instance.current = chart;
    chart.on("click", (params) => {
      const data = params.data as { sampleIndex?: number };
      if (data.sampleIndex !== undefined)
        pointHandler.current?.(data.sampleIndex);
    });
    const observer = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (
        width > 0 &&
        height > 0 &&
        (chart.getWidth() !== width || chart.getHeight() !== height)
      )
        chart.resize({ width, height });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      instance.current = null;
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--ink").trim();
    const muted = css.getPropertyValue("--muted").trim();
    const grid = css.getPropertyValue("--chart-grid").trim();
    const axis = (value: unknown) => ({
      ...(value as object),
      axisLabel: { hideOverlap: true, color: muted },
      axisLine: { lineStyle: { color: muted } },
      splitLine: { lineStyle: { color: grid } },
    });
    instance.current?.setOption(
      {
        ...option,
        color: [
          css.getPropertyValue("--class-zero").trim(),
          css.getPropertyValue("--class-one").trim(),
          "#9e83ce",
          "#c1a35e",
        ],
        textStyle: { ...option.textStyle, color: ink },
        legend: {
          ...(option.legend as object),
          textStyle: { color: muted, fontSize: 10 },
        },
        tooltip: {
          ...(option.tooltip as object),
          backgroundColor: css.getPropertyValue("--panel").trim(),
          borderColor: grid,
          textStyle: { color: ink },
        },
        xAxis: axis(option.xAxis),
        yAxis: axis(option.yAxis),
      },
      { notMerge: true },
    );
  }, [option, theme]);

  return (
    <div
      ref={element}
      role="img"
      aria-label={label}
      // A percentage height inside auto-sized grid rows lets the canvas grow its own parent.
      style={{ width: "100%", height, minWidth: 0 }}
    />
  );
}

const base = {
  animation: false,
  color: ["#15765a", "#c97535", "#799d8d", "#e4b894"],
  textStyle: { fontFamily: "system-ui", fontSize: 11 },
  tooltip: { trigger: "axis" },
  grid: { left: 52, right: 25, top: 36, bottom: 36 },
  legend: { top: 0, textStyle: { fontSize: 10 } },
} satisfies EChartsOption;
function chartColor(variable: string, fallback: string) {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim() || fallback
  );
}

export function metricOption(
  metrics: Metric[],
  comparison?: Metric[],
  accuracy = false,
): EChartsOption {
  const series = [
    {
      name: accuracy ? "Training Accuracy" : "Training Loss",
      values: metrics,
      key: accuracy ? "training_accuracy" : "training_loss",
    },
    {
      name: accuracy ? "Validation Accuracy" : "Validation Loss",
      values: metrics,
      key: accuracy ? "validation_accuracy" : "validation_loss",
    },
    ...(comparison
      ? [
          {
            name: t("Vergleich · Training"),
            values: comparison,
            key: accuracy ? "training_accuracy" : "training_loss",
          },
          {
            name: t("Vergleich · Validation"),
            values: comparison,
            key: accuracy ? "validation_accuracy" : "validation_loss",
          },
        ]
      : []),
  ];
  return {
    ...base,
    xAxis: {
      type: "value",
      name: t("Epoche"),
      nameLocation: "middle",
      nameGap: 24,
      minInterval: 1,
      axisLabel: { hideOverlap: true },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: accuracy ? 1 : undefined,
      axisLabel: { hideOverlap: true },
    },
    series: series
      .filter((s) => s.values.some((v) => v[s.key as keyof Metric] !== null))
      .map((s) => ({
        name: s.name,
        type: "line",
        showSymbol: false,
        lineStyle: { width: 2 },
        data: s.values.map((m) => [m.epoch, m[s.key as keyof Metric]]),
      })),
  };
}

export function bounds(dataset: Dataset): [number, number, number, number] {
  const xs = dataset.points.map((p) => p[0]),
    ys = dataset.points.map((p) => p[1]);
  return [
    Math.min(...xs) - 0.4,
    Math.max(...xs) + 0.4,
    Math.min(...ys) - 0.4,
    Math.max(...ys) + 0.4,
  ];
}

export function dataOption(
  dataset: Dataset,
  boundary?: number[][],
): EChartsOption {
  const [xmin, xmax, ymin, ymax] = bounds(dataset);
  const trainSet = new Set(dataset.train);
  return {
    ...base,
    tooltip: { trigger: "item" },
    legend: { type: "scroll", top: 0, textStyle: { fontSize: 10 } },
    xAxis: {
      type: "value",
      min: xmin,
      max: xmax,
      name: "x₁",
      axisLabel: { hideOverlap: true },
    },
    yAxis: {
      type: "value",
      min: ymin,
      max: ymax,
      name: "x₂",
      nameLocation: "middle",
      nameGap: 30,
      axisLabel: { hideOverlap: true },
    },
    visualMap: boundary
      ? {
          show: false,
          min: 0,
          max: 1,
          dimension: 2,
          seriesIndex: 0,
          inRange: {
            color: [
              chartColor("--class-zero-soft", "#c5e2f3"),
              chartColor("--panel", "#fff"),
              chartColor("--class-one-soft", "#f2d7c3"),
            ],
          },
        }
      : undefined,
    series: [
      ...(boundary
        ? [
            {
              type: "scatter" as const,
              name: t("P(Klasse 1)"),
              data: boundary,
              symbol: "rect",
              symbolSize: 12,
              silent: true,
              itemStyle: { opacity: 0.7 },
              z: 0,
            },
          ]
        : []),
      ...[0, 1].flatMap((target) =>
        (dataset.test.length ? [true, false] : [true]).map((training) => ({
          name: `${target} · ${training ? "Training" : "Validation"}`,
          type: "scatter" as const,
          symbol: training ? "circle" : "diamond",
          symbolSize: dataset.points.length < 10 ? 15 : 7,
          data: dataset.points.flatMap((point, index) =>
            dataset.targets[index] === target &&
            trainSet.has(index) === training
              ? [{ value: point, sampleIndex: index }]
              : [],
          ),
          itemStyle: {
            color:
              target === 0
                ? chartColor("--class-zero", "#258ac1")
                : chartColor("--class-one", "#d87634"),
            borderColor: chartColor("--panel", "#fff"),
            borderWidth: 1,
          },
          z: 2,
        })),
      ),
    ],
  };
}
