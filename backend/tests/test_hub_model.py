import json
from pathlib import Path
from types import SimpleNamespace

import pytest
import torch
from fastapi.testclient import TestClient

from app.main import app
from marketing_agent.config import get_settings
from marketing_agent.sentiment import load_model
from upload_model import DEFAULT_MODEL_DIR, REPO_ID, upload_model, validate_model_dir


def test_upload_uses_growthlab_checkpoint_and_existing_repo(tmp_path: Path, monkeypatch):
    (tmp_path / "config.json").write_text(json.dumps({
        "id2label": {str(i): f"{i + 1}_star" for i in range(5)}
    }), encoding="utf-8")
    (tmp_path / "model.safetensors").write_bytes(b"test")
    (tmp_path / "tokenizer.json").write_text("{}", encoding="utf-8")
    calls = []

    class FakeApi:
        def __init__(self, token):
            calls.append(("init", token))

        def create_repo(self, **kwargs):
            calls.append(("create", kwargs))

        def upload_folder(self, **kwargs):
            calls.append(("upload", kwargs))
            return SimpleNamespace(commit_url="https://huggingface.co/commit/example")

    monkeypatch.setattr("upload_model.HfApi", FakeApi)
    assert upload_model(tmp_path, token="test-token").endswith("/example")
    assert calls[1][1] == {"repo_id": REPO_ID, "repo_type": "model", "exist_ok": True}
    assert calls[2][1]["folder_path"] == tmp_path
    assert DEFAULT_MODEL_DIR.name == "growthlab-sentiment-yelp-tuned"


def test_upload_rejects_wrong_labels_before_hub_access(tmp_path: Path):
    (tmp_path / "config.json").write_text('{"id2label":{"0":"negative"}}', encoding="utf-8")
    (tmp_path / "model.safetensors").write_bytes(b"test")
    (tmp_path / "tokenizer.json").write_text("{}", encoding="utf-8")
    with pytest.raises(ValueError, match="1_star"):
        validate_model_dir(tmp_path)


def test_marketing_endpoint_uses_hub_model(monkeypatch):
    monkeypatch.setenv("SENTIMENT_MODEL_SOURCE", "hub")
    monkeypatch.setenv("SENTIMENT_MODEL_ID", REPO_ID)
    monkeypatch.setenv("HF_TOKEN", "test-token")
    get_settings.cache_clear()
    load_model.cache_clear()
    calls = []

    class FakeTokenizer:
        def __call__(self, texts, **kwargs):
            assert kwargs["truncation"] is True
            return {"input_ids": torch.tensor([[1, 2]] * len(texts))}

    class FakeModel:
        config = SimpleNamespace(num_labels=5, id2label={i: f"{i + 1}_star" for i in range(5)})

        def to(self, device):
            return self

        def eval(self):
            return self

        def __call__(self, **kwargs):
            return SimpleNamespace(logits=torch.tensor([[0., 0., 0., 0., 4.]] * len(kwargs["input_ids"])))

    def tokenizer_loader(repo_id, **kwargs):
        calls.append((repo_id, kwargs))
        return FakeTokenizer()

    def model_loader(repo_id, **kwargs):
        calls.append((repo_id, kwargs))
        return FakeModel()

    monkeypatch.setattr("transformers.AutoTokenizer.from_pretrained", tokenizer_loader)
    monkeypatch.setattr("transformers.AutoModelForSequenceClassification.from_pretrained", model_loader)
    payload = json.loads((Path(__file__).parents[1] / "marketing_agent" / "fixtures" / "demo_request.json").read_text(encoding="utf-8"))
    response = TestClient(app).post("/marketing/analyze", json=payload)
    assert response.status_code == 200
    assert response.json()["execution"]["sentiment_engine"] == "huggingface_distilbert"
    assert response.json()["sentiment"]["model_status"] == "available"
    assert len(calls) == 2
    assert all(repo_id == REPO_ID and kwargs["token"] == "test-token" for repo_id, kwargs in calls)
    get_settings.cache_clear()
    load_model.cache_clear()
