"""Auth endpoints for the mobile client."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.middleware.rate_limit import check_rate_limit
from app.schemas.auth import CheckEmailBody, CheckEmailResponse
from app.services.auth_admin import user_exists_by_email

router = APIRouter(tags=["auth"], dependencies=[Depends(check_rate_limit)])


@router.post("/auth/check-email", response_model=CheckEmailResponse)
async def check_email(
    body: CheckEmailBody,
    settings: Annotated[Settings, Depends(get_settings)],
) -> CheckEmailResponse:
    exists = await user_exists_by_email(body.email, settings)
    if exists is None:
        return CheckEmailResponse(exists=False, checked=False)
    return CheckEmailResponse(exists=exists, checked=True)
