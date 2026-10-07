# Capture setup notes (input for CAPTURE-TEST.md)

These notes record how the capture hook was set up and what went wrong first. They were written by the setup session, because that session itself could not be captured (see point 1).

## Setup

**Tool:** Claude Code CLI 2.1.291.

**Model:** Claude Opus 5.5 (`claude-opus-5-5`, 1M context). It both plans and executes; no separate planner or executor model is configured.

**Mechanism:** Claude Code lifecycle hooks in `.claude/settings.json`:
- `SessionStart` runs `agent_log.py session-start`. Its payload carries `model`, which is remembered for the session.
- `UserPromptSubmit` runs `agent_log.py prompt`. It appends the verbatim prompt as a PROMPT entry.
- `Stop` runs `agent_log.py stop`. It appends the final response as a RESPONSE entry, taken from the Stop payload's `last_assistant_message`, with a transcript fallback.

**Output:** one file per session, `.agent-logs/YYYY-MM-DD_HH-MM-SS_<session-id>.md`, in the 8x format. The front-matter counters are recomputed on each write, and entries are append-only.

**Bookkeeping:** `.claude/agent-log-state/` is gitignored. It holds the dedupe state, the raw last payload per event (for verifying field names), and `errors.log`.

## What did not work first, or needed fixing
1. **The setup session could not capture itself.** The hooks were written from an already-running Claude Code session whose project root was the home directory, not this repository.
   - Project-level hooks in `.claude/settings.json` only apply to sessions whose project is this repo.
   - So the setup prompts (including the pasted capture brief) are **not** in `.agent-logs/`.
   - Fix: all canaries and all build work happen in fresh `claude` sessions started inside the repo.
2. **Test-harness bug.** Payloads built with zsh `echo` turned `\n` inside JSON strings into real newlines, giving invalid JSON. The hook logged the error and exited 0 (it never blocks), which confirmed the error path works. Payloads are now built with Python's `json.dumps`.
3. **Dedupe bug.** The first version keyed duplicate-Stop detection on Python's built-in `hash()`, which is randomized per process, so it would never match across hook invocations. Replaced with SHA-256.
4. **Documentation ambiguity.** The docs lookup reported the UserPromptSubmit field as `prompt` in one place and `prompt_text` in an example. The script accepts both, and keeps the raw payload so the real field name can be checked after the first canary.
5. **Transcript parsing.** The first version extracted the final response by parsing the transcript JSONL, which may lag behind the Stop event. The docs show the Stop payload includes `last_assistant_message`, so that is now the primary source. The transcript is only a fallback, and also supplies the model name for the response.
6. **Unrelated local blocker.** A PreToolUse hook from a separately installed plugin (onex) blocks every `gh`/`git push` command in a session rooted outside a git repo, claiming "GitHub auth expired" although `gh auth status` is fine. The repository was therefore created by the owner running the command directly.
