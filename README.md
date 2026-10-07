# dsh-decisions-classifiers

OpenAI **Decisions API** classifiers for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

The Decisions API (`POST /v1/decisions`, model `gpt-6-luna`) answers typed questions about text
and images instead of generating prose: a **predicate** returns the probability that a condition
holds, a **choice** returns one of your options with the full probability distribution, and a
**score** returns a probability-weighted average over ordered levels. This plugin puts that
capability in four places.

| Surface | What it gives you |
| --- | --- |
| Agent tools | `decisions_classify` (one built-in classifier), `decisions_ask` (arbitrary typed questions, up to ~10 per request), `decisions_status` |
| Cordis service | `decisionsClassifiers` — `listPresets()`, `classify()`, `ask()`, `status()` for other plugins |
| Opt-in call gate | Classify every `run_code`/`bash`/`write`/`edit` call before it executes and deny the flagged ones |
| Advice card | A "classifier opinion" card beside `ask_user_question` multiple-choice prompts, with one click to adopt |

## Classifier library

| id | type | answers |
| --- | --- | --- |
| `moderation` | predicate | Does this content violate a standard acceptable-use policy? |
| `prompt-injection` | predicate | Does this text try to manipulate an AI system rather than inform a reader? |
| `dangerous-command` | predicate | Does this command irreversibly destroy data or change machine-wide state? |
| `pii` | predicate | Does this text identify a real individual? |
| `relevance` | predicate | Is this passage relevant to the stated query? (pass `context`) |
| `severity` | score | Cosmetic / workaround available / fully blocked |
| `intent` | choice | billing / technical / shipping / other |

Anything else goes through `decisions_ask`, which takes the wire question types directly.

## Setup

1. Install the bundle (see below).
2. Open **Settings → Decisions Classifiers**, paste an OpenAI API key, and press **Store key**.
   The key is written through the DSH credential seam as `OPENAI_API_KEY` (or the env name you
   set) and is never read back by the page. `OPENAI_API_KEY` in the process environment or a
   `.env` file works too.
3. Press **Test connection**.

The call gate is **off by default**: installing this plugin changes no agent behaviour until you
turn it on.

## Install

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-decisions-classifiers
```

or through the Harness plugin manager with the package directory as the target.

## Configuration

Every field is settable from the Settings page (persisted to
`~/.dsh/decisions-classifiers/config.json`) and overridable from the bundle row; live edits win.
Pin a deployment in `cordis.patch.yml`.

| key | default | meaning |
| --- | --- | --- |
| `enabled` | `true` | master switch |
| `baseUrl` | `https://api.openai.com/v1` | endpoint base; `/decisions` is appended |
| `model` | `gpt-6-luna` | the only model the Decisions API serves today |
| `apiKeyEnv` | `OPENAI_API_KEY` | credential-seam reference name |
| `timeoutMs` | `60000` | per-request budget |
| `defaultThreshold` | `0.5` | predicate cut-off when a preset does not fix one |
| `advisorEnabled` | `true` | the advice card |
| `gateEnabled` | `false` | the pre-execution gate |
| `gatePreset` | `dangerous-command` | classifier the gate runs |
| `gateThreshold` | `0.5` | gate cut-off |
| `gateDecision` | `deny` | `deny` or `escalate` |
| `systemPromptSection` | `true` | tell the agent the classifiers exist |

## What the numbers mean

The endpoint returns a probability distribution over a support, then projects it: `choice` takes
the argmax, `score` takes the expectation of the zero-based level index, and `predicate` has
nothing to project. Those projections are where the interpretation lives, and they are not
equally portable.

| type | support comes from | scalar you get | portable? |
| --- | --- | --- | --- |
| `predicate` | the world (true/false) | `probability` | **yes** — the one number that travels |
| `choice` | **your options list** | `choice` (argmax) | no — menu-dependent |
| `score` | **your ordered levels** | `score` = E[index] | no — level-dependent, and metric-imposing |

