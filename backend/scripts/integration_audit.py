"""One-shot frontend-backend integration audit against a running API."""
from __future__ import annotations

import json
import sys
import uuid
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
SID = str(uuid.uuid4())
DID = "test-device-integration"


def req(method: str, path: str, body: dict | None = None) -> tuple[int, object]:
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as res:
            raw = res.read()
            return res.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw[:500]


def main() -> int:
    failures: list[str] = []
    palm: dict | None = None

    checks: list[tuple[str, int, object]] = []

    checks.append(("GET /v1/health", *req("GET", "/v1/health")))

    code, body = req(
        "POST",
        "/v1/sessions/register",
        {
            "sessionId": SID,
            "deviceInstallId": DID,
            "displayName": "Audit",
            "focusTopics": ["love"],
        },
    )
    checks.append(("POST /v1/sessions/register", code, body))

    checks.append(("GET /v1/sessions/bootstrap", *req("GET", f"/v1/sessions/bootstrap?sessionId={SID}")))

    checks.append(
        (
            "POST /v1/auth/check-email",
            *req("POST", "/v1/auth/check-email", {"email": "test@example.com"}),
        )
    )

    code, body = req(
        "POST",
        "/v1/palm/analyze",
        {
            "sessionId": SID,
            "deviceInstallId": DID,
            "seed": "audit-seed",
            "dominantHand": "right",
        },
    )
    checks.append(("POST /v1/palm/analyze", code, body))

    _, boot = req("GET", f"/v1/sessions/bootstrap?sessionId={SID}")
    if isinstance(boot, dict):
        palm = boot.get("palmAnalysis")

    checks.append(
        (
            "POST /v1/reports/generate (preview)",
            *req(
                "POST",
                "/v1/reports/generate",
                {
                    "sessionId": SID,
                    "seed": "audit-seed",
                    "palmAnalysis": palm,
                    "focusTopics": ["love"],
                    "mode": "preview",
                },
            ),
        )
    )

    checks.append(
        (
            "POST /v1/chat (frontend payload — no isPremium)",
            *req(
                "POST",
                "/v1/chat",
                {
                    "sessionId": SID,
                    "messages": [{"role": "user", "content": "Hello"}],
                    "palmAnalysis": palm,
                    "profileSummary": "Test user",
                },
            ),
        )
    )

    checks.append(
        (
            "POST /v1/tasks/daily (frontend payload — no isPremium)",
            *req(
                "POST",
                "/v1/tasks/daily",
                {"sessionId": SID, "palmAnalysis": palm},
            ),
        )
    )

    checks.append(
        (
            "POST /v1/predictions/generate",
            *req(
                "POST",
                "/v1/predictions/generate",
                {
                    "sessionId": SID,
                    "period": "month",
                    "palmAnalysis": palm,
                    "focusTopics": ["love"],
                },
            ),
        )
    )

    checks.append(
        (
            "POST /v1/sessions/merge (no token — expect 401)",
            *req(
                "POST",
                "/v1/sessions/merge",
                {
                    "anonymousSessionId": SID,
                    "supabaseUserId": str(uuid.uuid4()),
                },
            ),
        )
    )

    checks.append(
        (
            "POST /v1/billing/checkout",
            *req(
                "POST",
                "/v1/billing/checkout",
                {
                    "sessionId": SID,
                    "deviceInstallId": DID,
                    "billingPeriod": "monthly",
                    "successUrl": "http://localhost:8081/success",
                    "cancelUrl": "http://localhost:8081/cancel",
                },
            ),
        )
    )

    for name, code, body in checks:
        print(f"{name}: {code}")
        if name.endswith("expect 401)"):
            if code != 401:
                failures.append(f"{name} expected 401 got {code}")
        elif "billing/checkout" in name and code == 503:
            print("  -> Stripe not configured (expected in local dev)")
        elif code >= 400:
            failures.append(f"{name} failed with {code}: {str(body)[:200]}")
            print(f"  -> {str(body)[:400]}")
        print()

    if failures:
        print("FAILURES:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("All integration checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
