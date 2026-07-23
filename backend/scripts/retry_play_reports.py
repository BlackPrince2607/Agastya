"""Drain pending Google Play ExternalTransactions reports.

Run on a schedule (e.g. every 15 minutes via Railway cron / GitHub Action):

  cd backend && python -m scripts.retry_play_reports
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

# Allow `python -m scripts.retry_play_reports` from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import get_settings
from app.services import billing_intents
from app.services import play_external_transactions

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("retry_play_reports")


async def main() -> int:
    settings = get_settings()
    pending = await billing_intents.list_pending_play_reports(settings, limit=50)
    if not pending:
        logger.info("No pending Play reports")
        return 0

    ok_n = 0
    for row in pending:
        token = row.get("external_transaction_token")
        if not token:
            continue
        intent_id = row.get("checkout_intent_id")
        intent = None
        amount = 0
        admin_area = None
        if intent_id:
            intent = await billing_intents.get_intent_by_id(settings, str(intent_id))
        if intent:
            amount = int(intent.get("amount") or 0)
            admin_area = intent.get("administrative_area")
        micros = amount * 10_000
        report_id = str(intent_id or row.get("id") or token)
        success = await play_external_transactions.report_external_transaction(
            settings,
            external_transaction_id=report_id,
            external_transaction_token=str(token),
            amount_micros=micros or 1,
            currency="INR",
            administrative_area=str(admin_area) if admin_area else None,
        )
        if success:
            await billing_intents.mark_play_report_done(
                settings, external_transaction_token=str(token)
            )
            ok_n += 1
        else:
            await billing_intents.mark_play_report_error(
                settings,
                external_transaction_token=str(token),
                error="retry_failed",
            )
    logger.info("Play report drain: %s/%s succeeded", ok_n, len(pending))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
