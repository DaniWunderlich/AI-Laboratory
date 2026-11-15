import { t } from "./i18n";
import { useEffect, useState } from "react";
import { api } from "./api";
import {
  terminal,
  type Checkpoint,
  type Metric,
  type Run,
  type TrainingUpdate,
} from "./types";

export function useRun(id: string | null) {
  const [run, setRun] = useState<Run | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setRun(null);
    setMetrics([]);
    setCheckpoints([]);
    setError("");
    if (!id) return;
    let disposed = false;
    const source = new EventSource(`/api/v1/runs/${id}/events`);
    source.addEventListener("update", (event) => {
      if (disposed) return;
      const update = JSON.parse((event as MessageEvent).data) as TrainingUpdate;
      setRun(update.run);
      setMetrics(update.metrics);
      setCheckpoints(update.checkpoints);
      setError("");
      if (terminal(update.run.status)) source.close();
    });
    source.onerror = () => {
      if (!disposed)
        setError(
          t(
            "Live-Verbindung unterbrochen. Verbindung wird erneut aufgebaut; das Training läuft weiter.",
          ),
        );
    };
    // REST also makes an inaccessible or deleted run visible as an error.
    api<Run>(`/runs/${id}`)
      .then((data) => {
        if (!disposed) setRun(data);
      })
      .catch((e) => {
        if (!disposed) {
          setError(e.message);
          source.close();
        }
      });
    return () => {
      disposed = true;
      source.close();
    };
  }, [id]);
  return { run, metrics, checkpoints, error };
}
