/**
 * Deterministic smoke test for dsh-decisions-classifiers.
 *
 * Host: the module exports the cordis identity and an apply function.
 * Client: the hand-written bundle loads through __ModuleLoader__, returns the
 * cordis face, and apply() registers exactly the two intended slots.
 *
 * Run: node tests/smoke.mjs
 */
import assert from 'node:assert/strict'

/* ---------------- host ---------------- */
const host = await import('../index.js')
assert.equal(host.name, 'dsh-decisions-classifiers', 'host name')
assert.equal(typeof host.apply, 'function', 'host apply is a function')

// A minimal ctx: every optional service is absent, so apply must not throw.
const provided = []
const listeners = []
const hostCtx = {
  logger: { info() {}, warn() {}, error() {} },
  effect(fn) { return fn() },
  on(name, handler) { listeners.push(name); return () => {} },
  inject(names, cb) { return cb(hostCtx) },
  get(name) { return undefined },
  provide(name, value) { provided.push(name); return () => {} },
  tools: { register: () => () => {} },
  systemPrompt: { section: () => () => {} },
  webServer: { register: () => () => {} },
}
host.apply(hostCtx, {})
assert.deepEqual(provided, ['decisionsClassifiers'], 'provides the injectable service')
assert.deepEqual(listeners, ['tools/pre-execute'], 'registers the opt-in gate listener')

/* ---------------- client ---------------- */
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
const registrations = []
const clientCtx = {
  effect(fn, label) { assert.equal(typeof label, 'string', 'effect label'); fn(); return () => {} },
  slots: {
    inject(name, cb) { slotNames.push(name); cb(); return () => {} },
    register(options, Component) { registrations.push(options); return () => {} },
  },
}
client.apply(clientCtx)
assert.deepEqual(slotNames, ['shell.overlay', 'settings.section'], 'injects both slots')
assert.deepEqual(registrations.map((options) => options.name), ['shell.overlay', 'settings.section'], 'registers both components')
assert.equal(elements.length, 1, 'installs exactly one style tag')

console.log('smoke: ok — host exports, injectable service, gate listener, both client slots')
