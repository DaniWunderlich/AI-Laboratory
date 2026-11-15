"""One bounded CPU training job, executed in its own Python process."""

import argparse
import os
import time
import traceback
from uuid import uuid4

import numpy as np
import torch
from torch import nn

from app.datasets import generate
from app.graph import CompiledModel
from app.persistence import Store, checkpoints, metrics, now, runs
from app.schemas import ExperimentInput


def save_checkpoint(store, run_id, epoch, model):
    directory = store.directory / "artifacts" / run_id
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / f"checkpoint_{epoch:04}.npz"
    temporary = directory / f"checkpoint_{epoch:04}.tmp.npz"
    np.savez(
        temporary, **{key: tensor.detach().numpy() for key, tensor in model.state_dict().items()}
    )
    os.replace(temporary, target)
    with store.engine.begin() as connection:
        connection.execute(
            checkpoints.insert().values(
                id=str(uuid4()),
                run_id=run_id,
                epoch=epoch,
                artifact_path=str(target.relative_to(store.directory)),
                created_at=now(),
            )
        )


def train(store: Store, run_id: str):
    torch.set_num_threads(1)
    try:
        run = store.one(runs, run_id)
        experiment = ExperimentInput.model_validate(run["snapshot"])
        config = experiment.training
        torch.manual_seed(config.seed)
        torch.use_deterministic_algorithms(True)
        model = CompiledModel(experiment.model)
        x, y, train_indices, test_indices = generate(experiment.dataset)
        x, y = torch.from_numpy(x), torch.from_numpy(y).reshape(-1, 1)
        optimizer = torch.optim.SGD(model.parameters(), lr=config.learning_rate)
        criterion = nn.BCEWithLogitsLoss()
        save_checkpoint(store, run_id, 0, model)
        with store.engine.begin() as connection:
            connection.execute(runs.update().where(runs.c.id == run_id).values(status="RUNNING"))
        last_epoch = 0
        for epoch in range(1, config.epochs + 1):
            if store.one(runs, run_id)["cancel_requested"]:
                if last_epoch and last_epoch % config.checkpoint_interval:
                    save_checkpoint(store, run_id, last_epoch, model)
                store.finish(run_id, "CANCELLED")
                return
            started = time.perf_counter()
            permutation = train_indices[torch.randperm(len(train_indices)).numpy()]
            model.train()
            for offset in range(0, len(permutation), config.batch_size):
                indices = permutation[offset : offset + config.batch_size]
                optimizer.zero_grad()
                loss = criterion(model(x[indices]), y[indices])
                if not torch.isfinite(loss):
                    raise ValueError("Training diverged. Try a smaller learning rate.")
                loss.backward()
                optimizer.step()
            model.eval()
            values = {"run_id": run_id, "epoch": epoch, "learning_rate": config.learning_rate}
            with torch.no_grad():
                for label, indices in (("training", train_indices), ("validation", test_indices)):
                    if len(indices):
                        logits = model(x[indices])
                        values[f"{label}_loss"] = criterion(logits, y[indices]).item()
                        values[f"{label}_accuracy"] = (
                            ((logits >= 0) == y[indices].bool()).float().mean().item()
                        )
                if any(
                    not np.isfinite(value) for value in values.values() if isinstance(value, float)
                ):
                    raise ValueError("Non-finite metrics. Try a smaller learning rate.")
            values["epoch_duration_ms"] = (time.perf_counter() - started) * 1000
            with store.engine.begin() as connection:
                connection.execute(metrics.insert().values(**values))
            if epoch % config.checkpoint_interval == 0 or epoch == config.epochs:
                save_checkpoint(store, run_id, epoch, model)
            last_epoch = epoch
        status = "CANCELLED" if store.one(runs, run_id)["cancel_requested"] else "COMPLETED"
        store.finish(run_id, status)
    except Exception as exc:
        traceback.print_exc()
        store.finish(run_id, "FAILED", str(exc)[:1000])
    finally:
        store.engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True)
    parser.add_argument("--run", required=True)
    args = parser.parse_args()
    train(Store(args.data), args.run)
