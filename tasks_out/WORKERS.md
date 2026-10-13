# WORKERS.md

## Overview

The missingno-worker is an always-on automation loop that builds code from a task board at zero marginal cost. It runs as a cron job every twenty minutes, reads a single JSON state file, and produces verified, committed output without human intervention. Because it is restricted to free-window models, the cost of every tick is $0.00.

The worker is designed to be boring. It does one thing at a time, it fails loudly when its assumptions are violated, and it never touches anything outside its quarantine directory. New engineers should understand that the entire system is a thin cron wrapper around a language model, a JSON file, and a git repository. There are no hidden services, no background daemons, and no external dependencies beyond the model provider.

The primary design goal is unattended code generation. A human creates a task on the board, and the worker eventually produces a committed, verified change. The human reviews the commit and merges it. The worker never merges; it only commits to a feature branch or a dedicated worker branch. This separation of duties ensures that a human is always in the loop for the final integration step.

Operators monitor the system through the Office dashboard, which provides a live view of the board. The dashboard is read-only and runs on the same host as the worker. The system is intended for small, well-scoped tasks such as adding a utility function, writing a test, or updating documentation. Large refactors are discouraged because the model has limited context and the verify step must be fast.

## Architecture

The toolchain is deliberately minimal. There is no database, no queue, and no external orchestration service. All state lives in `board.json`.

- **State file**: `board.json` is the only source of truth. It records the current model window and the list of tasks. If the file is missing or malformed, the tick exits without side effects. The file is written atomically: the worker writes to a temporary file and then renames it, so a crash mid-write cannot corrupt the board.
- **Tick script**: `missingno_worker_tick.py` is the entry point. Cron invokes it every 20 minutes with the `no_agent` flag, meaning it runs unattended. The script is idempotent: if a previous tick crashed, the next tick will recover the board state. Any task left in `in_progress` from a previous run is reset to `pending` (unless it has exhausted its attempts).
- **Health gate**: Before any work begins, the tick script performs three checks in order:
  1. The model must be present in the current window.
  2. The model must be priced at $0.
  3. The model must pass a canary call.
  If any check fails, the tick exits immediately. After the first failure, alerts are suppressed so that a dead free window does not generate noise. The gate is the only place where the worker talks to the outside world besides the model API itself.
- **Task selection**: Exactly one task is processed per tick. This keeps each run short, predictable, and easy to debug. The worker picks the oldest `pending` task. If no tasks are pending, the tick exits successfully without doing any work.
- **Attempts**: Each task allows a maximum of 3 attempts. After a failed attempt, the error feedback is appended to the task spec so the next attempt can learn from the mistake. On the third failure, the task is marked `failed` and skipped. The `attempts` counter is incremented before each model call.
- **Commit**: When a task is completed and its verify command passes, the worker creates a git commit in the repository. The commit message includes the task ID and title. The worker commits only the files under `tasks_out/` that were generated for that task; it never runs `git add .`.

The canary call is a minimal prompt that asks the model to return a fixed string. If the response does not match, the gate fails. This catches cases where the endpoint is reachable but returning errors. The model call itself is a single completion request. The prompt is constructed from the task spec plus a system message that describes the output format. The worker expects the model to return a code block or a file path; anything else is treated as a failure.

### Tick lifecycle

A single tick follows this sequence:

1. Load `board.json` from disk.
2. Run the health gate. If it fails, exit.
3. Select the oldest `pending` task. If none, exit.
4. Mark the task `in_progress` and increment `attempts`.
5. Call the model with the task spec.
6. Write the generated code to `tasks_out/`.
7. Run the verify command in the repository directory.
8. If verify passes, mark the task `done` and create a git commit.
9. If verify fails, append the error output to the spec and mark the task `pending` (or `failed` if attempts are exhausted).
10. Write the updated `board.json` back to disk atomically.

If the model returns a response that cannot be parsed into a file write, the tick treats it as a verify failure. The error message includes the raw model output so the next attempt can adjust.

## The Board

`board.json` has the following shape:

    {
      "window": {
        "model": "string",
        "status": "string",
        "checked_at": "ISO-8601 timestamp"
      },
      "tasks": [
        {
          "id": "string",
          "title": "string",
          "status": "pending|in_progress|done|failed",
          "attempts": 0,
          "target_file": "path/to/file",
          "verify_cmd": "command to run",
          "spec": "detailed instructions"
        }
      ]
    }

