export type NodeKind =
  "input" | "dense" | "relu" | "tanh" | "sigmoid" | "binary_output";
export type ModelNode = {
  id: string;
  type: NodeKind;
  parameters: Record<string, number>;
};
export type Model = {
  schema_version: 1;
  name: string;
  nodes: ModelNode[];
  edges: { source: string; target: string }[];
};
export type DatasetConfig = {
  type: "xor" | "moons" | "circles";
  samples: number;
  noise: number;
  seed: number;
  test_size: number;
};
export type TrainingConfig = {
  optimizer: "sgd";
  learning_rate: number;
  epochs: number;
  batch_size: number;
  seed: number;
  checkpoint_interval: number;
};
export type TrainingLimits = {
  max_epochs: number;
  max_checkpoints: number;
  max_points?: number;
};
export type Experiment = {
  name: string;
  description: string;
  model: Model;
  dataset: DatasetConfig;
  training: TrainingConfig;
  layout: Record<string, { x: number; y: number }>;
};
export type SavedExperiment = {
  id: string;
  name: string;
  definition: Experiment;
  created_at: string;
  updated_at: string;
};
export type Validation = {
  valid: boolean;
  errors: { node_id: string | null; message: string }[];
  shapes: Record<
    string,
    { input: (string | number)[]; output: (string | number)[] }
  >;
  parameter_count: number;
  order: string[];
};
export type Dataset = {
  points: number[][];
  targets: number[];
  train: number[];
  test: number[];
  config: DatasetConfig;
};
export type Run = {
  id: string;
  experiment_id: string;
  status: string;
  snapshot: Experiment;
  versions: Record<string, string>;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  cancel_requested: boolean;
};
export type Metric = {
  epoch: number;
  training_loss: number;
  training_accuracy: number;
  validation_loss: number | null;
  validation_accuracy: number | null;
  epoch_duration_ms: number;
  learning_rate: number;
};
export type Checkpoint = { id: string; epoch: number; run_id: string };
export type TrainingUpdate = {
  run: Run;
  metrics: Metric[];
  checkpoints: Checkpoint[];
};
export type InspectionStep = {
  node_id: string;
  input: number[];
  output: number[];
  output_gradient: number[];
  weights?: number[][];
  bias?: number[];
  weight_gradient?: number[][];
  bias_gradient?: number[];
  hypothetical_weights?: number[][];
};
export type Inspection = {
  epoch: number;
  probability: number;
  loss: number;
  steps: InspectionStep[];
  learning_rate: number;
  weight_update_note: string;
  neuron: {
    index: number;
    products: number[];
    bias: number;
    linear_output: number;
  } | null;
};
export const terminal = (status: string) =>
  ["COMPLETED", "CANCELLED", "FAILED"].includes(status);
