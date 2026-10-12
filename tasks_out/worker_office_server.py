#!/usr/bin/env python3
import argparse
import json
import os
import signal
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


class OfficeHandler(BaseHTTPRequestHandler):
    board_path = ""
    log_path = ""
    html_path = ""

    def log_message(self, format, *args):
        return

    def do_GET(self):
        try:
            parsed = urlsplit(self.path)
            if parsed.path == "/api/board":
                self.handle_board()
            elif parsed.path == "/":
                self.handle_root()
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

    def handle_board(self):
        try:
            with open(self.board_path, "r", encoding="utf-8") as f:
                board = json.load(f)
        except Exception:
            self.send_json(500, {"error": "board unreadable"})
            return

        ticks = []
        try:
            with open(self.log_path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.read().splitlines()
            ticks = [line for line in lines if line.strip()][-10:]
        except Exception:
            ticks = []

        if hasattr(board, "get"):
            window = board.get("window")
            tasks = board.get("tasks", [])
        else:
            window = None
            tasks = board if isinstance(board, list) else []

        self.send_json(200, {"window": window, "tasks": tasks, "recent_ticks": ticks})

    def handle_root(self):
        try:
            with open(self.html_path, "rb") as f:
                data = f.read()
        except OSError:
            data = b"<!DOCTYPE html><html><body>worker_office.html not built yet</body></html>"
        self.send_bytes(200, data, "text/html; charset=utf-8")

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
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    OfficeHandler.board_path = args.board
    OfficeHandler.log_path = args.log
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
    server.shutdown()
    server.server_close()
    serve_thread.join(timeout=5)


if __name__ == "__main__":
    main()
