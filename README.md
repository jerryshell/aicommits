# @jerryshell/aicommits

AI-powered git commit message generator. Fork of [nutlope/aicommits](https://github.com/nutlope/aicommits).

## What's different from upstream

- **Structured output** — Uses Zod schemas + `Output.object()` to enforce JSON responses, eliminating parsing fragility from free-text LLM output.
- **No reasoning tokens** — All LLM calls set `reasoning: "none"` to skip thinking/reasoning tokens, saving costs on models that support it.
- **Large-diff summarization** — Diffs over 30 KB are condensed locally into a per-file skeleton (stat + key declarations) instead of sending truncated raw diff text, cutting tokens ~10× on big commits. Small diffs are sent verbatim.
- **Bun for dev, Node for prod** — Dev tooling uses Bun (faster builds, oxfmt, oxlint). Production binary targets Node.

## Quick start

```bash
git clone https://github.com/jerryshell/aicommits.git
cd aicommits
bun install
bun run build
bun link
aicommits setup   # configure your API key and provider
aicommits         # generate a commit message from staged changes
# tip: `aic` works too — same thing, shorter
```

## Commands

| Command            | Description                                 |
| ------------------ | ------------------------------------------- |
| `aicommits`        | Generate commit message from staged changes |
| `aicommits setup`  | Configure provider and API key              |
| `aicommits model`  | Select or change AI model                   |
| `aicommits pr`     | Generate PR from branch diff                |
| `aicommits config` | View/edit config                            |
| `aicommits hook`   | Install git hooks                           |

## Flags

| Flag                    | Description                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| `-g, --generate <n>`    | Number of messages to generate                                                  |
| `-t, --type <format>`   | Format: `plain`, `conventional`, `conventional+body`, `gitmoji`, `subject+body` |
| `-a, --all`             | Auto-stage all tracked changes                                                  |
| `-y, --yes`             | Skip confirmation                                                               |
| `-c, --clipboard`       | Copy message to clipboard instead of committing                                 |
| `-n, --no-verify`       | Bypass pre-commit hooks                                                         |
| `-p, --prompt <text>`   | Custom prompt for the LLM                                                       |
| `-x, --exclude <files>` | Files to exclude from AI analysis                                               |

## Providers

Supports any OpenAI-compatible API: OpenAI, Together, Groq, xAI, Ollama, LM Studio, OpenRouter, or a custom endpoint.