**`predicate` is the only portable scalar.** It is a Bernoulli parameter, so it is calibratable
against realized outcomes (reliability diagrams, Brier score) and thresholdable against a cost
rule. One caveat matters more than it looks: the endpoint accepts *any* input, so many predicates
are subjective ("is this code maintainable?"). There, `probability` is not a property of the
world — it is a marginal over a rule set nobody wrote. Calibration still works, but its referent
becomes *your* raters instead of reality: it licenses "consistent with our standard", never
"true".

**`choice` distributions are menu-dependent.** The support is your options list, so relabeling
the menu moves the numbers while the world stays put. Measured on one fixed top category, with
only the tail split ever more finely:

| menu | max p | sum p² | top-2 gap |
| --- | --- | --- | --- |
| 2-way [0.80, 0.20] | 0.8000 | 0.6800 | 0.6000 |
| 4-way [0.80, 0.09, 0.06, 0.05] | 0.8000 | 0.6542 | 0.7100 |

Two candidate concentration measures move in **opposite directions** under that relabeling. So a
4-option and a 2-option question in the same batch are not comparable on any confidence number,
and the interpretable signal is the **top-2 margin** — how close the routing is to a coin flip.

**`score` is an ordinal position presented as an interval.** Levels carry only `label` and
`description`; the API assigns indices 0..n-1 by position, with no client-supplied weight or
value. E[index] is meaningful only if your levels are equally spaced in the quantity you care
about — usually false for severity, where cosmetic→workaround is a far smaller real jump than
workaround→blocked. Prefer thresholding on `P(level >= k)` over the returned `probabilities`:
that needs no metric assumption.

**`confidence` is a concentration index, not a probability.** The guide calls it a separate field
and never defines it, and it cannot be recovered from the published examples: sum p² and the
top-2 gap both fit them to within ~0.01 while disagreeing in *sign* under relabeling. It is also
not comparable across questions with different option counts. Read `probabilities` directly and
compute your own statistic with weights you know.

### Where the rubric actually lives

No answer type removes the standard you were supposed to specify; they relocate it.

| type | where the standard lives | failure mode | detectable? |
| --- | --- | --- | --- |
| `predicate` (observable) | the world | estimation error | yes — reliability |
| `predicate` (subjective) | model prior + prompt | **definition ambiguity** | mostly invisible |
| `choice` | **your options list** | menu sensitivity | yes — measurable |
| `score` | your levels list | imposed equidistance | visible, magnitude unmeasurable |

A `choice` externalizes the standard — readable, diffable, and its sensitivity is measurable. A
subjective `predicate` internalizes it, which makes it *less* auditable, not more objective. And
a subjective `probability` is a mixture over provenance channels with unknown weights: the
model's prior over "maintainable" is built from scraped text, paid annotation, users' own chat
inputs and corrections, and automatic outcome signals such as test pass/fail — each with
different epistemic standing. That is the practical reason "does the test pass" is trustworthy
and "is this maintainable" is not: only the first has a rubric in the loop.

### Auditability

Every `decisions_classify` verdict carries the exact `question` that was sent — type, name,
instructions, and the choices or levels — and `decisions_ask` returns the questions as
normalized and sent. For a subjective predicate that instruction text is the only part of the
decision with a knowable provenance, so a verdict without it cannot be reviewed after the fact.
The full wire request is deliberately not echoed: it can carry inlined base64 images.

## Known limitations

- **Images must be inline base64.** The endpoint rejects hosted HTTP(S) URLs and `file_id`
  inputs, so `decisions_ask` reads local paths and inlines them. DSH attachments cannot be passed
  through by reference.
- **One model.** `gpt-6-luna` is the only available model while the API is in public beta.
- **The advice card sends the questions only**, not the surrounding conversation transcript;
  decisions that depend on earlier chat turns may be less well informed.
- **The gate fails open** on a network or credential error, and logs the failure: a classification
  outage must not block every tool call.
- **`confidence` is surfaced but should not be thresholded.** It is undocumented and
  menu-dependent; see [What the numbers mean](#what-the-numbers-mean).
- **`score` assumes equally spaced levels**, which the API imposes and you cannot override.
- Pricing is input-token only ($0.10 per 1M tokens for `gpt-6-luna`), but this plugin does not
  meter spend.

## License

MIT.
