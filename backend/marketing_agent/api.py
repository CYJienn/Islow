import secrets
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from .config import get_settings
from .graph import analyze
from .schemas import AnalyzeRequest, Report

app = FastAPI(title="GrowthLab Marketing", version="1")
router = APIRouter(tags=["marketing"])


def verify_token(authorization: str | None = Header(default=None)) -> None:
    token = get_settings().marketing_api_token
    if token and not (authorization and authorization.startswith("Bearer ") and
                      secrets.compare_digest(authorization[7:], token)):
        raise HTTPException(status_code=401, detail="Invalid or missing bearer token")


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "growthlab-marketing", "version": "1"}


@router.post("/marketing/analyze", response_model=Report, dependencies=[Depends(verify_token)])
def marketing_analyze(request: AnalyzeRequest) -> Report:
    return analyze(request)


app.include_router(router)
