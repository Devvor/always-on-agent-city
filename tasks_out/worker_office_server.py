#!/usr/bin/env python3
import argparse
import json
import os
import signal
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


MAIN_BOARD_ATTRS = (
    "board_path",
    "board",
    "main_board",
    "main_board_path",
    "board_main_path",
    "primary_board_path",
)

EXTRA_BOARD_ATTRS = (
    "extra_board_path",
    "extra_board",
    "extra_path",
    "step_board",
    "step_board_path",
    "step5_board",
    "step5_board_path",
    "secondary_board_path",
    "board_step5_path",
    "board_extra_path",
)

MAIN_LOG_ATTRS = (
    "log_path",
    "log",
    "main_log",
    "main_log_path",
    "primary_log_path",
)

EXTRA_LOG_ATTRS = (
    "extra_log_path",
    "extra_log",
    "step_log",
    "step_log_path",
    "step5_log",
    "step5_log_path",
    "secondary_log_path",
    "log_step5_path",
)


class OfficeHandler(BaseHTTPRequestHandler):
    board_path = ""
    main_board_path = ""
    board_main_path = ""
    primary_board_path = ""

    extra_board_path = ""
    extra_path = ""
    step_board_path = ""
    step5_board_path = ""
    secondary_board_path = ""
    board_step5_path = ""
    board_extra_path = ""
    extra_board = ""

    log_path = ""
    main_log_path = ""
    primary_log_path = ""

    extra_log_path = ""
    step_log_path = ""
    step5_log_path = ""
    secondary_log_path = ""
    log_step5_path = ""
    extra_log = ""

    html_path = ""

    def log_message(self, format, *args):
        return

    _syntax_cache = {}

    def handle_modules(self):
        try:
            import glob
            import subprocess
            base = os.path.dirname(os.path.abspath(self.html_path))
            files = []
            for p in sorted(glob.glob(os.path.join(base, "worker_*.js"))):
                name = os.path.basename(p)
                if name in ("worker_office.js", "worker_office_sound.js"):
                    continue
                # only serve modules that parse: failed-task residue must not
                # reach the page. Cache the node --check result by mtime.
                mtime = os.path.getmtime(p)
                cached = OfficeHandler._syntax_cache.get(name)
                if cached and cached[0] == mtime:
                    ok = cached[1]
                else:
                    r = subprocess.run(
                        ["node", "--check", p],
                        capture_output=True, timeout=15)
                    ok = r.returncode == 0
                    OfficeHandler._syntax_cache[name] = (mtime, ok)
                if ok:
                    files.append(name)
            body = json.dumps(files).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except Exception:
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            body = b'{"error":"modules listing failed"}'
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def do_GET(self):
        try:
            parsed = urlsplit(self.path)
            if parsed.path == "/api/board":
                self.handle_board()
            elif parsed.path == "/api/modules":
                self.handle_modules()
            elif parsed.path == "/":
                self.handle_root()
            elif parsed.path.endswith(".js") or parsed.path.endswith(".html"):
                self.handle_static(parsed.path)
            else:
                self.send_response(404)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                body = b"Not Found"
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            try:
                body = b'{"error":"internal server error"}'
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception:
                pass

    def _resolve_attr(self, names):
        for name in names:
            value = getattr(self, name, "")
            if isinstance(value, str):
                if value.strip():
                    return value.strip()
            elif value:
                return value
        return ""

    @staticmethod
    def _read_ticks(path):
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.read().splitlines()
            return [line for line in lines if line.strip()][-10:]
        except Exception:
            return []

    def _build_worker(self, name, board_path, log_path):
        ticks = self._read_ticks(log_path)
        if not board_path:
            return {"error": "board missing"}
        try:
            with open(board_path, "r", encoding="utf-8") as f:
                board = json.load(f)
        except FileNotFoundError:
            return {"error": "board missing"}
        except Exception:
            return {"error": "board unreadable"}

        window = None
        tasks = []
        if isinstance(board, dict):
            window = board.get("window") if hasattr(board, "get") else None
            tasks = board.get("tasks", []) if hasattr(board, "get") else []
        elif isinstance(board, list):
            tasks = board

        model = None
        if isinstance(window, dict):
            model = window.get("model")
        elif window is not None and hasattr(window, "get"):
            try:
                model = window.get("model")
            except Exception:
                model = None
        elif hasattr(window, "model"):
            model = getattr(window, "model", None)

        return {
            "name": name,
            "model": model,
            "window": window,
            "tasks": tasks,
            "recent_ticks": ticks,
        }

    def handle_board(self):
        main_board_path = self._resolve_attr(MAIN_BOARD_ATTRS)
        extra_board_path = self._resolve_attr(EXTRA_BOARD_ATTRS)
        if not extra_board_path and main_board_path:
            extra_board_path = os.path.join(
                os.path.dirname(os.path.abspath(main_board_path)), "board_step5.json"
            )

        main_log_path = self._resolve_attr(MAIN_LOG_ATTRS)
        extra_log_path = self._resolve_attr(EXTRA_LOG_ATTRS)
        if not extra_log_path:
            candidates = []
            if main_log_path:
                candidates.append(
                    os.path.join(os.path.dirname(os.path.abspath(main_log_path)), "tick_step5.log")
                )
            if extra_board_path:
                candidates.append(
                    os.path.join(
                        os.path.dirname(os.path.abspath(extra_board_path)), "logs", "tick_step5.log"
                    )
                )
            if main_board_path:
                candidates.append(
                    os.path.join(
                        os.path.dirname(os.path.abspath(main_board_path)), "logs", "tick_step5.log"
                    )
                )
            if candidates:
                chosen = None
                for candidate in candidates:
                    if os.path.exists(candidate):
                        chosen = candidate
                        break
                extra_log_path = chosen if chosen is not None else candidates[0]

        laguna_board = None
        if main_board_path:
            laguna_board = os.path.join(
                os.path.dirname(os.path.abspath(main_board_path)), "board_laguna.json"
            )
        longcat_board = None
        if main_board_path:
            longcat_board = os.path.join(
                os.path.dirname(os.path.abspath(main_board_path)), "board_longcat.json"
            )
        deepseek_board = None
        if main_board_path:
            deepseek_board = os.path.join(
                os.path.dirname(os.path.abspath(main_board_path)), "board_deepseek.json"
            )
        boards_dir = os.path.dirname(os.path.abspath(main_board_path)) if main_board_path else ""
        workers = [
            self._build_worker("missingno", main_board_path, main_log_path),
            self._build_worker("step5", extra_board_path, extra_log_path),
            self._build_worker("laguna", laguna_board, os.path.join(boards_dir, "logs", "tick_laguna.log")),
            self._build_worker("longcat", longcat_board, os.path.join(boards_dir, "logs", "tick_longcat.log")),
            self._build_worker("deepseek", deepseek_board, os.path.join(boards_dir, "logs", "tick_deepseek.log")),
        ]

        first = workers[0] if workers else {}
        if isinstance(first, dict):
            window = first.get("window")
            tasks = first.get("tasks", [])
            ticks = first.get("recent_ticks", [])
        else:
            window = None
            tasks = []
            ticks = []

        self.send_json(
            200,
            {
                "workers": workers,
                "window": window,
                "tasks": tasks,
                "recent_ticks": ticks,
            },
        )

    def handle_root(self):
        try:
            with open(self.html_path, "rb") as f:
                data = f.read()
        except OSError:
            data = b"<!DOCTYPE html><html><body>worker_office.html not built yet</body></html>"
        self.send_bytes(200, data, "text/html; charset=utf-8")

    def handle_static(self, path):
        """Serve only .js/.html files from the script's own directory (no traversal)."""
        name = os.path.basename(path)
        if name.startswith("."):
            self.send_json(404, {"error": "not found"})
            return
        full = os.path.join(os.path.dirname(os.path.abspath(self.html_path)), name)
        try:
            with open(full, "rb") as f:
                data = f.read()
        except OSError:
            self.send_json(404, {"error": "not found"})
            return
        ctype = "application/javascript; charset=utf-8" if name.endswith(".js") else "text/html; charset=utf-8"
        self.send_bytes(200, data, ctype)

    def send_json(self, status, payload):
        body = (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")
        self.send_bytes(status, body, "application/json; charset=utf-8")

    def send_bytes(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8798)
    parser.add_argument("--board", default="/opt/data/missingno-worker/board.json")
    parser.add_argument("--log", default="/opt/data/missingno-worker/logs/tick.log")
    parser.add_argument("--extra-board", dest="extra_board", default=None)
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    main_board = args.board
    if args.extra_board is None:
        repo_root = os.path.dirname(os.path.abspath(main_board))
        extra_board = os.path.join(repo_root, "board_step5.json")
    else:
        extra_board = args.extra_board

    main_log = args.log
    step_log = os.path.join(os.path.dirname(os.path.abspath(main_log)), "tick_step5.log")

    for attr in MAIN_BOARD_ATTRS:
        setattr(OfficeHandler, attr, main_board)
    for attr in EXTRA_BOARD_ATTRS:
        setattr(OfficeHandler, attr, extra_board)
    for attr in MAIN_LOG_ATTRS:
        setattr(OfficeHandler, attr, main_log)
    for attr in EXTRA_LOG_ATTRS:
        setattr(OfficeHandler, attr, step_log)
    OfficeHandler.html_path = os.path.join(script_dir, "worker_office.html")

    server = ThreadingHTTPServer(("127.0.0.1", args.port), OfficeHandler)

    print(f"worker office serving on 127.0.0.1:{args.port}", flush=True)

    serve_thread = threading.Thread(target=server.serve_forever, daemon=True)
    serve_thread.start()

    stop_event = threading.Event()

    def stop_handler(signum, frame):
        stop_event.set()

    signal.signal(signal.SIGINT, stop_handler)
    signal.signal(signal.SIGTERM, stop_handler)

    stop_event.wait()
    try:
        server.shutdown()
    except Exception:
        pass
    server.server_close()
    serve_thread.join(timeout=5)


if __name__ == "__main__":
    main()
