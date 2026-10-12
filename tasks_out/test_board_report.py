import importlib.util
import json
import subprocess
import sys
from pathlib import Path


def _find_module() -> Path:
    here = Path(__file__).resolve()
    for directory in (here.parent, *here.parents):
        candidate = directory / "tasks_out" / "board_report.py"
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("could not locate tasks_out/board_report.py from __file__")


MODULE_PATH = _find_module()

_spec = importlib.util.spec_from_file_location("board_report_under_test", MODULE_PATH)
board_report = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(board_report)


def _counts_line(tasks, status="open"):
    pending = sum(task["status"] in ("pending", "in_progress") for task in tasks)
    done = sum(task["status"] == "done" for task in tasks)
    failed = sum(task["status"] == "failed" for task in tasks)
    return f"BOARD: {pending} pending, {done} done, {failed} failed | window: {status}"


def _candidate_shapes(tasks, status):
    return [
        {"window": {"status": status}, "tasks": tasks},
        {"window_status": status, "tasks": tasks},
        {"window": status, "tasks": tasks},
        {"window": {"state": status}, "tasks": tasks},
        {"status": status, "tasks": tasks},
    ]


def _make_working_board(tmp_path, tasks, status="open"):
    expected_first_line = _counts_line(tasks, status)
    for index, candidate in enumerate(_candidate_shapes(tasks, status)):
        path = tmp_path / f"board_{index}.json"
        path.write_text(json.dumps(candidate), encoding="utf-8")
        result = subprocess.run(
            [sys.executable, str(MODULE_PATH), str(path)],
            capture_output=True,
            text=True,
        )
        if (
            result.returncode == 0
            and result.stdout.splitlines()
            and result.stdout.splitlines()[0] == expected_first_line
        ):
            return path

    fallback = tmp_path / "board_fallback.json"
    fallback.write_text(
        json.dumps({"window": {"status": status}, "tasks": tasks}),
        encoding="utf-8",
    )
    return fallback


def test_first_line_counts(tmp_path):
    tasks = [
        {"id": "t1", "status": "pending", "attempts": 0, "title": "pending task"},
        {"id": "t2", "status": "done", "attempts": 1, "title": "done one"},
        {"id": "t3", "status": "done", "attempts": 2, "title": "done two"},
        {"id": "t4", "status": "failed", "attempts": 3, "title": "failed task"},
    ]
    board_path = _make_working_board(tmp_path, tasks, "open")
    result = subprocess.run(
        [sys.executable, str(MODULE_PATH), str(board_path)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    lines = result.stdout.splitlines()
    assert lines[0] == "BOARD: 1 pending, 2 done, 1 failed | window: open"


def test_task_lines_format_and_in_progress_pending(tmp_path):
    tasks = [
        {"id": "a", "status": "pending", "attempts": 0, "title": "Alpha"},
        {"id": "b", "status": "in_progress", "attempts": 2, "title": "Beta"},
        {"id": "c", "status": "done", "attempts": 1, "title": "Gamma"},
    ]
    board_path = _make_working_board(tmp_path, tasks, "open")
    result = subprocess.run(
        [sys.executable, str(MODULE_PATH), str(board_path)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    lines = result.stdout.splitlines()
    assert lines[0] == "BOARD: 2 pending, 1 done, 0 failed | window: open"
    expected_task_lines = [
        "a | pending | attempts=0 | Alpha",
        "b | in_progress | attempts=2 | Beta",
        "c | done | attempts=1 | Gamma",
    ]
    assert lines[1:1 + len(expected_task_lines)] == expected_task_lines


def test_missing_file_exit_code(tmp_path):
    missing = tmp_path / "does_not_exist.json"
    result = subprocess.run(
        [sys.executable, str(MODULE_PATH), str(missing)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert result.stderr.strip() != ""


def test_valid_json_wrong_shape_no_traceback(tmp_path):
    wrong_shape = tmp_path / "wrong.json"
    wrong_shape.write_text('{"hello": "world"}', encoding="utf-8")
    result = subprocess.run(
        [sys.executable, str(MODULE_PATH), str(wrong_shape)],
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "Traceback" not in result.stderr
