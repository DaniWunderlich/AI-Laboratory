import copy

import pytest
import torch

from app.graph import CompiledModel, validate
from app.schemas import ModelDefinition


def test_compiles_in_edge_order_and_counts_real_parameters(definition):
    model = definition["model"]
    model["nodes"].reverse()
    compiled = CompiledModel(ModelDefinition.model_validate(model))
    assert compiled.report["order"] == [f"n{i}" for i in range(5)]
    assert compiled.report["parameter_count"] == sum(p.numel() for p in compiled.parameters()) == 33
    assert compiled.report["shapes"]["n1"]["output"] == ["batch", 8]
    assert compiled(torch.ones(3, 2)).shape == (3, 1)


@pytest.mark.parametrize(
    "mutation",
    [
        "missing_input",
        "missing_output",
        "unknown",
        "duplicate",
        "missing_reference",
        "branch",
        "cycle",
        "disconnected_cycle",
        "wrong_shape",
        "sigmoid_output",
        "wrong_parameter",
        "extra_parameter",
        "too_many_parameters",
        "too_many_hidden",
    ],
)
def test_rejects_invalid_graphs(definition, mutation):
    graph = copy.deepcopy(definition["model"])
    nodes, edges = graph["nodes"], graph["edges"]
    if mutation == "missing_input":
        nodes.pop(0)
    elif mutation == "missing_output":
        nodes.pop()
    elif mutation == "unknown":
        nodes[2]["type"] = "exec"
    elif mutation == "duplicate":
        nodes.append(copy.deepcopy(nodes[1]))
    elif mutation == "missing_reference":
        edges[0]["target"] = "absent"
    elif mutation == "branch":
        edges.append({"source": "n0", "target": "n3"})
    elif mutation == "cycle":
        edges.append({"source": "n3", "target": "n1"})
    elif mutation == "disconnected_cycle":
        nodes.extend([{"id": "a", "type": "relu"}, {"id": "b", "type": "relu"}])
        edges.extend([{"source": "a", "target": "b"}, {"source": "b", "target": "a"}])
    elif mutation == "wrong_shape":
        nodes[3]["parameters"]["units"] = 2
    elif mutation == "sigmoid_output":
        nodes.insert(4, {"id": "s", "type": "sigmoid"})
        edges[-1] = {"source": "n3", "target": "s"}
        edges.append({"source": "s", "target": "n4"})
    elif mutation == "wrong_parameter":
        nodes[1]["parameters"]["units"] = 65
    elif mutation == "extra_parameter":
        nodes[2]["parameters"] = {"units": 8}
    elif mutation in {"too_many_parameters", "too_many_hidden"}:
        widths = [64] * 3 + [1] if mutation == "too_many_parameters" else [2] * 7 + [1]
        nodes[:] = [{"id": "n0", "type": "input", "parameters": {"features": 2}}]
        nodes.extend(
            {"id": f"d{i}", "type": "dense", "parameters": {"units": w}}
            for i, w in enumerate(widths)
        )
        nodes.append({"id": "out", "type": "binary_output"})
        edges[:] = [{"source": a["id"], "target": b["id"]} for a, b in zip(nodes, nodes[1:])]
    report = validate(ModelDefinition.model_validate(graph))
    assert not report["valid"]
    assert report["errors"]


def test_node_ids_cannot_collide_with_pytorch_attributes(definition):
    graph = definition["model"]
    graph["nodes"][1]["id"] = "training"
    graph["edges"][0]["target"] = "training"
    graph["edges"][1]["source"] = "training"
    assert CompiledModel(ModelDefinition.model_validate(graph))(torch.ones(1, 2)).shape == (1, 1)


@pytest.mark.parametrize(
    "kind, expected", [("relu", 0.0), ("tanh", -0.761594), ("sigmoid", 0.268941)]
)
def test_forward_activation_values(definition, kind, expected):
    graph = definition["model"]
    graph["nodes"][1]["parameters"]["units"] = 1
    graph["nodes"][2]["type"] = kind
    model = CompiledModel(ModelDefinition.model_validate(graph))
    with torch.no_grad():
        model.layers["node_n1"].weight.fill_(0)
        model.layers["node_n1"].bias.fill_(-1)
        model.layers["node_n3"].weight.fill_(1)
        model.layers["node_n3"].bias.fill_(0)
    assert model(torch.tensor([[0.0, 1.0]])).item() == pytest.approx(expected, abs=1e-6)
