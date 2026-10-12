#!/usr/bin/env python3
"""Verify worker_office_server.py end-to-end: start on a test port, hit both
endpoints, validate shapes, kill. Exit 0 + VERIFY-OK on success."""
import json
import os
import signal
import subprocess
import sys
import time
import urllib.request

PORT = 8799
BASE = f"http://127.0.0.1:{PORT}"
HERE = os.path.dirname(os.path.abspath(__file__))

proc = subprocess.Popen(
    [sys.executable, os.path.join(HERE, "worker_office_server.py"),
     "--port", str(PORT), "--board", os.path.join(HERE, "..", "board.json")],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

try:
    ok = False
    for _ in range(20):
        time.sleep(0.5)
        try:
            with urllib.request.urlopen(BASE + "/api/board", timeout=5) as r:
                board = json.loads(r.read())
            ok = True
            break
        except Exception:
            if proc.poll() is not None:
                print("server exited early:", proc.communicate(timeout=3))
                sys.exit(1)
    if not ok:
        print("server never came up on port", PORT)
        sys.exit(1)

    assert isinstance(board.get("window"), dict), "window missing"
    assert isinstance(board.get("tasks"), list), "tasks missing"
    assert isinstance(board.get("recent_ticks"), list), "recent_ticks missing"
    assert len(board["tasks"]) >= 1, "tasks empty"

    with urllib.request.urlopen(BASE + "/", timeout=5) as r:
        html = r.read(4000).decode(errors="replace")
    assert "html" in html.lower(), "index page is not html"
    assert "text/html" in (r.headers.get("Content-Type") or ""), "wrong content-type"

    print("VERIFY-OK")
finally:
    proc.send_signal(signal.SIGTERM)
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
