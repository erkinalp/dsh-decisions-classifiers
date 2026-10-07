# dsh-decisions-classifiers

OpenAI **Decisions API** classifiers for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

The Decisions API (\`POST /v1/decisions\`, model \`gpt-6-luna\`) answers typed questions
about text and images instead of generating prose: a **predicate** returns the probability
that a condition holds, a **choice** returns one of your options with the full probability
distribution, and a **score** returns a probability-weighted average over ordered levels.
This plugin puts that capability in four places.

| Surface | What it gives you |
| --- | --- |
| Agent tools | \`decisions_classify\` (one built-in classifier), \`decisions_ask\` (arbitrary typed questions, up to ~10 per request), \`decisions_status\` |
| Cordis service | \`decisionsClassifiers\` — \`listPresets()\`, \`classify()\`, \`ask()\`, \`status()\` for other plugins |
| Opt-in call gate | Classify every \`run_code\`/\`bash\`/\`write\`/\`edit\` call before it executes and deny the flagged ones |
| Advice card | A **“classifier opinion”** card beside \`ask_user_question\` multiple-choice prompts, with one click to adopt |

## Classifier library

| id | type | answers |
| --- | --- | --- |
| \`moderation\` | predicate | Does this content violate a standard acceptable-use policy? |
| \`prompt-injection\` | predicate | Does this text try to manipulate an AI system rather than inform a reader? |
| \`dangerous-command\` | predicate | Does this command irreversibly destroy data or change machine-wide state? |
| \`pii\` | predicate | Does this text identify a real individual? |
| \`relevance\` | predicate | Is this passage relevant to the stated query? (pass \`context\`) |
| \`severity\` | score | Cosmetic / workaround available / fully blocked |
| \`intent\` | choice | billing / technical / shipping / other |

Anything else goes through \`decisions_ask\`, which takes the wire question types directly.

## Setup

1. Install the bundle (see below).
2. Open **Settings → Decisions Classifiers**, paste an OpenAI API key, and press **Store key**.
   The key is written through the DSH credential seam as \`OPENAI_API_KEY\` (or the env name you
   set) and is never read back by the page. \`OPENAI_API_KEY\` in the process environment or a
   \`.env\` file works too.
3. Press **Test connection**.

The call gate is **off by default**: installing this plugin changes no agent behaviour until
you turn it on.

## Install

\`\`\`bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-decisions-classifiers
\`\`\`

or through the Harness plugin manager with the package directory as the target.

## Configuration

Every field is settable from the Settings page (persisted to
\`~/.dsh/decisions-classifiers/config.json\`) and overridable from the bundle row, which wins
nothing — live edits win. Pin a deployment in \`cordis.patch.yml\`.

| key | default | meaning |
| --- | --- | --- |
| \`enabled\` | \`true\` | master switch |
| \`baseUrl\` | \`https://api.openai.com/v1\` | endpoint base; \`/decisions\` is appended |
| \`model\` | \`gpt-6-luna\` | the only model the Decisions API serves today |
| \`apiKeyEnv\` | \`OPENAI_API_KEY\` | credential-seam reference name |
| \`timeoutMs\` | \`60000\` | per-request budget |
| \`defaultThreshold\` | \`0.5\` | predicate cut-off when a preset does not fix one |
| \`advisorEnabled\` | \`true\` | the advice card |
| \`gateEnabled\` | \`false\` | the pre-execution gate |
| \`gatePreset\` | \`dangerous-command\` | classifier the gate runs |
| \`gateThreshold\` | \`0.5\` | gate cut-off |
| \`gateDecision\` | \`deny\` | \`deny\` or \`escalate\` |
| \`systemPromptSection\` | \`true\` | tell the agent the classifiers exist |

## Known limitations

- **Images must be inline base64.** The endpoint rejects hosted HTTP(S) URLs and \`file_id\`
  inputs, so \`decisions_ask\` reads local paths and inlines them. DSH attachments cannot be
  passed through by reference.
- **One model.** \`gpt-6-luna\` is the only available model while the API is in public beta.
- **The advice card sends the questions only**, not the surrounding conversation transcript;
  decisions that depend on earlier chat turns may be less well informed.
- **The gate fails open** on a network or credential error, and logs the failure: a
  classification outage must not block every tool call.
- Pricing is input-token only (\$0.10 per 1M tokens for \`gpt-6-luna\`), but this plugin does
  not meter spend.

## Licence

MIT.
