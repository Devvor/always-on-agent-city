#!/usr/bin/env python3
import argparse
import json
import signal
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

BOARD_PATH = "/opt/data/missingno-worker/board.json"
LOG_PATH = "/opt/data/missingno-worker/logs/tick.log"
PORT = 8798
SCRIPT_DIR = Path(__file__).resolve().parent
HTML_PATH = SCRIPT_DIR / "worker_office.html"


class WorkerOfficeHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        return

    def _send_bytes(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        path = urlsplit(self.path).path
        try:
            if path == "/api/board":
                self.handle_board()
            elif path == "/":
                self.handle_index()
            else:
                self._send_bytes(404, b"Not Found", "text/plain; charset=utf-8")
        except Exception:
            self._send_bytes(500, b'{"error": "board unreadable"}', "application/json")

    def handle_board(self):
        try:
            with open(BOARD_PATH, "r", encoding="utf-8") as f:
                board = json.load(f)
            window = board["window"]
            tasks = board["tasks"]
        except Exception:
            self._send_bytes(500, b'{"error": "board unreadable"}', "application/json")
            return

        recent_ticks = []
        try:
            with open(LOG_PATH, "r", encoding="utf-8", errors="replace") as f:
                for line in f:
                    if line.strip():
                        recent_ticks.append(line.rstrip("\r\n"))
            recent_ticks = recent_ticks[-10:]
        except OSError:
            recent_ticks = []

        payload = {
            "window": window,
            "tasks": tasks,
            "recent_ticks": recent_ticks,
        }
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send_bytes(200, body, "application/json; charset=utf-8")

    def handle_index(self):
        try:
            body = HTML_PATH.read_bytes()
        except FileNotFoundError:
            body = b"<html><body>worker_office.html not built yet</body></html>"
        self._send_bytes(200, body, "text/html; charset=utf-8")


def main():
    global BOARD_PATH, LOG_PATH, PORT

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8798)
    parser.add_argument("--board", default="/opt/data/missingno-worker/board.json")
    parser.add_argument("--log", default="/opt/data/missingno-worker/logs/tick.log")
    args = parser.parse_args()

    PORT = args.port
    BOARD_PATH = args.board
    LOG_PATH = args.log

    server = ThreadingHTTPServer(("127.0.0.1", PORT), WorkerOfficeHandler)

    def stop_server(*_args):
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, stop_server)
    signal.signal(signal.SIGTERM, stop_server)

    print(f"worker office serving on 127.0.0.1:{PORT}", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
