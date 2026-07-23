"""Google Play ExternalTransactions reporter for User Choice Billing.

Required by Google Play India User Choice program: alternative billing transactions
(Razorpay) must be reported within 24 hours via the ExternalTransactions API.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

_SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]{1,63}$")


def _sanitize_transaction_id(raw: str) -> str:
    """Developer-chosen id for the query param (not the Play token)."""
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "_", raw)[:63]
    if _SAFE_ID.match(cleaned):
        return cleaned
    return f"pay_{abs(hash(raw)) % (10**12)}"[:63]


async def report_external_transaction(
    settings: Settings,
    *,
    external_transaction_token: str,
    amount_micros: int,
    currency: str,
    external_transaction_id: str | None = None,
    administrative_area: str | None = None,
) -> bool:
    """Report an alternative billing transaction to Google Play.

    `external_transaction_id` must be a developer-generated unique id.
    `external_transaction_token` is the Play User Choice token (body only).
    """
    if not settings.google_play_service_account_json:
        logger.warning("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON unset — skipping Play report")
        return False
    if not external_transaction_token:
        return False

    try:
        from google.auth.transport.requests import Request as GoogleAuthRequest
        from google.oauth2 import service_account
    except ImportError:
        logger.warning("google-auth not installed — cannot report ExternalTransactions")
        return False

    try:
        info = json.loads(settings.google_play_service_account_json)
        credentials = service_account.Credentials.from_service_account_info(
            info,
            scopes=["https://www.googleapis.com/auth/androidpublisher"],
        )
        credentials.refresh(GoogleAuthRequest())
        token = credentials.token
    except Exception as exc:
        logger.warning("Play service account auth failed: %s", exc)
        return False

    tx_id = _sanitize_transaction_id(
        external_transaction_id or f"agastya_{int(datetime.now(timezone.utc).timestamp())}"
    )
    package = settings.play_package_name
    url = (
        f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
        f"{package}/externalTransactions"
        f"?externalTransactionId={tx_id}"
    )

    tax_address: dict[str, Any] = {"regionCode": "IN"}
    if administrative_area:
        tax_address["administrativeArea"] = administrative_area

    body = {
        "originalPreTaxAmount": {
            "priceMicros": str(amount_micros),
            "currency": currency,
        },
        "originalTaxAmount": {
            "priceMicros": "0",
            "currency": currency,
        },
        "transactionTime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "oneTimeTransaction": {
            "externalTransactionToken": external_transaction_token,
        },
        "userTaxAddress": tax_address,
    }

    # Inline retries (Track 2 simplified worker: caller + cron also retry)
    last_error = ""
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
                if res.status_code in (200, 201):
                    return True
                last_error = f"{res.status_code} {res.text[:400]}"
                logger.warning(
                    "Play ExternalTransactions attempt %s failed: %s",
                    attempt + 1,
                    last_error,
                )
        except Exception as exc:
            last_error = str(exc)
            logger.warning("Play ExternalTransactions error attempt %s: %s", attempt + 1, exc)
    logger.warning("Play ExternalTransactions exhausted retries: %s", last_error)
    return False
