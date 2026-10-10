"""Internal, authenticated adapter from stateless chat to GrowthLab."""

import asyncio
from datetime import datetime, timezone
from uuid import uuid4

from pydantic import ValidationError

from app.schemas.chat import ChatRequest
from marketing_agent.api import verify_token
from marketing_agent.graph import analyze
from marketing_agent.schemas import AnalyzeRequest, Business, Finding, Report


def prepare(request: ChatRequest) -> tuple[AnalyzeRequest | None, list[str]]:
    payload = request.marketing
    if payload is None or payload.business is None:
        return None, [name for name, field in Business.model_fields.items() if field.is_required()]
    try:
        business = Business.model_validate(payload.business)
    except ValidationError as error:
        return None, list(dict.fromkeys(str(item["loc"][0]) for item in error.errors()))

    now = datetime.now(timezone.utc).isoformat()
    documents = [
        Finding(evidence_id=f"document-{index:03}", competitor=business.name,
                fact=f"Provided document [{document.source}]: {document.content[:1200]}",
                source_url=None, retrieved_at=now, evidence_type="provided_document",
                title=document.source)
        for index, document in enumerate(request.documents, 1)
    ]
    return AnalyzeRequest(task_id=f"manager-{uuid4().hex[:12]}", business=business,
                          reviews=payload.reviews, research_mode=payload.research_mode,
                          document_evidence=documents), []


async def run(request: AnalyzeRequest, authorization: str | None = None) -> Report:
    verify_token(authorization)
    return await asyncio.to_thread(analyze, request)
