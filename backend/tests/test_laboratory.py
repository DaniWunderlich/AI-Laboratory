import hashlib
import time

import numpy as np
import pytest
import torch
from fastapi.testclient import TestClient

from app.datasets import generate
from app.graph import CompiledModel
from app.main import create_app
from app.persistence import runs
from app.schemas import (
    MAX_CHECKPOINTS,
    MAX_EPOCHS,
    MAX_POINTS,
    DatasetConfig,
    ModelDefinition,
    TrainingConfig,
)


def await_finished(client, run_id):
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        run = client.get(f"/api/v1/runs/{run_id}").json()
        if run["status"] in {"COMPLETED", "CANCELLED", "FAILED"}:
            return run
        time.sleep(0.1)
    pytest.fail("Training did not terminate within 45 seconds")


def start(client, definition):
    saved = client.post("/api/v1/experiments", json=definition)
    assert saved.status_code == 201, saved.text
    response = client.post(f"/api/v1/experiments/{saved.json()['id']}/runs")
    assert response.status_code == 201, response.text
    return saved.json(), response.json()


def test_full_xor_experiment_training_inspection_and_reopen(client, definition):
    assert client.get("/healthz/ready").json()["status"] == "ready"
    assert len(client.get("/api/v1/nodes").json()) == 6
    saved, run = start(client, definition)
    run_id = run["id"]
    completed = await_finished(client, run_id)
    assert completed["status"] == "COMPLETED", completed
    assert completed["versions"]["torch"]
    metrics = client.get(f"/api/v1/runs/{run_id}/metrics").json()
    assert len(metrics) == 300
    assert metrics[-1]["training_accuracy"] == 1
    assert metrics[-1]["training_loss"] < 0.1
    assert metrics[-1]["validation_loss"] is None
    checkpoints = client.get(f"/api/v1/runs/{run_id}/checkpoints").json()
    assert checkpoints[0]["epoch"] == 0
    assert checkpoints[-1]["epoch"] == 300
    assert len(checkpoints) <= 22
    initial = client.post(
        f"/api/v1/runs/{run_id}/predict",
        json={
            "epoch": 0,
            "points": [[0, 0], [0, 1], [1, 0], [1, 1]],
        },
    ).json()
    final = client.post(
        f"/api/v1/runs/{run_id}/predict",
        json={
            "epoch": 300,
            "points": [[0, 0], [0, 1], [1, 0], [1, 1]],
        },
    ).json()
    assert [int(p >= 0.5) for p in final["probabilities"]] == [0, 1, 1, 0]
    assert initial != final
    artifact = next((client.app.state.store.directory / "artifacts" / run_id).glob("*0300.npz"))
    before = hashlib.sha256(artifact.read_bytes()).hexdigest()
    inspection = client.post(
        f"/api/v1/runs/{run_id}/inspect",
        json={
            "epoch": 300,
            "point": [0, 1],
            "target": 1,
            "type": "weight_update",
            "node_id": "n1",
            "neuron": 0,
        },
    )
    assert inspection.status_code == 200, inspection.text
    result = inspection.json()
    assert len(result["steps"]) == 5
    assert result["probability"] == pytest.approx(final["probabilities"][1], abs=1e-6)
    neuron = result["neuron"]
    assert sum(neuron["products"]) + neuron["bias"] == pytest.approx(neuron["linear_output"])
    dense = result["steps"][1]
    w, grad, updated = (
        dense["weights"][0][0],
        dense["weight_gradient"][0][0],
        dense["hypothetical_weights"][0][0],
    )
    assert updated == pytest.approx(w - 0.5 * grad, abs=1e-6)
    # Independently reconstruct the checkpoint and compare the actual Autograd gradient.
    model = CompiledModel(ModelDefinition.model_validate(definition["model"]))
    with np.load(artifact, allow_pickle=False) as arrays:
        model.load_state_dict({key: torch.from_numpy(arrays[key]) for key in arrays.files})
    torch.nn.BCEWithLogitsLoss()(
        model(torch.tensor([[0.0, 1.0]])), torch.tensor([[1.0]])
    ).backward()
    assert grad == pytest.approx(model.layers["node_n1"].weight.grad[0, 0].item())
    assert hashlib.sha256(artifact.read_bytes()).hexdigest() == before
    assert (
        client.post(
            f"/api/v1/runs/{run_id}/predict", json={"epoch": 1, "points": [[0, 0]]}
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/runs/{run_id}/predict", json={"epoch": 0, "points": [[0]]}
        ).status_code
        == 422
    )
    definition["model"]["nodes"][1]["parameters"]["units"] = 4
    assert client.put(f"/api/v1/experiments/{saved['id']}", json=definition).status_code == 200
    assert (
        client.get(f"/api/v1/runs/{run_id}").json()["snapshot"]["model"]["nodes"][1]["parameters"][
            "units"
        ]
        == 8
    )
    reopened = client.get(f"/api/v1/experiments/{saved['id']}").json()
    assert reopened["definition"]["model"]["nodes"][1]["parameters"]["units"] == 4
    with client.stream("GET", f"/api/v1/runs/{run_id}/events") as stream:
        stream.read()
        assert "event: update" in stream.text
        assert "COMPLETED" in stream.text
    assert client.delete(f"/api/v1/experiments/{saved['id']}").status_code == 204
    assert client.get(f"/api/v1/runs/{run_id}").status_code == 404


