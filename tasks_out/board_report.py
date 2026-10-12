#!/usr/bin/env python3
import json
import sys


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "/opt/data/missingno-worker/board.json"

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        window_status = data["window"]["status"]
        tasks = data["tasks"]

        pending = 0
        done = 0
        failed = 0
        task_lines = []

        for task in tasks:
            task_id = task["id"]
            status = task["status"]
            attempts = task["attempts"]
            title = task["title"]

            if status in ("pending", "in_progress"):
                pending += 1
            elif status == "done":
                done += 1
            elif status == "failed":
                failed += 1

            task_lines.append(
                f"{task_id} | {status} | attempts={attempts} | {title}"
            )

        print(f"BOARD: {pending} pending, {done} done, {failed} failed | window: {window_status}")
        for line in task_lines:
            print(line)

        return 0
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
