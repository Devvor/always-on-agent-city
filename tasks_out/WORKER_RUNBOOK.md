```markdown
# Worker Fleet Runbook

This runbook covers the day-to-day operation of the worker fleet: how the tick
runs, how to seed new work, how to recover from failures, and how to run a
second worker alongside the first. Read it top to bottom once; after that the
section headers are enough to find what you need.

The fleet is deliberately quiet. Most of the time nothing happens, and that is
the correct behaviour. The only message that requires a human is an ALERT.

---

## Daily operation

- A cron job fires the tick every 20 minutes. You do not start it by hand and
  you do not need to watch it.
- Each tick reads the board, claims the next pending task, runs the model,
  writes the result, and updates the board.
- If the board has no pending tasks, the tick is silent. No message is posted,
  no error is logged. An empty board is a normal, healthy state.
- When a task finishes, you get exactly one line in the ops thread:

      DONE t-014 — write the changelog entry

  or, on failure:

      FAILED t-014 — verify_cmd exited 1

- When the model window closes, you get an ALERT line in the ops thread. That
  is the only message that means "a human must act now". See Window death.
- If you have seen no output at all for more than an hour, do not assume the
  fleet is idle — check that the cron is actually firing (see Diagnosis).

---

## Seeding new tasks

- Open board.json and append one object to the tasks array. Keep the JSON
  valid; a single trailing comma will break every tick until someone notices.
- Required fields:

  - id — a short unique slug such as t-014. Never reuse an id, even after the
    task is done. The log lines and ops messages are keyed on it.
  - title — one line, human readable. This is what shows up in the ops thread.
  - spec — the instructions handed to the model. It must contain a
    verify_cmd: a shell command that exits 0 when the work is correct and
    non-zero when it is not. If you cannot write a machine-checkable
    verify_cmd, the task is not ready to seed. A human reading the output is
    not a verify_cmd.
  - target_file — where the model writes its answer. Always under tasks_out/,
    for example tasks_out/t-014.md. Nothing outside tasks_out/ is writable.

- For edits of existing files, add include_files: a list of paths the model is
  allowed to read before it writes. Without include_files the model edits
  blind and will happily clobber content it never saw. Include every file the
  edit touches, not just the one being changed.

- A minimal seed looks like this:

      {
        "id": "t-015",
        "title": "add retry note to the deploy guide",
        "spec": "Append a short paragraph about retrying failed deploys. ",
        "verify_cmd": "grep -q retry tasks_out/t-015.md",
        "target_file": "tasks_out/t-015.md",
        "include_files": ["docs/deploy.md"]
      }

- Save the file. The next tick picks the task up on its own. Do not restart
  anything.

---

## Resetting a failed task

- Open board.json and find the task by its id.
- Set status back to "pending".
- Set attempts to 0.
- Save. The next tick will claim it again.
- Do not delete the task. The attempt history is the only record of what went
  wrong, and it is what you will read when the same task fails again.
- If a task has failed three times in a row, stop resetting it. The problem is
  almost always the spec or the verify_cmd, not the worker. Fix the task
  definition first, then reset.

---

## Diagnosis

- Everything the worker does is written to logs/tick.log. Tail it before you
  do anything else:

      tail -n 50 logs/tick.log

- The three failures you will actually see:

  - Empty content. The model spent its entire reasoning budget before it wrote
    a single token, so the output file is empty. Shorten the spec, remove
    ambiguity, or split the task into two smaller ones.

  - verify reports "no output". The grader command printed nothing and exited
    non-zero, so the log line is useless. The verify_cmd is too silent. Make
    it echo a reason on failure, for example:

        grep -q retry tasks_out/t-015.md || { echo "missing retry section"; exit 1; }

  - 429. The free tier is out of capacity. The tick retries on its own and
    needs no action. Only escalate if 429s repeat for hours with no
    successful tick in between.

- If the log stops growing entirely, the cron is dead, not the worker. Check
  the crontab entry and the worker process before touching the board.

---

## Window death

- The gate watches the model window continuously. It closes the worker
  automatically the moment the price goes above 0 or the model disappears
  from the provider. You do not get a choice about this; it is the safety
  rail that stops the fleet from spending money.
- When the window closes, the ops thread gets an ALERT and every subsequent
  tick becomes a no-op. The board is untouched and no tasks are lost.
- To recover, pick one of two options:

  - Repoint. Change window.model in the config to another free model. The
    next tick resumes normally against the new model.

  - Pause. Comment out the cron line and leave the fleet dark until a free
    window exists again. This is the right choice if no free model is
    currently good enough for the work.

- Do not edit the board to "fix" a dead window. The board is fine. The window
  is what died, and no amount of task editing will bring it back.

---

## Multi-worker

- Worker #2 is a separate process, not a second thread. It runs from
  missingno_worker_tick2.py.
- It has its own board, board_step5.json, and its own log file. The two
  workers never claim the same task and never write to the same log, so they
  cannot interfere with each other.
- The tick script is parametrized entirely by environment variables:

  - WBOARD — path to the board file this worker reads and writes.
  - WLOG — path to the log file this worker appends to.
  - WNAME — the label used in log lines and ops messages, so you can tell at
    a glance which worker spoke.

- Set them in the cron line or in the worker's env file. Same script,
  different environment, second worker:

      WBOARD=board_step5.json WLOG=logs/tick2.log WNAME=worker2 \
        python missingno_worker_tick2.py

- Keep the two boards disjoint. If both workers ever point at the same board,
  they will race for the same task and one of them will lose.

---

## Quick reference

- Nothing in the ops thread for an hour: check the cron, then logs/tick.log.
- Task failed: read the log line, fix the spec or verify_cmd, reset status to
  pending and attempts to 0.
- ALERT in the ops thread: the window died. Repoint window.model or pause the
  cron.
- Need more throughput: start worker #2 with its own WBOARD, WLOG, and WNAME.
```