def test_cancellation_and_single_job_limit(client, definition):
    definition["dataset"] = {"type": "moons", "samples": 1000}
    definition["training"]["batch_size"] = 1
    saved, run = start(client, definition)
    assert client.post(f"/api/v1/experiments/{saved['id']}/runs").status_code == 409
    assert client.delete(f"/api/v1/experiments/{saved['id']}").status_code == 409
    response = client.post(f"/api/v1/runs/{run['id']}/cancel")
    assert response.status_code == 200
    assert await_finished(client, run["id"])["status"] == "CANCELLED"
    assert client.get(f"/api/v1/runs/{run['id']}/checkpoints").json()[0]["epoch"] == 0
    next_run = client.post(f"/api/v1/experiments/{saved['id']}/runs").json()
    client.post(f"/api/v1/runs/{next_run['id']}/cancel")
    assert await_finished(client, next_run["id"])["status"] == "CANCELLED"


@pytest.mark.parametrize("kind", ["moons", "circles"])
def test_reproducible_stratified_datasets(kind):
    config = DatasetConfig(type=kind)
    x, y, train, test = generate(config)
    x2, y2, train2, test2 = generate(config)
    assert np.array_equal(x, x2) and np.array_equal(y, y2)
    assert np.array_equal(train, train2) and np.array_equal(test, test2)
    assert len(test) == 40 and len(train) == 160
    assert not set(train) & set(test)
    assert y[test].mean() == 0.5


def test_invalid_models_and_budgets_cannot_start(client, definition):
    definition["model"]["nodes"][1]["parameters"]["units"] = 100
    saved = client.post("/api/v1/experiments", json=definition).json()
    assert client.post(f"/api/v1/experiments/{saved['id']}/runs").status_code == 422
    definition["training"]["epochs"] = MAX_EPOCHS + 1
    assert client.post("/api/v1/experiments", json=definition).status_code == 422
    definition["training"]["epochs"] = 300
    definition["training"]["checkpoint_interval"] = 1
    assert client.post("/api/v1/experiments", json=definition).status_code == 422
    definition["model"]["schema_version"] = 2
    assert client.post("/api/v1/models/validate", json=definition["model"]).status_code == 422


