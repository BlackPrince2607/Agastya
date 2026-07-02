"""Auth helper schemas."""

from pydantic import BaseModel, EmailStr, Field


class CheckEmailBody(BaseModel):
    email: EmailStr


class CheckEmailResponse(BaseModel):
    exists: bool
    checked: bool = Field(description="False when the server could not verify (client may ask user)")


class DeleteAccountResponse(BaseModel):
    ok: bool = True
    deleted_sessions: int = Field(default=0, alias="deletedSessions")

    model_config = {"populate_by_name": True}
