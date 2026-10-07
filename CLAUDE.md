# Project rules: Amazon.com rebuild (8x assignment)

The goal is to rebuild amazon.com as a working, deployed product within a 24-hour window. The clock is tracked, not enforced. Judging criteria:
- **Speed:** how much working product is built.
- **Product judgement:** what was built first and what was left out.
- **UX/UI:** how good the product is to use.

The full brief and the plan are in `docs/PLAN.md`.

## Agent capture (mandatory, already installed)
- Every prompt and final response is logged automatically to `.agent-logs/`. The logging comes from hooks in `.claude/settings.json` that run `.claude/hooks/agent_log.py` on three events: SessionStart, UserPromptSubmit and Stop.
- **Never** edit, tidy, summarise or delete anything in `.agent-logs/`, and never add it to `.gitignore`.
- **Commit `.agent-logs/` together with the code it produced, as you go.** Don't save it for one big commit at the end.
- `.claude/agent-log-state/` is gitignored bookkeeping (dedupe state, raw hook payloads, `errors.log`). If capture looks broken, check `errors.log` first.
- Do not start building features until `CAPTURE-TEST.md` exists and both canary sessions have landed in `.agent-logs/`.

## Git and authorship
- Commits are authored by the repository owner only.
- **Never** add `Co-Authored-By` trailers, "Generated with Claude Code" lines, or any AI attribution to commits, PRs, the README or code.
- Make small, frequent commits whose messages describe the change.
- The repository is public. Never commit secrets: use `.env` locally, with `.env.example` documenting every variable.

## Product guardrails
- This is a functional rebuild of Amazon's shopping flows, **not a brand copy**. The site goes live on a public URL with sign-in and payment forms, so:
  - It uses its own name and logo.
  - It carries a visible "Demo project, not affiliated with Amazon" notice.
  - It never asks for real Amazon credentials.
  - Payments run in Stripe **test mode** or a clearly labelled simulated provider.
- Product data is synthetic or from an open demo catalog. Don't scrape amazon.com.

## Design
- Use the installed design skills and references:
  - `web-design-guidelines` for UI audits before shipping.
  - `design-taste-frontend` for the storefront and landing surfaces.
  - The DESIGN.md references in `~/awesome-design-md/design-md/` (for example `shopify`, `airbnb`, `apple`).
- Accessible by default: keyboard navigable, visible focus, real labels, contrast, and works at 360px wide.

## Stack (see docs/PLAN.md for the reasoning)
Next.js (App Router, TypeScript), Tailwind and shadcn/ui, Postgres (Neon) with Drizzle, Auth.js, Stripe test mode, deployed on Vercel.

This Next.js version may differ from training data. Read `node_modules/next/dist/docs/` before using an API you're unsure of.
