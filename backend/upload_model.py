"""Upload a local Transformers sequence classifier to its Hugging Face model repo."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from huggingface_hub import HfApi


REPO_ID = "KaiHuang05/growthlab-sentiment-yelp-tuned"
DEFAULT_MODEL_DIR = Path(__file__).resolve().parent / "ml" / "model" / "growthlab-sentiment-yelp-tuned"


def validate_model_dir(model_dir: Path) -> Path:
    """Fail before creating a remote repo if required export files are absent."""
    model_dir = model_dir.expanduser().resolve()
    if not model_dir.is_dir():
        raise FileNotFoundError(f"Model directory not found: {model_dir}")
    if not (model_dir / "config.json").is_file():
        raise ValueError(f"Missing config.json in {model_dir}")
    if not any((model_dir / name).is_file() for name in ("model.safetensors", "pytorch_model.bin")):
        raise ValueError(f"Missing model.safetensors or pytorch_model.bin in {model_dir}")
    if not any((model_dir / name).is_file() for name in ("tokenizer.json", "vocab.txt", "spiece.model")):
        raise ValueError(f"Missing tokenizer files in {model_dir}")
    # This upload target is the Marketing Agent's five-star sentiment model.
    import json

    config = json.loads((model_dir / "config.json").read_text(encoding="utf-8"))
    labels = {int(key): value for key, value in config.get("id2label", {}).items()}
    if labels != {index: f"{index + 1}_star" for index in range(5)}:
        raise ValueError("Checkpoint labels must be ordered 1_star through 5_star")
    return model_dir


def upload_model(model_dir: Path = DEFAULT_MODEL_DIR, *, token: str | None = None,
                 repo_id: str | None = None) -> str:
    """Create the target repo if needed, then upload the checked checkpoint folder."""
    model_dir = validate_model_dir(model_dir)
    load_dotenv(Path(__file__).resolve().parent / ".env")
    target_repo = repo_id or os.getenv("SENTIMENT_MODEL_ID") or REPO_ID
    # HfApi also accepts credentials saved locally by `hf auth login`.
    api = HfApi(token=token or os.getenv("HF_TOKEN") or None)
    api.create_repo(repo_id=target_repo, repo_type="model", exist_ok=True)
    result = api.upload_folder(
        repo_id=target_repo,
        repo_type="model",
        folder_path=model_dir,
        # Upload only the files needed for inference and model documentation.
        allow_patterns=[
            "config.json", "model.safetensors", "pytorch_model.bin", "tokenizer.json",
            "tokenizer_config.json", "special_tokens_map.json", "added_tokens.json",
            "vocab.txt", "merges.txt", "spiece.model", "README.md",
        ],
    )
    return result.commit_url


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, default=DEFAULT_MODEL_DIR)
    parser.add_argument("--repo-id", default=None, help="Override SENTIMENT_MODEL_ID from backend/.env")
    args = parser.parse_args()
    try:
        print(f"Uploaded model: {upload_model(args.model_dir, repo_id=args.repo_id)}")
    except (FileNotFoundError, ValueError) as exc:
        print(f"Upload not started: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        # Do not echo the provider exception: authentication errors can include request details.
        print(f"Upload failed ({type(exc).__name__}). Check HF_TOKEN or `hf auth login`, repo permissions, and network access.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
