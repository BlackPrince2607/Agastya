"""Stripe Checkout request/response schemas."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.utils.validators import _parse_uuid, validate_device_install_id


class StripeCheckoutBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    billing_period: Literal["monthly", "annual"] = Field(alias="billingPeriod")
    success_url: str = Field(alias="successUrl", max_length=2048)
    cancel_url: str = Field(alias="cancelUrl", max_length=2048)

    model_config = {"populate_by_name": True}

    @field_validator("session_id")
    @classmethod
    def _session_uuid(cls, v: str) -> str:
        return _parse_uuid(v)

    @field_validator("device_install_id")
    @classmethod
    def _device_id(cls, v: str) -> str:
        out = validate_device_install_id(v)
        if out is None:
            raise ValueError("deviceInstallId required")
        return out


class StripeCheckoutResponse(BaseModel):
    checkout_url: str = Field(alias="checkoutUrl")

    model_config = {"populate_by_name": True}
