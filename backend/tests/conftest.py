import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        yield client


@pytest.fixture
def definition():
    kinds = ["input", "dense", "tanh", "dense", "binary_output"]
    return {
        "name": "XOR reference",
        "model": {
            "schema_version": 1,
            "name": "Reference network",
            "nodes": [
                {
                    "id": f"n{i}",
                    "type": kind,
                    "parameters": {"features": 2}
                    if kind == "input"
                    else {"units": 8 if i == 1 else 1}
                    if kind == "dense"
                    else {},
                }
                for i, kind in enumerate(kinds)
            ],
            "edges": [{"source": f"n{i}", "target": f"n{i + 1}"} for i in range(4)],
        },
        "dataset": {"type": "xor"},
        "training": {"epochs": 300, "learning_rate": 0.5, "seed": 42, "checkpoint_interval": 15},
    }
