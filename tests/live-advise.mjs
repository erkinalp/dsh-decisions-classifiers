/**
 * Live end-to-end test of the classifier-advice path.
 *
 * Points the running host half at a local mock Decisions endpoint, sends a
 * single-select and a multi-select question, and checks the advice the browser
 * half would render and adopt. Restores the previous baseUrl and API key in a
 * finally block.
 *
 * Requires a running dsh web profile with this plugin installed.
 * Run: node tests/live-advise.mjs
 */
import { createServer } from 'node:http'

const API = 'http://127.0.0.1:3080/dsh-decisions-classifiers/api'
const PORT = 8791
let capturedRequest

const mock = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    capturedRequest = JSON.parse(body)
    const answers = [
      { type: 'choice', name: 'q1', choice: 'staging', confidence: 0.81, probabilities: [
        { value: 'staging', probability: 0.81 }, { value: 'production', probability: 0.19 }] },
      { type: 'predicate', name: 'q2::0', probability: 0.9 },
      { type: 'predicate', name: 'q2::1', probability: 0.3 },
    ]
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ answers }))
  })
})
await new Promise((resolve) => mock.listen(PORT, '127.0.0.1', resolve))

const call = async (method, payload) => {
  const response = await fetch(API + '/' + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await response.json()
  if (body.ok !== true) throw new Error(body.error.message)
  return body.value
}

const status = await call('status', {})
const before = { baseUrl: status.config.baseUrl, model: status.config.model }

try {
  await call('config', { baseUrl: 'http://127.0.0.1:' + PORT, apiKey: 'test-key-not-real', model: 'gpt-6-luna' })
  const result = await call('advise', { questions: [
    { id: 'q1', question: 'Which environment should this deploy to?', header: 'Target',
      options: [{ label: 'staging', description: 'Pre-production' }, { label: 'production' }], multiSelect: false },
    { id: 'q2', question: 'Which checks should run?',
      options: [{ label: 'lint' }, { label: 'tests' }], multiSelect: true },
  ] })

  const [single, multi] = result.advice
  const checks = []
  checks.push(['single-select picks the model choice', single.answered === true && single.pick.label === 'staging'])
  checks.push(['choice carries the distribution', single.distribution.length === 2 && single.distribution[0].probability === 0.81])
  checks.push(['multi-select keeps only options above the cut', multi.answered === true && multi.selected.map((row) => row.label).join(',') === 'lint'])
  checks.push(['multi-select reports the rejected option', multi.distribution.find((row) => row.label === 'tests').probability === 0.3])
  checks.push(['wire names fan out per option', capturedRequest.questions.map((q) => q.name).join(',') === 'q1,q2::0,q2::1'])
  checks.push(['choice question carries the options', capturedRequest.questions[0].choices.length === 2])
  checks.push(['images stay out when none are supplied', typeof capturedRequest.input === 'string'])

  let failed = 0
  for (const [label, ok] of checks) {
    console.log((ok ? 'PASS  ' : 'FAIL  ') + label)
    if (!ok) failed += 1
  }
  console.log('\nupstream request sent to /decisions:')
  console.log(JSON.stringify(capturedRequest, null, 2).slice(0, 1200))
  if (failed > 0) throw new Error(failed + ' check(s) failed')
  console.log('\nlive-advise: ok')
} finally {
  await call('config', { baseUrl: before.baseUrl, apiKey: '', model: before.model })
  mock.close()
}
