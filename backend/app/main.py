import asyncio
import importlib.metadata
import json
import os
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock
from uuid import uuid4

import torch
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.datasets import preview
from app.graph import REGISTRY, validate
from app.inspection import inspect, load_model
from app.persistence import Store, experiments, now, runs
from app.schemas import (
    MAX_CHECKPOINTS,
    MAX_EPOCHS,
    MAX_POINTS,
    DatasetConfig,
    ExperimentInput,
    InspectRequest,
    ModelDefinition,
    PredictRequest,
)

TERMINAL = {"COMPLETED", "CANCELLED", "FAILED"}


def create_app(data_directory=None):
    store = Store(data_directory or os.getenv("LAB_DATA_DIR", "data"))
    processes = {}
    lock = Lock()

    def reconcile():
        with lock:
            for run_id, process in list(processes.items()):
                if process.poll() is not None:
                    run = store.one(runs, run_id)
                    if run and run["status"] not in TERMINAL:
                        store.finish(run_id, "FAILED", "Training process exited unexpectedly.")
                    del processes[run_id]

    async def monitor():
        while True:
            await asyncio.sleep(0.5)
            await asyncio.to_thread(reconcile)

    @asynccontextmanager
    async def lifespan(app):
        store.migrate()
        with store.engine.begin() as connection:
            connection.execute(
                runs.update()
                .where(runs.c.active_slot == 1)
                .values(
                    status="FAILED",
                    active_slot=None,
                    finished_at=now(),
                    error_message="Interrupted by backend restart.",
                )
            )
        task = asyncio.create_task(monitor())
        yield
        task.cancel()
        with lock:
            for run_id, process in processes.items():
                with store.engine.begin() as connection:
                    connection.execute(
                        runs.update().where(runs.c.id == run_id).values(cancel_requested=True)
                    )
                try:
                    await asyncio.to_thread(process.wait, 5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    await asyncio.to_thread(process.wait)
                    store.finish(run_id, "CANCELLED", "Stopped during backend shutdown.")
        store.engine.dispose()

    app = FastAPI(
        title="AI Laboratory",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.state.store = store
    api = APIRouter(prefix="/api/v1")

    @app.exception_handler(HTTPException)
    async def http_error(_, exc):
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})

    @app.exception_handler(RequestValidationError)
    async def validation_error(_, exc):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "message": "Invalid request.",
                    "details": [
                        {"location": list(error["loc"]), "message": error["msg"]}
                        for error in exc.errors()
                    ],
                }
            },
        )

    def resource(table, resource_id):
        result = store.one(table, resource_id)
        if not result:
            raise HTTPException(404, "Resource not found.")
        return result

    def require_valid(definition):
        report = validate(definition)
        if not report["valid"]:
            raise HTTPException(422, report)
        return report

    @app.get("/healthz/ready")
    def health():
        with store.engine.connect() as connection:
            connection.execute(select(experiments.c.id).limit(1))
        return {"status": "ready", "database": "sqlite", "device": "cpu", "version": "0.1.0"}

    @api.get("/nodes")
    def catalog():
        return [{"type": key, **value} for key, value in REGISTRY.items()]

    @api.get("/capabilities")
    def capabilities():
        return {
            "max_epochs": MAX_EPOCHS,
            "max_checkpoints": MAX_CHECKPOINTS,
            "max_points": MAX_POINTS,
        }

    @api.post("/models/validate")
    def validate_model(definition: ModelDefinition):
        return validate(definition)

    @api.get("/datasets")
    def datasets():
        return ["xor", "moons", "circles"]

    @api.post("/datasets/generate")
    def generate_dataset(config: DatasetConfig):
        return preview(config)

    @api.get("/experiments")
    def list_experiments():
        with store.engine.connect() as connection:
            return [
                dict(row)
                for row in connection.execute(
                    experiments.select().order_by(experiments.c.updated_at.desc())
                ).mappings()
            ]

    @api.post("/experiments", status_code=201)
    def create_experiment(definition: ExperimentInput):
        experiment_id = str(uuid4())
        with store.engine.begin() as connection:
            connection.execute(
                experiments.insert().values(
                    id=experiment_id,
                    name=definition.name,
                    definition=definition.model_dump(),
                    created_at=now(),
                    updated_at=now(),
                )
            )
        return resource(experiments, experiment_id)

    @api.get("/experiments/{experiment_id}")
    def get_experiment(experiment_id: str):
        return resource(experiments, experiment_id)

    @api.put("/experiments/{experiment_id}")
    def update_experiment(experiment_id: str, definition: ExperimentInput):
        resource(experiments, experiment_id)
        with store.engine.begin() as connection:
            connection.execute(
                experiments.update()
                .where(experiments.c.id == experiment_id)
                .values(
                    name=definition.name,
                    definition=definition.model_dump(),
                    updated_at=now(),
                )
            )
        return resource(experiments, experiment_id)

    @api.delete("/experiments/{experiment_id}", status_code=204)
    def delete_experiment(experiment_id: str):
        resource(experiments, experiment_id)
        with lock, store.engine.begin() as connection:
            active = connection.execute(
                select(runs.c.id).where(
                    runs.c.experiment_id == experiment_id, runs.c.active_slot == 1
                )
            ).first()
            if active:
                raise HTTPException(
                    409, "Cancel the active training before deleting this experiment."
                )
            # Artifacts are retained locally; no recursive filesystem deletion in API requests.
            connection.execute(experiments.delete().where(experiments.c.id == experiment_id))

    @api.get("/experiments/{experiment_id}/runs")
    def list_runs(experiment_id: str):
        resource(experiments, experiment_id)
        with store.engine.connect() as connection:
            return [
                dict(row)
                for row in connection.execute(
                    runs.select()
                    .where(runs.c.experiment_id == experiment_id)
                    .order_by(runs.c.started_at.desc())
                ).mappings()
            ]

    @api.post("/experiments/{experiment_id}/runs", status_code=201)
    def start_run(experiment_id: str):
        experiment = resource(experiments, experiment_id)
        snapshot = ExperimentInput.model_validate(experiment["definition"])
        require_valid(snapshot.model)
        run_id = str(uuid4())
        versions = {
            key: importlib.metadata.version(key)
            for key in ("torch", "numpy", "scikit-learn", "fastapi")
        }
        versions["python"] = sys.version.split()[0]
        with lock:
            try:
                with store.engine.begin() as connection:
                    connection.execute(
                        runs.insert().values(
                            id=run_id,
                            experiment_id=experiment_id,
                            snapshot=snapshot.model_dump(),
                            versions=versions,
                            status="VALIDATING",
                            active_slot=1,
                            cancel_requested=False,
                            started_at=now(),
                        )
                    )
            except IntegrityError:
                raise HTTPException(
                    409, "A training job is already active. Wait or cancel it."
                ) from None
            try:
                processes[run_id] = subprocess.Popen(
                    [
                        sys.executable,
                        "-m",
                        "app.worker",
                        "--data",
                        str(store.directory),
                        "--run",
                        run_id,
                    ],
                    cwd=Path(__file__).parents[1],
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
                )
            except OSError as exc:
                store.finish(run_id, "FAILED", str(exc))
                raise HTTPException(500, "Could not start the training process.") from exc
        return resource(runs, run_id)

    @api.get("/runs/{run_id}")
    def get_run(run_id: str):
        return resource(runs, run_id)

    @api.post("/runs/{run_id}/cancel")
    def cancel_run(run_id: str):
        run = resource(runs, run_id)
        if run["status"] not in TERMINAL:
            with store.engine.begin() as connection:
                connection.execute(
                    runs.update().where(runs.c.id == run_id).values(cancel_requested=True)
                )
        return resource(runs, run_id)

    @api.get("/runs/{run_id}/metrics")
    def get_metrics(run_id: str):
        resource(runs, run_id)
        return store.run_metrics(run_id)

    @api.get("/runs/{run_id}/checkpoints")
    def get_checkpoints(run_id: str):
        resource(runs, run_id)
        return store.run_checkpoints(run_id)

    @api.get("/runs/{run_id}/events")
    def events(run_id: str):
        resource(runs, run_id)

        async def stream():
            # Every update is a durable snapshot, so reconnects also recover missed metrics.
            previous = None
            while True:
                run = await asyncio.to_thread(resource, runs, run_id)
                payload = {
                    "run": run,
                    "metrics": await asyncio.to_thread(store.run_metrics, run_id),
                    "checkpoints": await asyncio.to_thread(store.run_checkpoints, run_id),
                }
                serialized = json.dumps(payload)
                if serialized != previous:
                    yield f"event: update\ndata: {serialized}\n\n"
                    previous = serialized
                else:
                    yield ": heartbeat\n\n"
                if run["status"] in TERMINAL:
                    return
                await asyncio.sleep(0.3)

        return StreamingResponse(
            stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    @api.post("/runs/{run_id}/predict")
    def predict(run_id: str, request: PredictRequest):
        run = resource(runs, run_id)
        if any(len(point) != 2 for point in request.points):
            raise HTTPException(422, "Every point needs exactly two features.")
        try:
            model, _ = load_model(store, run, request.epoch)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from exc
        with torch.no_grad():
            probabilities = torch.sigmoid(model(torch.tensor(request.points))).flatten().tolist()
        return {"epoch": request.epoch, "probabilities": probabilities}

    @api.post("/runs/{run_id}/inspect")
    def inspect_run(run_id: str, request: InspectRequest):
        try:
            return inspect(store, resource(runs, run_id), request)
        except LookupError as exc:
            raise HTTPException(404, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    app.include_router(api)
    return app


app = create_app()
