"""Billing request/response schemas."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.utils.validators import _parse_uuid, validate_device_install_id


class RazorpayPaymentLinkBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    # monthly | annual (lifetime accepted and treated as annual for grants)
    billing_period: Literal["monthly", "annual", "lifetime"] = Field(
        default="annual",
        alias="billingPeriod",
    )
    success_url: str = Field(alias="successUrl", max_length=2048)
    cancel_url: str = Field(alias="cancelUrl", max_length=2048)
    external_transaction_token: str | None = Field(default=None, alias="externalTransactionToken")
    administrative_area: str | None = Field(default=None, alias="administrativeArea", max_length=64)
    platform: Literal["android", "ios", "web"] | None = Field(default="android", alias="platform")

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


class RazorpayPaymentLinkResponse(BaseModel):
    checkout_url: str = Field(alias="checkoutUrl")
    checkout_intent_id: str = Field(alias="checkoutIntentId")

    model_config = {"populate_by_name": True}


class RazorpayConfirmPaymentBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    checkout_intent_id: str | None = Field(default=None, alias="checkoutIntentId")
    payment_link_id: str | None = Field(default=None, alias="paymentLinkId", max_length=64)
    payment_id: str | None = Field(default=None, alias="paymentId", max_length=64)
    payment_link_reference_id: str | None = Field(
        default=None, alias="paymentLinkReferenceId", max_length=128
    )
    payment_link_status: str | None = Field(default=None, alias="paymentLinkStatus", max_length=32)
    razorpay_signature: str | None = Field(default=None, alias="razorpaySignature", max_length=256)

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


class RazorpayConfirmPaymentResponse(BaseModel):
    is_premium: bool = Field(alias="isPremium")
    status: str = "pending"
    source: Literal["razorpay"] | None = None

    model_config = {"populate_by_name": True}


class GooglePlayVerifyBody(BaseModel):
    session_id: str = Field(alias="sessionId")
    device_install_id: str = Field(alias="deviceInstallId")
    purchase_token: str = Field(alias="purchaseToken", min_length=1, max_length=512)
    product_id: str = Field(alias="productId", min_length=1, max_length=128)

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


class GooglePlayVerifyResponse(BaseModel):
    is_premium: bool = Field(alias="isPremium")
    source: Literal["google_play"] = "google_play"

    model_config = {"populate_by_name": True}


class BillingProviderInfo(BaseModel):
    id: Literal["google_play", "razorpay"]
    enabled: bool = True
    label: str
    requires_play_user_choice: bool = Field(default=False, alias="requiresPlayUserChoice")

    model_config = {"populate_by_name": True}


class BillingPlanInfo(BaseModel):
    amount: int
    currency: str


class BillingConfigResponse(BaseModel):
    country: str | None = None
    currency: str = "INR"
    providers: list[BillingProviderInfo]
    plans: dict[str, BillingPlanInfo]

    model_config = {"populate_by_name": True}
