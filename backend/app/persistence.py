"""SQLite persistence shared by the API and the separate training process."""

from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    UniqueConstraint,
    create_engine,
    event,
)

metadata = MetaData()
experiments = Table(
    "experiments",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("definition", JSON, nullable=False),
    Column("created_at", String, nullable=False),
    Column("updated_at", String, nullable=False),
)
runs = Table(
    "training_runs",
    metadata,
    Column("id", String, primary_key=True),
    Column("experiment_id", ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False),
    Column("snapshot", JSON, nullable=False),
    Column("versions", JSON, nullable=False),
    Column("status", String, nullable=False),
    Column("active_slot", Integer, unique=True),
    Column("cancel_requested", Boolean, nullable=False, default=False),
    Column("started_at", String, nullable=False),
    Column("finished_at", String),
    Column("error_message", String),
)
metrics = Table(
    "training_metrics",
    metadata,
    Column("run_id", ForeignKey("training_runs.id", ondelete="CASCADE"), primary_key=True),
    Column("epoch", Integer, primary_key=True),
    Column("training_loss", Float, nullable=False),
    Column("training_accuracy", Float, nullable=False),
    Column("validation_loss", Float),
    Column("validation_accuracy", Float),
    Column("learning_rate", Float, nullable=False),
    Column("epoch_duration_ms", Float, nullable=False),
)
checkpoints = Table(
    "checkpoints",
    metadata,
    Column("id", String, primary_key=True),
    Column("run_id", ForeignKey("training_runs.id", ondelete="CASCADE"), nullable=False),
    Column("epoch", Integer, nullable=False),
    Column("artifact_path", String, nullable=False),
    Column("created_at", String, nullable=False),
    UniqueConstraint("run_id", "epoch"),
)


def now():
    return datetime.now(UTC).isoformat()


class Store:
    def __init__(self, directory: str | Path):
        self.directory = Path(directory).resolve()
        self.directory.mkdir(parents=True, exist_ok=True)
        self.engine = create_engine(
            f"sqlite:///{self.directory / 'laboratory.db'}",
            connect_args={"check_same_thread": False, "timeout": 20},
        )

        @event.listens_for(self.engine, "connect")
        def configure(dbapi_connection, _):
            dbapi_connection.execute("PRAGMA foreign_keys=ON")
            dbapi_connection.execute("PRAGMA journal_mode=WAL")

    def migrate(self):
        from alembic import command
        from alembic.config import Config

        config = Config()
        config.set_main_option("script_location", str(Path(__file__).parents[1] / "migrations"))
        with self.engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")

    def one(self, table, resource_id):
        with self.engine.connect() as connection:
            row = (
                connection.execute(table.select().where(table.c.id == resource_id))
                .mappings()
                .first()
            )
            return dict(row) if row else None

    def run_metrics(self, run_id):
        with self.engine.connect() as connection:
            return [
                dict(row)
                for row in connection.execute(
                    metrics.select().where(metrics.c.run_id == run_id).order_by(metrics.c.epoch)
                ).mappings()
            ]

    def run_checkpoints(self, run_id):
        with self.engine.connect() as connection:
            return [
                dict(row)
                for row in connection.execute(
                    checkpoints.select()
                    .where(checkpoints.c.run_id == run_id)
                    .order_by(checkpoints.c.epoch)
                ).mappings()
            ]

    def finish(self, run_id, status, message=None):
        with self.engine.begin() as connection:
            connection.execute(
                runs.update()
                .where(runs.c.id == run_id)
                .values(status=status, active_slot=None, finished_at=now(), error_message=message)
            )
