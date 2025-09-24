import pytest


pytest.importorskip("dash")
pytest.importorskip("dash_mantine_components")

from app.dash_app.callbacks.correlation_callbacks import _generate_short_strategy_labels


def test_generate_short_strategy_labels_produce_unique_names():
    strategies = [
        "FRI DC 5-7 P20d C18d",
        "FRI DC 5-7 50d, 25d exit",
        "FRI DC 5-7 45d, 30d exit",
    ]

    labels = _generate_short_strategy_labels(strategies)

    assert len(labels) == len(strategies)
    assert len(labels) == len(set(labels))

    # All variants of the same base name should keep a readable prefix but remain unique
    assert labels[0][:5] == "FRIDC"
    assert all(label.startswith("FRIDC") for label in labels)


def test_generate_short_strategy_labels_handles_empty_strings():
    strategies = ["", None]

    labels = _generate_short_strategy_labels(strategies)

    assert len(labels) == 2
    assert len(set(labels)) == 2
    assert all(label for label in labels)
