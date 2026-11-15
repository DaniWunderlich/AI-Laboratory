"""Versioned domain schemas, independent of the graph editor."""

import os
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, model_validator

MAX_PARAMETERS = int(os.getenv("LAB_MAX_PARAMETERS", "5000"))
MAX_HIDDEN_LAYERS = int(os.getenv("LAB_MAX_HIDDEN_LAYERS", "6"))
MAX_UNITS = int(os.getenv("LAB_MAX_UNITS", "64"))
MAX_EPOCHS = int(os.getenv("LAB_MAX_EPOCHS", "10000"))
MAX_POINTS = int(os.getenv("LAB_MAX_POINTS", "10000"))
MAX_CHECKPOINTS = int(os.getenv("LAB_MAX_CHECKPOINTS", "200"))


class Schema(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Node(Schema):
    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")
    type: str = Field(max_length=40)
    parameters: dict[str, StrictInt] = Field(default_factory=dict, max_length=4)


class Edge(Schema):
    source: str
    target: str


class ModelDefinition(Schema):
    schema_version: Literal[1] = 1
    name: str = Field(default="Untitled network", min_length=1, max_length=120)
    nodes: list[Node] = Field(min_length=1, max_length=32)
    edges: list[Edge] = Field(max_length=32)


class DatasetConfig(Schema):
    type: Literal["xor", "moons", "circles"] = "xor"
    samples: int = Field(default=200, ge=20, le=MAX_POINTS)
    noise: float = Field(default=0.1, ge=0, le=0.5)
    seed: int = Field(default=42, ge=0, le=2147483647)
    test_size: float = Field(default=0.2, ge=0.1, le=0.4)


class TrainingConfig(Schema):
    optimizer: Literal["sgd"] = "sgd"
    learning_rate: float = Field(default=0.5, gt=0, le=5)
    epochs: int = Field(default=300, ge=1, le=MAX_EPOCHS)
    batch_size: int = Field(default=32, ge=1, le=MAX_POINTS)
    seed: int = Field(default=42, ge=0, le=2147483647)
    checkpoint_interval: int = Field(default=15, ge=1, le=MAX_EPOCHS)

    @model_validator(mode="after")
    def checkpoint_budget(self):
        if (self.epochs - 1) // self.checkpoint_interval > MAX_CHECKPOINTS:
            raise ValueError(f"At most {MAX_CHECKPOINTS} regular checkpoints are allowed.")
        return self


class Position(Schema):
    x: float
    y: float


class ExperimentInput(Schema):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    model: ModelDefinition
    dataset: DatasetConfig = Field(default_factory=DatasetConfig)
    training: TrainingConfig = Field(default_factory=TrainingConfig)
    layout: dict[str, Position] = Field(default_factory=dict, max_length=32)


class PredictRequest(Schema):
    epoch: int = Field(ge=0)
    points: list[list[Annotated[float, Field(ge=-10, le=10)]]] = Field(
        min_length=1, max_length=2500
    )


class InspectRequest(Schema):
    epoch: int = Field(ge=0)
    point: list[Annotated[float, Field(ge=-10, le=10)]] = Field(min_length=2, max_length=2)
    target: Literal[0, 1] = 0
    type: Literal["forward", "backward", "neuron", "weight_update"] = "forward"
    node_id: str | None = None
    neuron: int = Field(default=0, ge=0, lt=MAX_UNITS)