def test_extended_training_budget_and_reported_capabilities(client):
    assert client.get("/api/v1/capabilities").json() == {
        "max_epochs": MAX_EPOCHS,
        "max_checkpoints": MAX_CHECKPOINTS,
        "max_points": MAX_POINTS,
    }
    config = TrainingConfig(epochs=1000, checkpoint_interval=10)
    assert config.epochs > 300
    assert (config.epochs - 1) // config.checkpoint_interval > 20
    assert TrainingConfig(epochs=MAX_EPOCHS, checkpoint_interval=MAX_EPOCHS).epochs == MAX_EPOCHS


@pytest.mark.parametrize("kind", ["moons", "circles"])
def test_two_thousand_dataset_points_are_generated_and_reproducible(client, kind):
    config = {"type": kind, "samples": 2000, "seed": 42, "test_size": 0.2}
    response = client.post("/api/v1/datasets/generate", json=config)
    assert response.status_code == 200
    dataset = response.json()
    assert len(dataset["points"]) == len(dataset["targets"]) == 2000
    assert len(dataset["train"]) == 1600
    assert len(dataset["test"]) == 400
    assert set(dataset["train"]).isdisjoint(dataset["test"])
    assert client.post("/api/v1/datasets/generate", json=config).json() == dataset


def test_more_than_300_epochs_and_20_checkpoints_execute(client, definition):
    definition["training"].update(epochs=600, checkpoint_interval=10)
    _, run = start(client, definition)
    assert await_finished(client, run["id"])["status"] == "COMPLETED"
    assert client.get(f"/api/v1/runs/{run['id']}/metrics").json()[-1]["epoch"] == 600
    checkpoints = client.get(f"/api/v1/runs/{run['id']}/checkpoints").json()
    assert len(checkpoints) == 61
    assert checkpoints[0]["epoch"] == 0 and checkpoints[-1]["epoch"] == 600


def test_validation_errors_use_common_envelope_and_api_docs_are_reachable(client):
    response = client.post("/api/v1/datasets/generate", json={"samples": MAX_POINTS + 1})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["location"] == ["body", "samples"]
    assert client.get("/api/docs").status_code == 200
    assert "/api/v1/models/validate" in client.get("/api/openapi.json").json()["paths"]


def test_training_process_spawn_failure_releases_job_slot(client, definition, monkeypatch):
    import app.main

    def fail(*args, **kwargs):
        raise OSError("test process could not be started")

    monkeypatch.setattr(app.main.subprocess, "Popen", fail)
    saved = client.post("/api/v1/experiments", json=definition).json()
    response = client.post(f"/api/v1/experiments/{saved['id']}/runs")
    assert response.status_code == 500
    history = client.get(f"/api/v1/experiments/{saved['id']}/runs").json()
    assert history[0]["status"] == "FAILED"
    assert history[0]["active_slot"] is None


def test_restart_preserves_experiments_and_fails_orphaned_runs(tmp_path, definition):
    with TestClient(create_app(tmp_path)) as client:
        saved = client.post("/api/v1/experiments", json=definition).json()
        with client.app.state.store.engine.begin() as connection:
            connection.execute(
                runs.insert().values(
                    id="orphan",
                    experiment_id=saved["id"],
                    snapshot=definition,
                    versions={},
                    status="RUNNING",
                    active_slot=1,
                    cancel_requested=False,
                    started_at="2026-11-13",
                )
            )
    with TestClient(create_app(tmp_path)) as client:
        assert client.get(f"/api/v1/experiments/{saved['id']}").status_code == 200
        run = client.get("/api/v1/runs/orphan").json()
        assert run["status"] == "FAILED"
        assert run["active_slot"] is None


def test_linear_perceptron_does_not_solve_xor(client, definition):
    definition["model"]["nodes"] = [definition["model"]["nodes"][i] for i in [0, 3, 4]]
    definition["model"]["edges"] = [
        {"source": "n0", "target": "n3"},
        {"source": "n3", "target": "n4"},
    ]
    _, run = start(client, definition)
    assert await_finished(client, run["id"])["status"] == "COMPLETED"
    metrics = client.get(f"/api/v1/runs/{run['id']}/metrics").json()
    assert metrics[-1]["training_accuracy"] < 1
