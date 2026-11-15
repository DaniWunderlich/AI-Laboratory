"""Validate linear graphs and compile the exact same definition to PyTorch."""

import torch
from torch import nn

from app.schemas import MAX_HIDDEN_LAYERS, MAX_PARAMETERS, MAX_UNITS, ModelDefinition

REGISTRY = {
    "input": {"label": "Input", "parameter": "features", "min": 2, "max": 2},
    "dense": {"label": "Dense", "parameter": "units", "min": 1, "max": MAX_UNITS},
    "relu": {"label": "ReLU"},
    "tanh": {"label": "Tanh"},
    "sigmoid": {"label": "Sigmoid"},
    "binary_output": {"label": "Binary Output"},
}
ACTIVATIONS = {"relu": nn.ReLU, "tanh": nn.Tanh, "sigmoid": nn.Sigmoid}


def validate(model: ModelDefinition):
    errors = []

    def error(message, node_id=None):
        errors.append({"node_id": node_id, "message": message})

    nodes = {node.id: node for node in model.nodes}
    if len(nodes) != len(model.nodes):
        error("Node IDs must be unique.")
    for node in model.nodes:
        spec = REGISTRY.get(node.type)
        if spec is None:
            error("Unknown node type.", node.id)
            continue
        parameter = spec.get("parameter")
        if set(node.parameters) != ({parameter} if parameter else set()):
            error("Unexpected or missing node parameters.", node.id)
        elif parameter and not spec["min"] <= node.parameters[parameter] <= spec["max"]:
            error(f"{parameter} must be between {spec['min']} and {spec['max']}.", node.id)
    inputs = [node.id for node in model.nodes if node.type == "input"]
    outputs = [node.id for node in model.nodes if node.type == "binary_output"]
    if len(inputs) != 1 or len(outputs) != 1:
        error("Exactly one Input and one Binary Output are required.")
    incoming = {key: [] for key in nodes}
    outgoing = {key: [] for key in nodes}
    for edge in model.edges:
        if edge.source not in nodes or edge.target not in nodes:
            error("Connection references a missing node.")
        else:
            outgoing[edge.source].append(edge.target)
            incoming[edge.target].append(edge.source)
    for key, node in nodes.items():
        if len(incoming[key]) != (0 if node.type == "input" else 1):
            error("Expected exactly one incoming connection (none for Input).", key)
        if len(outgoing[key]) != (0 if node.type == "binary_output" else 1):
            error("Expected exactly one outgoing connection (none for Output).", key)
    order = []
    if len(inputs) == 1:
        key = inputs[0]
        while key not in order:
            order.append(key)
            if len(outgoing[key]) != 1:
                break
            key = outgoing[key][0]
        else:
            error("Cycles are not allowed.", key)
    if len(order) != len(nodes):
        error("All nodes must belong to one connected, acyclic Input → Output chain.")
    shapes, count, dense_count = {}, 0, 0
    if not errors:
        width = 2
        for i, key in enumerate(order):
            node = nodes[key]
            before = width
            if node.type == "dense":
                width = node.parameters["units"]
                count += (before + 1) * width
                dense_count += 1
            if node.type == "binary_output":
                if width != 1:
                    error("Binary Output requires exactly one logit. Add Dense(1).", key)
                if i and nodes[order[i - 1]].type == "sigmoid":
                    error("Use logits: Sigmoid is not allowed directly before Binary Output.", key)
            shapes[key] = {"input": ["batch", before], "output": ["batch", width]}
        if dense_count == 0:
            error("At least one Dense layer is required.")
        if dense_count - 1 > MAX_HIDDEN_LAYERS:
            error(f"At most {MAX_HIDDEN_LAYERS} hidden Dense layers are allowed.")
        if count > MAX_PARAMETERS:
            error(f"Model exceeds the {MAX_PARAMETERS} trainable parameter limit.")
    return {
        "valid": not errors,
        "errors": errors,
        "warnings": [],
        "shapes": shapes,
        "parameter_count": count,
        "order": order,
    }


class CompiledModel(nn.Module):
    def __init__(self, definition: ModelDefinition):
        super().__init__()
        self.report = validate(definition)
        if not self.report["valid"]:
            raise ValueError(self.report["errors"])
        nodes = {node.id: node for node in definition.nodes}
        self.layers = nn.ModuleDict()
        for key in self.report["order"]:
            node = nodes[key]
            if node.type == "dense":
                shape = self.report["shapes"][key]
                self.layers[f"node_{key}"] = nn.Linear(shape["input"][1], shape["output"][1])
            elif node.type in ACTIVATIONS:
                self.layers[f"node_{key}"] = ACTIVATIONS[node.type]()
            else:
                self.layers[f"node_{key}"] = nn.Identity()

    def forward(self, x: torch.Tensor):
        for layer in self.layers.values():
            x = layer(x)
        return x
