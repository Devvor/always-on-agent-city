#!/usr/bin/env python3
import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone


AUTH_PATH = "/opt/data/shared/nous_auth.json"
DEFAULT_BASE_URL = "https://inference-api.nousresearch.com"


def main():
    try:
        parser = argparse.ArgumentParser(
            description="Check whether a model on the Nous inference API is currently free."
        )
        parser.add_argument("model_id")
        parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
        parser.add_argument("--timeout", type=float, default=30.0)
        args = parser.parse_args()

        with open(AUTH_PATH, "r", encoding="utf-8") as auth_file:
            token = json.load(auth_file)["access_token"]

        base_url = args.base_url.rstrip("/")
        user_agent = "free_model_probe/1.0"

        models_request = urllib.request.Request(
            f"{base_url}/v1/models",
            headers={
                "Authorization": f"Bearer {token}",
                "User-Agent": user_agent,
                "Accept": "application/json",
            },
            method="GET",
        )

        with urllib.request.urlopen(models_request, timeout=args.timeout) as response:
            models_payload = json.loads(response.read().decode("utf-8"))

        if isinstance(models_payload, dict):
            entries = models_payload.get("data", models_payload.get("models", []))
        elif isinstance(models_payload, list):
            entries = models_payload
        else:
            entries = []

        entry = None
        for candidate in entries:
            if isinstance(candidate, dict) and candidate.get("id") == args.model_id:
                entry = candidate
                break

        if entry is None:
            print(json.dumps({"model": args.model_id, "present": False, "free": False}, default=str))
            return 2

        pricing = entry.get("pricing", {}) if isinstance(entry, dict) else {}
        if not isinstance(pricing, dict):
            pricing = {}

        price_in = pricing.get("prompt")
        price_out = pricing.get("completion")

        try:
            free = float(price_in) == 0 and float(price_out) == 0
        except (TypeError, ValueError):
            free = False

        canary_url = f"{base_url}/v1/chat/completions"
        canary_body = {
            "model": args.model_id,
            "messages": [{"role": "user", "content": "Reply with OK"}],
            "max_tokens": 5,
        }
        canary_request = urllib.request.Request(
            canary_url,
            data=json.dumps(canary_body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {token}",
                "User-Agent": user_agent,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        canary_ok = False
        try:
            with urllib.request.urlopen(canary_request, timeout=args.timeout) as canary_response:
                canary_ok = canary_response.status == 200
        except urllib.error.HTTPError:
            canary_ok = False

        result = {
            "model": args.model_id,
            "present": True,
            "free": free,
            "price_in_per_token": price_in,
            "price_out_per_token": price_out,
            "canary_ok": canary_ok,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
        print(json.dumps(result, default=str))
        return 0 if (free and canary_ok) else 1

    except SystemExit:
        raise
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, default=str))
        return 1


if __name__ == "__main__":
    sys.exit(main())
