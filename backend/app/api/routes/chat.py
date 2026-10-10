import re

from fastapi import APIRouter, Header

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.company_manager import respond as manager_respond
from app.services.widget_generator import respond

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest, authorization: str | None = Header(default=None)) -> ChatResponse:
    if re.match(r"^/create(?:\s|$)", request.text.strip(), flags=re.IGNORECASE):
        return respond(request.text)
    return await manager_respond(request, authorization)
