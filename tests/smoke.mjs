/**
 * Deterministic smoke test for dsh-decisions-classifiers.
 *
 * No API key and no running harness: the Decisions endpoint is mocked on
 * loopback and DSH_HOME is redirected to a temporary directory, so the test
 * never reads or writes the live plugin config.
 *
 * Covers the host exports, the injectable service, the opt-in gate listener,
 * both client slot registrations, and the auditability guarantee — that every
 * verdict and every decisions_ask result records the rubric actually sent.
 *
 * Run: node tests/smoke.mjs
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Redirect config resolution before index.js is imported and apply() runs.
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-dc-smoke-'))

/* ---------------- mock Decisions endpoint ---------------- */
let captured
const mock = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    captured = JSON.parse(body)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      answers: [{ type: 'predicate', name: 'evaluation', probability: 0.9, confidence: 0.9 }],
    }))
  })
})
await new Promise((resolve) => mock.listen(8792, '127.0.0.1', resolve))

/* ---------------- host and client halves ---------------- */
const host = await import('../index.js')
assert.equal(host.name, 'dsh-decisions-classifiers', 'host name')
assert.equal(typeof host.apply, 'function', 'host apply is a function')

const provided = []
const listeners = []
const tools = new Map()
const hostCtx = {
  logger: { info() {}, warn() {}, error() {} },
  effect(fn) { return fn() },
  on(name) { listeners.push(name); return () => {} },
  inject(names, cb) { return cb(hostCtx) },
  get() { return undefined },
  provide(name) { provided.push(name); return () => {} },
  tools: { register(definition) { tools.set(definition.name, definition); return () => {} } },
  systemPrompt: { section: () => () => {} },
  webServer: { register: () => () => {} },
}
host.apply(hostCtx, { baseUrl: 'http://127.0.0.1:8792', apiKey: 'smoke-test-key', model: 'gpt-6-luna' })

assert.deepEqual(provided, ['decisionsClassifiers'], 'provides the injectable service')
assert.deepEqual(listeners, ['tools/pre-execute'], 'registers the opt-in gate listener')
assert.deepEqual([...tools.keys()].sort(), ['decisions_ask', 'decisions_classify', 'decisions_status'], 'registers the three tools')

let loaded
globalThis.window = { __ModuleLoader__: { load(definition) { loaded = definition } } }
const elements = []
globalThis.document = {
  createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
  head: { appendChild: (element) => elements.push(element) },
  getElementById: () => undefined,
}
const react = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useMemo: (factory) => factory(),
  useCallback: (fn) => fn,
  useSyncExternalStore: () => undefined,
}
await import('../client.js')
assert.equal(loaded.id, 'dsh-decisions-classifiers', 'client module id')
const client = loaded.factory((specifier) => {
  if (specifier === 'react') return react
  throw new Error('unexpected require: ' + specifier)
})
assert.equal(typeof client.apply, 'function', 'client apply is a function')
assert.deepEqual(client.inject, ['slots'], 'client injects slots')
const slotNames = []
const clientCtx = {
  effect(fn) { fn(); return () => {} },
  slots: {
    inject(name, cb) { slotNames.push(name); cb(); return () => {} },
    register: () => () => {},
  },
}
client.apply(clientCtx)
assert.deepEqual(slotNames, ['shell.overlay', 'settings.section'], 'injects both slots')
assert.equal(elements.length, 1, 'installs exactly one style tag')

/* ---------------- auditability of the rubric ---------------- */
const classify = tools.get('decisions_classify')
const verdict = JSON.parse(await classify.execute({ classifier: 'moderation', input: 'text under test' }, {}))
assert.equal(verdict.question.type, 'predicate', 'verdict records the question type')
assert.ok(verdict.question.instructions.includes('acceptable-use policy'), 'verdict records the preset rubric')
assert.equal(captured.questions[0].instructions, verdict.question.instructions, 'recorded rubric equals the rubric sent')

const relevant = JSON.parse(await classify.execute(
  { classifier: 'relevance', input: 'passage', context: 'how do I reset a password?' }, {}))
assert.ok(relevant.question.instructions.includes('how do I reset a password?'), 'context-substituted rubric is recorded')

const ask = tools.get('decisions_ask')
const asked = JSON.parse(await ask.execute({
  input: 'evidence',
  questions: [{ type: 'predicate', name: 'first', instructions: 'One?' },
              { type: 'choice', name: 'second', instructions: 'Two?', choices: [{ value: 'a' }, { value: 'b' }] }],
}, {}))
assert.deepEqual(asked.questions.map((q) => q.name), ['first', 'second'], 'decisions_ask records the questions sent')
assert.equal(asked.request, undefined, 'decisions_ask must not echo the full request (it can carry base64 images)')

/* ---------------- negative path ---------------- */
const missing = await classify.execute({ classifier: 'nope', input: 'x' }, {})
assert.ok(missing.startsWith('decisions_classify failed:'), 'unknown classifier reports a failure, not a throw')

mock.close()
console.log('smoke: ok - host, service, gate, both client slots, and rubric recorded with every verdict')
