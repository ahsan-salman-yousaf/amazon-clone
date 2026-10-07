#!/usr/bin/env python3
"""Automatic prompt/response capture for Claude Code (8x assignment format).

Wired in .claude/settings.json:
  SessionStart     -> `agent_log.py session-start`  (remembers the session's model)
  UserPromptSubmit -> `agent_log.py prompt`         (appends a PROMPT entry, verbatim)
  Stop             -> `agent_log.py stop`           (appends the turn's final RESPONSE)

One file per session in .agent-logs/, named YYYY-MM-DD_HH-MM-SS_<session-id>.md.
Entries are append-only; only the front-matter counters are recomputed on each write.
The hook never blocks Claude Code: any error is written to .claude/agent-log-state/errors.log.
"""

import fcntl
import hashlib
import json
import os
import re
import sys
import time
import traceback
from datetime import UTC, datetime
from pathlib import Path

PROJECT_DIR = Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path(__file__).resolve().parents[2])
LOG_DIR = PROJECT_DIR / ".agent-logs"
STATE_DIR = PROJECT_DIR / ".claude" / "agent-log-state"  # gitignored bookkeeping, not logs
AUTHOR = os.environ.get("AGENT_LOG_AUTHOR", "ahsan-salman-yousaf")
TOOL = "claude-code"
ENTRY_RE = re.compile(r"^\[LOG_ENTRY type=(PROMPT|RESPONSE) num=(\d+) session=\w+\]$", re.M)
PROMPT_TIME_RE = re.compile(
    r"^\[LOG_ENTRY type=PROMPT num=\d+ session=\w+\]\ntimestamp: (\S+)$", re.M
)


def now_iso() -> str:
    dt = datetime.now(UTC)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def iso(ts: str | None) -> str:
    """Normalize a transcript timestamp to ...Z with milliseconds."""
    if not ts:
        return now_iso()
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(UTC)
        return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"
    except ValueError:
        return ts


# ------------------------------------------------------------------ state
def state_path(session_id: str) -> Path:
    return STATE_DIR / f"{session_id}.json"


