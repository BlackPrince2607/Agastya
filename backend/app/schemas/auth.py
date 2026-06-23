"""Auth helper schemas."""

from pydantic import BaseModel, EmailStr, Field


class CheckEmailBody(BaseModel):
    email: EmailStr


class CheckEmailResponse(BaseModel):
    exists: bool
    checked: bool = Field(description="False when the server could not verify (client may ask user)")
