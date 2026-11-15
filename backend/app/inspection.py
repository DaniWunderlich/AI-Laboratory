"""Read numeric checkpoints and inspect temporary model instances only."""

import numpy as np
import torch
from torch import nn

from app.graph import CompiledModel
from app.schemas import ExperimentInput, InspectRequest


def load_model(store, run, epoch):
    checkpoint = next(
        (item for item in store.run_checkpoints(run["id"]) if item["epoch"] == epoch), None
    )
    if checkpoint is None:
        raise LookupError("No saved weights for this epoch. Select an existing checkpoint.")
    snapshot = ExperimentInput.model_validate(run["snapshot"])
    model = CompiledModel(snapshot.model)
    with np.load(store.directory / checkpoint["artifact_path"], allow_pickle=False) as weights:
        model.load_state_dict({key: torch.from_numpy(weights[key].copy()) for key in weights.files})
    model.eval()
    return model, snapshot


def inspect(store, run, request: InspectRequest):
    model, snapshot = load_model(store, run, request.epoch)
    value = torch.tensor([request.point], requires_grad=True)
    steps = []
    for module_key, layer in model.layers.items():
        key = module_key.removeprefix("node_")
        before = value
        value = layer(value)
        if value is before:
            value = value.clone()
        value.retain_grad()
        steps.append({"node_id": key, "input": before, "output": value, "layer": layer})
    loss = nn.BCEWithLogitsLoss()(value, torch.tensor([[float(request.target)]]))
    loss.backward()
    result = []
    neuron = None
    for step in steps:
        layer = step["layer"]
        item = {
            "node_id": step["node_id"],
            "input": step["input"].detach().tolist()[0],
            "output": step["output"].detach().tolist()[0],
            "output_gradient": step["output"].grad.tolist()[0],
        }
        if isinstance(layer, nn.Linear):
            weights = layer.weight.detach()
            item.update(
                weights=weights.tolist(),
                bias=layer.bias.detach().tolist(),
                weight_gradient=layer.weight.grad.tolist(),
                bias_gradient=layer.bias.grad.tolist(),
                hypothetical_weights=(
                    weights - snapshot.training.learning_rate * layer.weight.grad
                ).tolist(),
            )
            if step["node_id"] == request.node_id:
                if request.neuron >= layer.out_features:
                    raise ValueError("Neuron index is outside the selected layer.")
                i = request.neuron
                neuron = {
                    "node_id": step["node_id"],
                    "index": i,
                    "products": (step["input"][0].detach() * weights[i]).tolist(),
                    "bias": item["bias"][i],
                    "linear_output": item["output"][i],
                }
        result.append(item)
    if request.node_id and not any(item["node_id"] == request.node_id for item in result):
        raise ValueError("Selected node does not belong to this run.")
    return {
        "epoch": request.epoch,
        "point": request.point,
        "target": request.target,
        "probability": torch.sigmoid(value).item(),
        "loss": loss.item(),
        "steps": result,
        "neuron": neuron,
        "learning_rate": snapshot.training.learning_rate,
        "weight_update_note": (
            "Hypothetical SGD step on this single sample; saved weights unchanged."
        ),
    }
