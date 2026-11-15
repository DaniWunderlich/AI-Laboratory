import numpy as np
from sklearn.datasets import make_circles, make_moons
from sklearn.model_selection import train_test_split

from app.schemas import DatasetConfig


def generate(config: DatasetConfig):
    if config.type == "xor":
        x = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=np.float32)
        y = np.array([0, 1, 1, 0], dtype=np.float32)
        train, test = np.arange(4), np.array([], dtype=int)
    else:
        generator = make_moons if config.type == "moons" else make_circles
        x, y = generator(n_samples=config.samples, noise=config.noise, random_state=config.seed)
        x, y = x.astype(np.float32), y.astype(np.float32)
        train, test = train_test_split(
            np.arange(len(y)), test_size=config.test_size, stratify=y, random_state=config.seed
        )
    return x, y, train, test


def preview(config: DatasetConfig):
    x, y, train, test = generate(config)
    return {
        "points": x.tolist(),
        "targets": y.tolist(),
        "train": train.tolist(),
        "test": test.tolist(),
        "config": config.model_dump(),
    }