def load_state(session_id: str) -> dict:
    try:
        return json.loads(state_path(session_id).read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_state(session_id: str, state: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state_path(session_id).write_text(json.dumps(state, indent=2))


# ------------------------------------------------------------------ transcript
def read_transcript(path: str | None) -> list[dict]:
    if not path or not Path(path).exists():
        return []
    out = []
    for line in Path(path).read_text(errors="replace").splitlines():
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def model_name(value) -> str | None:
    if isinstance(value, str) and value:
        return value
    if isinstance(value, dict):
        return value.get("id") or value.get("model") or value.get("display_name")
    return None


def last_model(entries: list[dict]) -> str | None:
    for e in reversed(entries):
        if e.get("type") == "assistant":
            m = model_name((e.get("message") or {}).get("model"))
            if m and m != "<synthetic>":
                return m
    return None


def is_human_prompt(e: dict) -> bool:
    """A user entry that is a typed prompt (not a tool result, meta or command output)."""
    if e.get("type") != "user" or e.get("isMeta") or e.get("isSidechain"):
        return False
    content = (e.get("message") or {}).get("content")
    if isinstance(content, str):
        return True
    if isinstance(content, list):
        return any(b.get("type") == "text" for b in content) and not any(
            b.get("type") == "tool_result" for b in content
        )
    return False


def final_response(entries: list[dict]) -> tuple[str, str | None, str | None, str | None]:
    """(text, timestamp, model, uuid) of the last turn's final answer.

    The final response is every assistant text block after the last tool call of the turn,
    i.e. what the user actually read at the end, without intermediate steps.
    """
    start = 0
    for i, e in enumerate(entries):
        if is_human_prompt(e):
            start = i
    blocks: list[tuple[str, dict]] = []
    for e in entries[start + 1 :]:
        if e.get("isSidechain"):
            continue
        msg = e.get("message") or {}
        content = msg.get("content")
        if e.get("type") == "assistant" and isinstance(content, list):
            if any(b.get("type") == "tool_use" for b in content):
                blocks = []  # anything before a tool call was intermediate
                continue
            texts = [b.get("text", "") for b in content if b.get("type") == "text" and b.get("text")]
            blocks += [(t, e) for t in texts]
        elif e.get("type") == "user" and isinstance(content, list) and any(
            b.get("type") == "tool_result" for b in content
        ):
            blocks = []
    if not blocks:
        return "", None, None, None
    last = blocks[-1][1]
    text = "\n\n".join(t for t, _ in blocks).strip()
    return (text, last.get("timestamp"), model_name((last.get("message") or {}).get("model")),
            last.get("uuid"))


# ------------------------------------------------------------------ log file
def log_file(session_id: str, first_time: str) -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    existing = sorted(LOG_DIR.glob(f"*_{session_id}.md"))
    if existing:
        return existing[0]
    stamp = datetime.fromisoformat(first_time.replace("Z", "+00:00")).strftime("%Y-%m-%d_%H-%M-%S")
    return LOG_DIR / f"{stamp}_{session_id}.md"


def render_header(session_id: str, body: str, model: str, created: str) -> str:
    prompts = [m for m in ENTRY_RE.finditer(body) if m.group(1) == "PROMPT"]
    times = PROMPT_TIME_RE.findall(body)
    short = session_id[:8]
    date = (times[0] if times else created)[:10]
    return (
        "---\n"
        f"session_id: {session_id}\n"
        f"date: {date}\n"
        f"author: {AUTHOR}\n"
        f"model: {model}\n"
        f"tool: {TOOL}\n"
        f"project: {PROJECT_DIR.name}\n"
        f"total_exchanges: {len(prompts)}\n"
        f"first_prompt_time: {times[0] if times else ''}\n"
        f"last_prompt_time: {times[-1] if times else ''}\n"
        "---\n\n"
        f"# Session Log - {date}\n\n"
        f"Session: `{short}` | Project: `{PROJECT_DIR.name}` | Author: `{AUTHOR}`\n\n"
        "---\n"
    )


def append_entry(session_id: str, kind: str, num: int, timestamp: str, model: str,
                 text: str) -> None:
    path = log_file(session_id, timestamp)
    lock = STATE_DIR / f"{session_id}.lock"
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with open(lock, "w") as lf:
        fcntl.flock(lf, fcntl.LOCK_EX)
        old = path.read_text() if path.exists() else ""
        # layout: front matter, "---", title + session line, "---", then entries (kept verbatim)
        parts = old.split("\n---\n")
        body = "\n---\n".join(parts[2:]) if old.startswith("---\n") and len(parts) > 2 else ""
        entry = (
            f"\n[LOG_ENTRY type={kind} num={num} session={session_id[:8]}]\n"
            f"timestamp: {timestamp}\n"
            f"model: {model}\n\n"
            f"{text}\n\n"
        )
        body = body + entry
        tmp = path.with_suffix(".md.tmp")
        tmp.write_text(render_header(session_id, body, model, timestamp) + body)
        tmp.replace(path)


def count_prompts(session_id: str) -> int:
    files = sorted(LOG_DIR.glob(f"*_{session_id}.md"))
    if not files:
        return 0
    return sum(1 for m in ENTRY_RE.finditer(files[0].read_text()) if m.group(1) == "PROMPT")


# ------------------------------------------------------------------ events
def on_session_start(payload: dict) -> None:
    sid = payload["session_id"]
    state = load_state(sid)
    m = model_name(payload.get("model")) or last_model(read_transcript(payload.get("transcript_path")))
    if m:
        state["model"] = m
    save_state(sid, state)


def on_prompt(payload: dict) -> None:
    sid = payload["session_id"]
    state = load_state(sid)
    model = (model_name(payload.get("model"))
             or last_model(read_transcript(payload.get("transcript_path")))
             or state.get("model") or os.environ.get("ANTHROPIC_MODEL") or "unknown")
    state["model"] = model
    num = count_prompts(sid) + 1
    state["current_num"] = num
    save_state(sid, state)
    prompt = payload.get("prompt")
    if prompt is None:
        prompt = payload.get("prompt_text", "")
    append_entry(sid, "PROMPT", num, now_iso(), model, prompt)


def on_stop(payload: dict) -> None:
    sid = payload["session_id"]
    state = load_state(sid)
    if "current_num" not in state:
        return  # no prompt captured in this session yet
    entries = read_transcript(payload.get("transcript_path"))
    model = last_model(entries) or state.get("model") or "unknown"
    # Stop's payload carries the final assistant text itself; the transcript may lag behind.
    text = (payload.get("last_assistant_message") or "").strip()
    ts = now_iso()
    if not text:
        for _ in range(10):
            text, t_ts, t_model, _uuid = final_response(read_transcript(payload.get("transcript_path")))
            if text:
                ts, model = iso(t_ts), t_model or model
                break
            time.sleep(0.3)
    if not text:
        return
    key = f"{state['current_num']}:{hashlib.sha256(text.encode()).hexdigest()}"
    if key == state.get("last_response_key"):
        return  # same final response already recorded for this prompt
    state.update(last_response_key=key, model=model)
    save_state(sid, state)
    append_entry(sid, "RESPONSE", state["current_num"], ts, model, text)


def main() -> None:
    event = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        payload = json.load(sys.stdin)
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        (STATE_DIR / f"last-{event}-payload.json").write_text(json.dumps(payload, indent=2))
        {"session-start": on_session_start, "prompt": on_prompt, "stop": on_stop}[event](payload)
    except Exception:  # never break the user's session
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with open(STATE_DIR / "errors.log", "a") as f:
            f.write(f"{now_iso()} {event}\n{traceback.format_exc()}\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
