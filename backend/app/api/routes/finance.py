"""Connect the Kaunter frontend to the local finance processor."""
import re
import httpx
from fastapi import APIRouter, HTTPException, Request, Response

router = APIRouter(prefix='/finance', tags=['finance'])


@router.api_route('/{path:path}', methods=['GET', 'POST'])
async def finance_proxy(path: str, request: Request):
    if not re.fullmatch(r'(health|session|history|connections|runs|reports/report-[a-f0-9]{12}(?:/(?:approve|reject|review-start|distribute|files/(?:report.xlsx|report.json|dashboard.html|final-report.md)))?)', path):
        raise HTTPException(404, 'Unknown finance endpoint')
    if request.client and request.client.host not in ('127.0.0.1', '::1', 'localhost', 'testclient'):
        raise HTTPException(403, 'Local finance access only')
    body = await request.body()
    if len(body) > 10000:
        raise HTTPException(413, 'Request too large')
    headers = {'Content-Type': 'application/json', 'X-Local-Token': request.headers.get('X-Local-Token', '')}
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            result = await client.request(request.method, 'http://127.0.0.1:8090/api/' + path, content=body, headers=headers)
    except httpx.RequestError:
        raise HTTPException(503, 'Start backend/finance/START.ps1 first')
    return Response(result.content, status_code=result.status_code,
                    headers={k: v for k, v in result.headers.items() if k in ('content-type', 'content-disposition')})
