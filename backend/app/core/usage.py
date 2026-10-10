"""Per-request token counter shared by the manager and the marketing agent (contextvar, so it follows asyncio.to_thread)."""
from contextvars import ContextVar

from langchain_core.callbacks import UsageMetadataCallbackHandler

_handler: ContextVar[UsageMetadataCallbackHandler | None] = ContextVar("usage", default=None)
# USD per 1M tokens (gpt-6-luna list price from third-party aggregators; check OpenAI's pricing page)
PRICE_IN, PRICE_OUT = 0.10, 0.50


def start() -> None:
    _handler.set(UsageMetadataCallbackHandler())


def config() -> dict:
    h = _handler.get()
    return {"callbacks": [h]} if h else {}


def summary() -> str:
    h = _handler.get()
    if not h:
        return "no usage recorded"
    i = sum(u.get("input_tokens", 0) for u in h.usage_metadata.values())
    o = sum(u.get("output_tokens", 0) for u in h.usage_metadata.values())
    return f"tokens in={i} out={o} total={i + o} cost=${(i * PRICE_IN + o * PRICE_OUT) / 1e6:.5f}"
