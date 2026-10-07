import asyncio
import json
from pathlib import Path
import pytest
from pydantic import ValidationError
from backend.app import Alert, Batch, bridge

BASE = {"alert_id": "TEST-1", "timestamp": "2026-01-01T00:00:00Z", "source": "edr",
        "alert_type": "credential_dump", "severity": 2, "entities": ["host:WS-1"],
        "asset_criticality": 3, "description": "Observed memory access"}

def test_python_contract_forbids_hidden_labels():
    with pytest.raises(ValidationError):
        Alert(**BASE, episode="ATTACK-001")
    with pytest.raises(ValidationError):
        Batch(alerts=[BASE, BASE])

def test_python_contract_rejects_naive_timestamp():
    with pytest.raises(ValidationError):
        Alert(**{**BASE, "timestamp": "2026-01-01T00:00:00"})

def test_shared_engine_bridge_returns_explainable_incident():
    result = asyncio.run(bridge({"command": "triage", "alerts": [BASE]}))
    incident = result["incidents"][0]
    assert incident["alert_ids"] == ["TEST-1"]
    assert len(incident["components"]) == 6
    assert incident["mappings"][0]["technique"] == "T1003.001"

def test_external_adapter_preserves_missing_fields_and_does_not_generate_truth():
    from scripts.ait_adapter import convert
    converted = convert({"timestamp": "2026-01-01T05:30:00+05:30", "rule": {"level": 10, "description": "Memory access", "mitre": {"id": ["T1003.001"]}}, "agent": {"name": "server"}, "episode": "DO_NOT_COPY"}, 0, "test.json")
    assert converted["timestamp"] == "2026-01-01T00:00:00Z"
    assert converted["severity"] == 3
    assert converted["alert_type"] == "credential_dump"
    assert converted["entities"] == ["host:server"]
    assert "episode" not in converted
    assert "asset_criticality" not in converted
