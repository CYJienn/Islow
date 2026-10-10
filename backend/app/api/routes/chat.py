from fastapi import APIRouter

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.widget_generator import respond

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    return respond(request.text)