- `window` describes the current free-model window. The `status` field is typically `open` or `closed`. The `checked_at` timestamp is updated every time the health gate runs.
- `tasks` is an array of work items. Only tasks with status `pending` are eligible for selection.
- `status` transitions are: `pending` -> `in_progress` -> `done` or `failed`. A task can also go from `in_progress` back to `pending` if the tick crashes and the attempt count is below the maximum.
- `attempts` is an integer counter. It is incremented on each failure. When it reaches 3, the task is marked `failed`.
- `target_file` is the path where the generated code should be written, relative to the repository root. The worker writes the file under `tasks_out/` using this path as a suffix.
- `verify_cmd` is a shell command that must exit with code 0 for the task to be considered successful. The command runs in the repository directory.
- `spec` contains the natural-language instructions for the model. On retry, the previous error output is appended to this field so the model can see what went wrong.
- `id` must be unique across the board. It is used in commit messages, log lines, and the Office dashboard.

Tasks are created by editing `board.json` directly or by using a small helper script. There is no web UI for task creation; the board is treated as a configuration file under version control.

### Example task

    {
      "id": "task-001",
      "title": "Add health check endpoint",
      "status": "pending",
      "attempts": 0,
      "target_file": "src/routes/health.py",
      "verify_cmd": "python -m pytest tests/test_health.py",
      "spec": "Create a Flask route at /health that returns JSON {'status': 'ok'} with HTTP 200."
    }

## Safety rules

The worker operates under strict quarantine to prevent accidental damage:

- **Write scope**: The worker only writes files under `tasks_out/`. It never modifies source files directly; generated code is placed in the quarantine directory first. A human or a separate promotion step moves files from `tasks_out/` into the main tree. The `tasks_out/` directory is the only writable path in the worker's container.
- **Verify commands**: Verification commands run in the repository directory, but they are executed through the hardened wrapper `/bin/sh.00` to prevent shell injection and limit blast radius. The wrapper enforces a timeout and a restricted environment. It also logs every invocation for audit purposes.
- **No live systems**: The worker has no credentials, no network access to production, and no ability to touch live systems. It runs in an isolated container with read-only access to everything except `tasks_out/`. The container has no SSH keys, no cloud credentials, and no database connection strings.
- **Free-window death**: If the free window closes, the health gate catches it. The worker sends one alert and then remains silent until the window reopens. This prevents alert fatigue when the upstream provider rotates models. The alert includes the model name and the timestamp of the last successful check.

The worker process runs as a non-root user inside the container. File permissions are set so that only the worker user can write to `tasks_out/`. Alerts are sent through a simple webhook. The first time the health gate fails, a single message is posted. Subsequent failures within the same window are ignored. When the window reopens, the alert state is reset.

## The Office

`worker_office_server.py` is a lightweight HTTP server that binds to loopback port 8798.

- **API**: It serves `/api/board`, which returns the current contents of `board.json` as JSON. The response is cached for a few seconds to avoid excessive disk reads. The endpoint is read-only; there is no way to mutate the board through the API.
- **Static files**: It also serves the front-end assets, including `worker_office.js` and any CSS or image files. The server uses a simple static file handler with no templating engine.
- **Visualization**: `worker_office.js` fetches the board data and renders a 2.5D office scene. Each task appears as a desk or worker avatar, updating in real time as the board changes. The visualization is purely cosmetic; it does not affect the worker's behavior. The 2.5D effect is achieved with CSS transforms and a simple isometric grid.

The front-end is vanilla JavaScript with no build step. It polls `/api/board` every few seconds and diffs the response to trigger animations. The 2.5D office is rendered on a canvas element. The server is started by systemd and restarts automatically if it crashes. It logs to stdout, which is captured by journald.

## Cost

All model calls are made to zero-priced free-window models. The tick script enforces this: if the pricing endpoint ever returns a value greater than $0, the tick refuses to run and logs the refusal. This guarantees that the worker never incurs unexpected charges.

The cost model is simple: the only expense is the compute time of the cron host. Because the worker is I/O-bound and sleeps between ticks, the host can be a small, cheap instance. There are no API keys with billing attached, no usage metering, and no surprise invoices. If the upstream provider introduces pricing for a previously free model, the health gate will block the tick before any money is spent.

The pricing check queries the provider's model metadata endpoint. It compares the `pricing` field against zero. If the field is missing, the tick treats it as non-zero and refuses to run. There is no rate limiting in the worker itself because the free window already imposes usage caps. The tick script simply respects the 20-minute cron interval.
