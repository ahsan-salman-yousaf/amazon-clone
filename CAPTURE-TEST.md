# Capture test

Agent capture is working. Both canaries, each sent from its own fresh `claude` process started inside this repo, were logged with their prompt and response in `.agent-logs/`.

## Tool and model
- **Tool:** Claude Code CLI 2.1.291
- **Model:** Claude Opus 5.5 (`claude-opus-5-5`, 1M context). It both plans and executes; there's no separate planner or executor model.

## Mechanism and config
These Claude Code lifecycle hooks are set in **`.claude/settings.json`**. Each one runs **`.claude/hooks/agent_log.py`**:

| Event | Command | What it records |
|---|---|---|
| `SessionStart` | `agent_log.py session-start` | Creates the session's log file and remembers the payload's `model` |
| `UserPromptSubmit` | `agent_log.py prompt` | Adds the prompt word for word, from the payload's `prompt` field, as a PROMPT entry |
| `Stop` | `agent_log.py stop` | Adds the final reply, from the payload's `last_assistant_message` field (or the transcript if that's missing), as a RESPONSE entry |

- The hook never blocks a session. On any error it writes to `.claude/agent-log-state/errors.log` and exits with status 0.
- Entries are only ever appended. The front-matter counters are recalculated on every write.
- Duplicate Stop events are filtered out by a SHA-256 key.

## Log paths
Each session gets its own file, named `.agent-logs/YYYY-MM-DD_HH-MM-SS_<session-id>.md`:
- Canary session 1: `.agent-logs/2026-10-07_14-12-20_df62b349-b27c-4dfb-9b05-b631974f3525.md`
- Canary session 2: `.agent-logs/2026-10-07_14-14-51_a34915ab-fc57-4501-8065-743df965b245.md`

## Checks run
- [x] Session 1 has both the canary prompt (PROMPT #2) and its response (RESPONSE #2).
- [x] Session 2 has both the canary prompt (PROMPT #1) and its response (RESPONSE #1). They're in a separate file, which shows the hook isn't tied to one session.
- [x] The prompt text is word for word, including multi-line pasted content (session 1, PROMPT #1).
- [x] `errors.log` doesn't exist, which means no hook errors have happened.
- [x] The raw payloads confirm the real field names: UserPromptSubmit sends `prompt` (not `prompt_text`), Stop sends `last_assistant_message`, and SessionStart sends `model`.

## Canary 1 (session `df62b349`), raw

~~~~text
[LOG_ENTRY type=PROMPT num=2 session=df62b349]
timestamp: 2026-10-07T14:13:28.386Z
model: claude-opus-5-5

CAPTURE TEST — 8x assignment, Ahsan Salman Yousaf


[LOG_ENTRY type=RESPONSE num=2 session=df62b349]
timestamp: 2026-10-07T14:13:52.063Z
model: claude-opus-5-5

Your canary prompt was logged in this session. Its response is this reply, which gets written when the turn ends.

**Results so far:**
- My previous reply was logged in full as RESPONSE #1.
- Your canary was logged verbatim as PROMPT #2 in `.agent-logs/2026-10-07_14-12-20_df62b349-b27c-4dfb-9b05-b631974f3525.md`.
- `errors.log` is still empty, and the entry counter correctly reads 2.
- I committed the log so far and the `.gitignore` fix as `cd27e2e`, with no AI attribution.

**Model label:** PROMPT #1 is labelled `claude-opus-5-5[1m]`, from the session-start event. Every entry after it is labelled `claude-opus-5-5`, read from the session transcript. Both are the same model; `[1m]` only marks the 1M-context variant. I'm leaving the hook as it is so the log stays continuous, and I'll explain the difference in `CAPTURE-TEST.md`.

**Next step, the second session:**
1. Exit this session.
2. Inside `~/workspace/amazon-clone`, run `claude`.
3. Send: `CAPTURE TEST — 8x assignment, Ahsan Salman Yousaf (session 2)`
4. Then send a second message in that same session, such as "check the canaries and write CAPTURE-TEST.md". That lets me confirm the first canary's response landed, write `CAPTURE-TEST.md` with both canaries pasted raw, and commit it with the logs.
~~~~

## Canary 2 (session `a34915ab`), raw

~~~~text
[LOG_ENTRY type=PROMPT num=1 session=a34915ab]
timestamp: 2026-10-07T14:14:51.632Z
model: claude-opus-5-5[1m]

CAPTURE TEST — 8x assignment, Ahsan Salman Yousaf (session 2)


[LOG_ENTRY type=RESPONSE num=1 session=a34915ab]
timestamp: 2026-10-07T14:15:12.158Z
model: claude-opus-5-5

Session 2's canary prompt was captured.

- **This session (2):** a new log file was created, `.agent-logs/2026-10-07_14-14-51_a34915ab-fc57-4501-8065-743df965b245.md`. Your canary is in it word for word as PROMPT #1. This reply will be added as RESPONSE #1 when the turn ends.
- **Session 1:** `.agent-logs/2026-10-07_14-12-20_df62b349-….md` has both the canary prompt (PROMPT #2) and its response (RESPONSE #2).
- **`errors.log`:** empty, so the hook hasn't reported any failures.

So capture works in two separate `claude` processes, and each one writes its own file.

**Next:** in this same session, send something like "check the canaries and write CAPTURE-TEST.md". I'll confirm this reply was logged, then write `CAPTURE-TEST.md`. It will have both canary entries pasted raw, the "what didn't work" list from `docs/CAPTURE-SETUP-NOTES.md`, and a note on the model label. I'll commit it together with `.agent-logs/` and leave AI attribution out of the commit, as `CLAUDE.md` requires. I won't start on features until that's done.
~~~~

## Model label note
The first PROMPT in each session is labelled `claude-opus-5-5[1m]`, because that label comes from the SessionStart payload. Later entries are labelled `claude-opus-5-5`, because they're read from the session transcript. Both are the same model; `[1m]` only marks the 1M-context variant. I left the hook unchanged so the format of the log stays the same throughout.

## What didn't work first
1. **The setup session couldn't capture itself.** The hooks were written from an already-running session whose project root was the home directory, not this repo. Hooks in a project's `.claude/settings.json` only run for sessions in that project. So the setup prompts aren't in `.agent-logs/`, though the capture brief itself was pasted again into canary session 1 and is logged there as PROMPT #1. All canaries and all build work run in fresh `claude` sessions started inside the repo.
2. **Test-harness bug.** Building test payloads with zsh `echo` turned `\n` inside JSON strings into real newlines, which made the JSON invalid. The hook logged the error and exited 0, which at least showed the error path works. Payloads are now built with Python's `json.dumps`.
3. **Dedupe bug.** Duplicate-Stop detection first used Python's built-in `hash()`. That value is randomized per process, so it never matched across hook runs. It now uses SHA-256.
4. **Field-name ambiguity in the docs.** The docs named the UserPromptSubmit field `prompt` in one place and `prompt_text` in an example. The script accepts both. The raw payload has since shown the field is `prompt`.
5. **Transcript lag.** Reading the final reply out of the transcript JSONL could miss it, because the file may not be up to date when Stop fires. The script now reads the Stop payload's `last_assistant_message` first and only falls back to the transcript.
6. **Unrelated local blocker.** A PreToolUse hook from a separately installed plugin blocked `gh` and `git push` in a session rooted outside a git repo. It wrongly reported that GitHub auth had expired. To get around it, the owner created the GitHub repository by running the command directly.
