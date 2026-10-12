#!/usr/bin/env python3
import argparse
import json
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

AUTH_PATH = "/opt/data/shared/nous_auth.json"
DEFAULT_PROMPTS = "/opt/data/missingno-worker/bench_prompts.json"
API_URL = "https://inference-api.nousresearch.com/v1/chat/completions"
USER_AGENT = "bench_harness/1.0"


class InternalError(Exception):
    pass


def load_token():
    try:
        with open(AUTH_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError, UnicodeError) as exc:
        raise InternalError(f"cannot read auth file: {exc}")
    if not isinstance(data, dict):
        raise InternalError("invalid auth file")
    token = data.get("access_token")
    if not isinstance(token, str) or not token.strip():
        raise InternalError("bad access token")
    return token.strip()


def default_prompts():
    return [
        {
            "id": "add",
            "prompt": "Implement add(a, b) returning the sum of a and b.\nExample call: add(3, 4)",
            "checks": [{"expr": "result == 7"}],
        },
        {
            "id": "is_palindrome",
            "prompt": "Implement is_palindrome(s) returning True if s reads the same forwards and backwards.\nExample call: is_palindrome('racecar')",
            "checks": [{"expr": "result is True"}],
        },
        {
            "id": "count_vowels",
            "prompt": "Implement count_vowels(s) returning the number of vowels in s, case-insensitively.\nExample call: count_vowels('Beautiful')",
            "checks": [{"expr": "result == 3"}],
        },
    ]


def load_prompts(path):
    p = Path(path)
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        prompts = default_prompts()
        try:
            with p.open("w", encoding="utf-8") as f:
                json.dump(prompts, f, indent=2)
        except OSError as exc:
            raise InternalError(f"cannot write prompts file: {exc}")
        return prompts
    try:
        with p.open("r", encoding="utf-8") as f:
            prompts = json.load(f)
    except (OSError, json.JSONDecodeError, UnicodeError) as exc:
        raise InternalError(f"cannot read prompts file: {exc}")
    if not isinstance(prompts, list):
        raise InternalError("prompts file must contain a JSON list")
    return prompts


_CALL_RE = re.compile(r"(?<![A-Za-z0-9_])([A-Za-z_]\w*)\s*\(")


def find_calls(text):
    calls = []
    i = 0
    n = len(text)
    while i < n:
        m = _CALL_RE.search(text, i)
        if not m:
            break
        open_idx = m.end() - 1
        depth = 0
        in_str = False
        quote = ""
        escape = False
        j = open_idx
        while j < n:
            ch = text[j]
            if in_str:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == quote:
                    in_str = False
            else:
                if ch in ("'", '"'):
                    in_str = True
                    quote = ch
                elif ch == "(":
                    depth += 1
                elif ch == ")":
                    depth -= 1
                    if depth == 0:
                        calls.append((m.group(1), text[m.start() : j + 1]))
                        break
            j += 1
        if j < n:
            i = j + 1
        else:
            i = m.end()
    return calls


_FENCE_RE = re.compile(r"`{3}python[^\n]*\n(.*?)`{3}", re.DOTALL | re.IGNORECASE)


def extract_code(response):
    matches = _FENCE_RE.findall(response)
    if matches:
        return matches[-1].strip()
    return response.strip()


def request_code(model, prompt, token):
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1000,
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    content = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
            parsed = json.loads(raw)
            content = parsed["choices"][0]["message"]["content"]
            break
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403):
                raise InternalError("bad or unauthorized token")
            if exc.code == 429 and attempt < 3:
                time.sleep(attempt + 1)
                continue
            return None
        except (urllib.error.URLError, TimeoutError, socket.timeout, json.JSONDecodeError, KeyError, IndexError, TypeError, ValueError) as exc:
            if isinstance(exc, (urllib.error.URLError, TimeoutError, socket.timeout)) and attempt < 3:
                time.sleep(attempt + 1)
                continue
            return None
    if not isinstance(content, str):
        return None
    return extract_code(content)


def call_with_prompt(prompt, namespace, item_id):
    calls = find_calls(prompt)
    callables = [
        name
        for name, value in namespace.items()
        if callable(value) and not name.startswith("_")
    ]
    ordered_names = []
    if item_id in callables:
        ordered_names.append(item_id)
    for name in callables:
        if name not in ordered_names:
            ordered_names.append(name)

    for name in ordered_names:
        for fname, call in calls:
            if fname != name:
                continue
            try:
                return True, eval(call, namespace)
            except Exception:
                continue

    for fname, call in calls:
        if fname in namespace and callable(namespace.get(fname)):
            try:
                return True, eval(call, namespace)
            except Exception:
                continue

    if len(callables) == 1:
        try:
            return True, namespace[callables[0]]()
        except Exception:
            pass
    return False, None


def evaluate_prompt(item, model, token):
    record_id = "unknown"
    passed = False
    try:
        if not isinstance(item, dict):
            raise ValueError("bad prompt item")
        record_id = str(item.get("id", "prompt"))
        prompt = item.get("prompt")
        if not isinstance(prompt, str):
            raise ValueError("bad prompt")
        checks = item.get("checks", [])
        if not isinstance(checks, list):
            raise ValueError("bad checks")

        code = request_code(model, prompt, token)
        if not isinstance(code, str) or not code.strip():
            raise ValueError("no generated code")

        namespace = {}
        exec(code, namespace)

        ok, result = call_with_prompt(prompt, namespace, record_id)
        if not ok:
            raise ValueError("function call failed")

        for check in checks:
            if not isinstance(check, dict):
                raise ValueError("bad check")
            expr = check.get("expr")
            if not isinstance(expr, str):
                raise ValueError("bad check expression")
            if not eval(expr, {"result": result}):
                raise ValueError("check failed")
        passed = True
    except InternalError:
        raise
    except BaseException:
        passed = False
    return {"id": record_id, "passed": bool(passed)}


def main():
    parser = argparse.ArgumentParser()
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument("--model")
    mode_group.add_argument("--bench", nargs=2, metavar=("MODEL_A", "MODEL_B"))
    parser.add_argument("--prompts", default=DEFAULT_PROMPTS)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    token = load_token()

    self_test_prompt = {
        "id": "add",
        "prompt": "Implement add(a, b) returning the sum of a and b.\nExample call: add(3, 4)",
        "checks": [{"expr": "result == 7"}],
    }

    if args.bench is not None:
        model_a, model_b = args.bench
        if args.self_test:
            prompts = [self_test_prompt]
        else:
            prompts = load_prompts(args.prompts)

        bench_results = []
        a_passed_count = 0
        b_passed_count = 0
        for item in prompts:
            result_a = evaluate_prompt(item, model_a, token)
            result_b = evaluate_prompt(item, model_b, token)
            bench_results.append(
                {
                    "id": result_a["id"],
                    "a_passed": bool(result_a["passed"]),
                    "b_passed": bool(result_b["passed"]),
                }
            )
            if result_a["passed"]:
                a_passed_count += 1
            if result_b["passed"]:
                b_passed_count += 1

        total = len(prompts)
        pass_rates = {
            model_a: (a_passed_count / total) if total else 0.0,
            model_b: (b_passed_count / total) if total else 0.0,
        }
        output = {
            "models": [model_a, model_b],
            "results": bench_results,
            "pass_rates": pass_rates,
        }
        sys.stdout.write(json.dumps(output) + "\n")
        sys.stdout.flush()
        return 0

    if args.self_test:
        prompts = [self_test_prompt]
    else:
        prompts = load_prompts(args.prompts)

    results = [evaluate_prompt(item, args.model, token) for item in prompts]
    total = len(results)
    passed_count = sum(1 for item in results if item["passed"])
    rate = (passed_count / total) if total else 0.0
    output = {"model": args.model, "results": results, "pass_rate": rate}
    sys.stdout.write(json.dumps(output) + "\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    try:
        code = main()
    except SystemExit as exc:
        code = exc.code if exc.code is not None else 0
    except BaseException as exc:
        print(f"internal error: {exc}", file=sys.stderr)
        code = 1
    sys.exit(code)
