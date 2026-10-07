/**
 * dsh-decisions-classifiers — browser half.
 *
 * Two surfaces, both additive:
 *   1. Settings -> Decisions Classifiers: credential, model, the classifier
 *      library, the opt-in call gate, and a live connection test.
 *   2. shell.overlay: when the model hands the user an ask_user_question
 *      multiple-choice batch, a card floats the classifier's recommendation,
 *      the full probability spread, its confidence, the exact JSON that crossed
 *      the wire, and one button to adopt it. The shipped question card is never
 *      replaced, and nothing is submitted without that button.
 *
 * Static bundle clients have no host.call, so every read and write goes through
 * the same-origin routes the host half registered on the webServer service.
 */
window.__ModuleLoader__.load({
	id: 'dsh-decisions-classifiers',
	factory: (require) => {
		'use strict'
		var module = { exports: {} }
		var exports = module.exports

		var React = require('react')
		var h = React.createElement

		var API = '/dsh-decisions-classifiers/api'
		var STYLE_ID = 'dsh-decisions-classifiers-css'
		var D = 'dc-'

		var CSS = [
			'.' + D + 'card { position: fixed; right: 20px; bottom: 20px; width: 380px; max-height: 70vh; overflow: auto; z-index: 40;',
			'  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); border-radius: 10px;',
			'  box-shadow: 0 10px 30px rgba(0,0,0,0.28); padding: 12px 14px; font-size: 13px; line-height: 1.5; color: var(--dsw-alias-label-primary); }',
			'.' + D + 'head { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }',
			'.' + D + 'title { font-weight: 600; flex: 1 1 auto; }',
			'.' + D + 'sub { color: var(--dsw-alias-label-tertiary); font-size: 11px; }',
			'.' + D + 'q { margin: 8px 0 4px; font-weight: 600; }',
			'.' + D + 'pick { display: flex; align-items: baseline; gap: 6px; }',
			'.' + D + 'badge { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 9px; background: rgba(120,140,93,0.25); color: #a8c080; }',
			'.' + D + 'bar { position: relative; height: 6px; border-radius: 3px; background: rgba(128,128,128,0.18); margin: 3px 0 6px; overflow: hidden; }',
			'.' + D + 'bar > i { position: absolute; left: 0; top: 0; bottom: 0; background: #788c5d; }',
			'.' + D + 'row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 0; }',
			'.' + D + 'row + .' + D + 'row { border-top: 1px solid var(--dsw-alias-border-l1); }',
			'.' + D + 'name { color: var(--dsw-alias-label-primary); }',
			'.' + D + 'desc { color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 1.4; }',
			'.' + D + 'mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }',
			'.' + D + 'actions { display: flex; gap: 8px; margin-top: 10px; }',
			'.' + D + 'panel button, .' + D + 'card button { font: inherit; cursor: pointer; border: 1px solid var(--dsw-alias-border-l2);',
			'  background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); border-radius: 6px; padding: 4px 12px; }',
			'.' + D + 'panel button:hover:not(:disabled), .' + D + 'card button:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-solid); }',
			'.' + D + 'panel button:disabled, .' + D + 'card button:disabled { opacity: 0.5; cursor: default; }',
			'.' + D + 'primary { background: #788c5d !important; border-color: #788c5d !important; }',
			'.' + D + 'panel { padding: 16px; font-size: 14px; line-height: 1.6; color: var(--dsw-alias-label-primary); }',
			'.' + D + 'panel h3 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }',
			'.' + D + 'box { border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); border-radius: 6px; padding: 12px 14px; margin-bottom: 12px; }',
			'.' + D + 'input { font: inherit; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-3);',
			'  border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; padding: 5px 8px; width: 100%; box-sizing: border-box; }',
			'.' + D + 'switch { position: relative; flex: none; width: 44px; height: 26px; border-radius: 13px; border: none; padding: 0; cursor: pointer;',
			'  background: var(--dsw-alias-bg-layer-3); box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l2); transition: background .15s ease; }',
			'.' + D + 'switch-on { background: #788c5d !important; box-shadow: none !important; }',
			'.' + D + 'knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff;',
			'  box-shadow: 0 1px 2px rgba(0,0,0,0.25); transition: transform .15s ease; }',
			'.' + D + 'switch-on .' + D + 'knob { transform: translateX(18px); }',
			'.' + D + 'err { color: #e5484d; margin-bottom: 10px; }',
			'.' + D + 'ok { color: #a8c080; margin-bottom: 10px; }',
			'.' + D + 'pre { white-space: pre-wrap; word-break: break-all; background: rgba(128,128,128,0.08); border-radius: 6px; padding: 8px 10px; margin: 6px 0 0; }',
		].join('\n')

		/* ---------------------------------------------------------------- *
		 * Shared helpers
		 * ---------------------------------------------------------------- */

		/** POST one JSON payload to the host bridge and unwrap its envelope. */
		async function callApi(method, payload, signal) {
			var response
			try {
				response = await fetch(API + '/' + method, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload || {}),
					signal: signal
				})
			} catch (error) {
				if (error && error.name === 'AbortError') throw error
				throw new Error('cannot reach the decisions-classifiers host bridge: ' + String((error && error.message) || error))
			}
			var body
			try {
				body = await response.json()
			} catch {
				body = undefined
			}
			if (body === undefined || typeof body !== 'object') throw new Error('the host bridge answered ' + String(response.status) + ' without JSON')
			if (body.ok !== true) throw new Error((body.error && body.error.message) || ('the host bridge answered ' + String(response.status)))
			return body.value
		}

		/** An empty selector, used when the runtime does not provide the standing seat. */
		function absent() { return undefined }

		/** Narrow one pending interaction into the option-bearing question batch. */
		function pendingQuestionsOf(interaction) {
			if (interaction === undefined || interaction === null) return undefined
			var raw = interaction.questions
			if (!Array.isArray(raw) || raw.length === 0) return undefined
			var questions = []
			for (var i = 0; i < raw.length; i += 1) {
				var question = raw[i]
				if (typeof question !== 'object' || question === null) continue
				if (typeof question.id !== 'string' || typeof question.question !== 'string') continue
				var options = []
				var rawOptions = Array.isArray(question.options) ? question.options : []
				for (var j = 0; j < rawOptions.length; j += 1) {
					var option = rawOptions[j]
					if (typeof option !== 'object' || option === null) continue
					if (typeof option.label !== 'string' || option.label.trim() === '') continue
					options.push({ label: option.label, description: typeof option.description === 'string' ? option.description : undefined })
				}
				if (options.length === 0) continue
				questions.push({
					id: question.id,
					question: question.question,
					header: typeof question.header === 'string' ? question.header : undefined,
					detail: typeof question.detail === 'string' ? question.detail : undefined,
					multiSelect: question.multiSelect === true,
					options: options
				})
			}
			if (questions.length === 0) return undefined
			return { questions: questions, complete: questions.length === raw.length }
		}

		/** Turn advice into the answer batch the pending question waits for. */
		function buildAnswers(questions, advice) {
			var list = advice && advice.advice
			if (!Array.isArray(list)) return undefined
			var byId = {}
			for (var i = 0; i < list.length; i += 1) byId[list[i].questionId] = list[i]
			var answers = []
			for (var q = 0; q < questions.length; q += 1) {
				var entry = byId[questions[q].id]
				if (entry === undefined || entry.supported !== true || entry.answered !== true) return undefined
				if (entry.kind === 'choice') {
					if (!entry.pick) return undefined
					answers.push({ id: questions[q].id, selected: [entry.pick.label] })
					continue
				}
				var labels = (entry.selected || []).map(function (row) { return row.label })
				if (labels.length === 0) return undefined
				answers.push({ id: questions[q].id, selected: labels })
			}
			return answers
		}

		/** Percent text for one probability. */
		function pct(value) {
			return String(Math.round((typeof value === 'number' ? value : 0) * 100)) + '%'
		}

		/* ---------------------------------------------------------------- *
		 * The classifier-decide card (shell.overlay)
		 * ---------------------------------------------------------------- */

		function AdviceCard(props) {
			var useSessionStatus = props.useSessionStatus || absent
			var [value, setValue] = React.useState(undefined)
			var [state, setState] = React.useState({ status: 'idle' })
			var [busy, setBusy] = React.useState(false)
			var [adoptError, setAdoptError] = React.useState(undefined)
			var [dismissed, setDismissed] = React.useState(undefined)
			var [attempt, setAttempt] = React.useState(0)

			var interaction = useSessionStatus(function (snapshot) {
				if (snapshot === undefined || typeof snapshot.get !== 'function') return undefined
				var iterator = snapshot.values()
				var step = iterator.next()
				while (step.done !== true) {
					var status = step.value
					if (status && status.pendingInteraction) return status.pendingInteraction
					step = iterator.next()
				}
				return undefined
			})

			var normalized = React.useMemo(function () { return pendingQuestionsOf(interaction) }, [interaction])
			var questions = normalized === undefined ? undefined : normalized.questions
			var complete = normalized !== undefined && normalized.complete
			var signature = questions === undefined ? '' : JSON.stringify(questions)
			var interactionKey = (interaction === undefined || interaction === null) ? undefined : interaction.key

			React.useEffect(function () {
				if (questions === undefined || signature === '') return undefined
				var controller = new AbortController()
				setState({ status: 'loading' })
				callApi('advise', { questions: questions }, controller.signal).then(
					function (result) { if (!controller.signal.aborted) { setValue(result); setState({ status: 'ready' }) } },
					function (error) {
						if (controller.signal.aborted || (error && error.name === 'AbortError')) return
						setState({ status: 'error', message: String((error && error.message) || error) })
					}
				)
				return function () { controller.abort() }
			}, [signature, attempt])

			if (interaction === undefined || interaction === null || questions === undefined) return null
			if (dismissed !== undefined && dismissed === interactionKey) return null

			var advice = value && Array.isArray(value.advice) ? value.advice : []
			var answers = complete && value !== undefined ? buildAnswers(questions, value) : undefined

			function adopt() {
				if (answers === undefined) return
				setBusy(true)
				setAdoptError(undefined)
				Promise.resolve()
					.then(function () { return interaction.answer({ answers: answers }) })
					.then(function () { setBusy(false) }, function (error) { setBusy(false); setAdoptError(String((error && error.message) || error)) })
			}

			var children = []
			children.push(h('div', { className: D + 'head', key: 'head' },
				h('div', { style: { flex: '1 1 auto' } },
					h('div', { className: D + 'title' }, 'Classifier opinion'),
					h('div', { className: D + 'sub' }, value && value.model ? value.model : 'OpenAI Decisions')),
				h('button', { type: 'button', title: 'Dismiss', onClick: function () { setDismissed(interactionKey) } }, '\u2715')))

			if (state.status === 'loading') children.push(h('div', { className: D + 'sub', key: 'loading' }, 'Asking the classifier…'))
			if (state.status === 'error') {
				children.push(h('div', { className: D + 'err', key: 'error' }, state.message))
				children.push(h('div', { className: D + 'actions', key: 'retry' },
					h('button', { type: 'button', onClick: function () { setAttempt(attempt + 1) } }, 'Retry')))
			}

			if (state.status === 'ready' && advice.length > 0) {
				advice.forEach(function (entry, index) {
					var question = questions[index]
					var head = question.header || question.question
					var block = []
					block.push(h('div', { className: D + 'q', key: 'q' }, questions.length > 1 ? String(index + 1) + '. ' + head : head))
					if (entry.answered !== true) {
						block.push(h('div', { className: D + 'desc', key: 'n' }, entry.refused ? 'The classifier refused this question; answer it yourself.' : 'No decisive answer for this question; answer it yourself.'))
					} else if (entry.kind === 'choice' && entry.pick) {
						block.push(h('div', { className: D + 'pick', key: 'p' },
							h('span', { className: D + 'badge' }, pct(entry.pick.probability)),
							h('span', null, entry.pick.label)))
					} else if (entry.kind === 'multi' && entry.selected) {
						block.push(h('div', { className: D + 'pick', key: 'p' },
							h('span', { className: D + 'badge' }, pct(entry.confidence)),
							h('span', null, entry.selected.map(function (row) { return row.label }).join(', '))))
					}
					var rows = entry.distribution || []
					if (rows.length > 0) {
						var bars = rows.map(function (row, rowIndex) {
							return h('div', { key: 'r' + String(rowIndex) },
								h('div', { className: D + 'row' },
									h('span', { className: D + 'name' }, String(row.label)),
									h('span', { className: D + 'mono' }, pct(row.probability))),
								h('div', { className: D + 'bar' }, h('i', { style: { width: pct(row.probability) } })))
						})
						block.push(h('div', { key: 'dist' }, bars))
					}
					if (typeof entry.confidence === 'number') {
						block.push(h('div', { className: D + 'desc', key: 'c' }, 'confidence ' + pct(entry.confidence)))
					}
					children.push(h('div', { key: 'entry' + String(index) }, block))
				})
				children.push(h('div', { className: D + 'actions', key: 'actions' },
					h('button', {
						type: 'button',
						className: answers === undefined ? '' : D + 'primary',
						disabled: answers === undefined || busy,
						onClick: adopt
					}, busy ? 'Submitting…' : 'Adopt the classifier’s answer')))
				if (adoptError !== undefined) children.push(h('div', { className: D + 'err', key: 'adoptErr' }, 'Adopt failed: ' + adoptError))
				children.push(h('details', { key: 'json' },
					h('summary', { className: D + 'desc', style: { cursor: 'pointer' } }, 'Request and response JSON'),
					h('pre', { className: D + 'mono' }, JSON.stringify({ request: value.request, response: value.response }, null, 2))))
			}

			return h('div', { className: D + 'card', 'data-dsh-decisions-classifiers': 'advice' }, children)
		}

		/* ---------------------------------------------------------------- *
		 * Settings page (settings.section)
		 * ---------------------------------------------------------------- */

		function Switch(props) {
			return h('button', {
				type: 'button',
				className: D + 'switch' + (props.checked ? ' ' + D + 'switch-on' : ''),
				disabled: props.disabled === true,
				'aria-pressed': props.checked === true,
				onClick: function () { props.onChange(!props.checked) }
			}, h('span', { className: D + 'knob' }))
		}

		function TextRow(props) {
			return h('div', { className: D + 'row' },
				h('span', { className: D + 'name' }, props.label),
				h('input', {
					className: D + 'input',
					style: { width: props.wide ? '100%' : '180px' },
					value: props.value,
					onChange: function (event) { props.onChange(event.target.value) }
				}))
		}

		function SettingsPanel() {
			var [status, setStatus] = React.useState(undefined)
			var [draft, setDraft] = React.useState(undefined)
			var [key, setKey] = React.useState('')
			var [error, setError] = React.useState(undefined)
			var [notice, setNotice] = React.useState(undefined)
			var [busy, setBusy] = React.useState(false)
			var [testInput, setTestInput] = React.useState('')
			var [testResult, setTestResult] = React.useState(undefined)

			function load() {
				setBusy(true)
				callApi('status', {}).then(
					function (result) { setStatus(result); setDraft(result.config); setError(undefined); setBusy(false) },
					function (failure) { setError(String((failure && failure.message) || failure)); setBusy(false) })
			}
			React.useEffect(function () { load() }, [])

			if (draft === undefined) {
				return h('div', { className: D + 'panel' },
					h('h3', null, 'Decisions Classifiers'),
					error ? h('div', { className: D + 'err' }, error) : h('div', { className: D + 'desc' }, busy ? 'Loading…' : 'Unavailable — the host half is not mounted in this profile.'))
			}

			function field(name) {
				return function (next) {
					var copy = {}
					for (var k in draft) if (Object.prototype.hasOwnProperty.call(draft, k)) copy[k] = draft[k]
					copy[name] = next
					setDraft(copy)
				}
			}

			function save() {
				setBusy(true)
				callApi('config', draft).then(
					function (result) { setStatus(result); setDraft(result.config); setNotice('Saved.'); setError(undefined); setBusy(false) },
					function (failure) { setError(String((failure && failure.message) || failure)); setBusy(false) })
			}

			function saveKey(clear) {
				setBusy(true)
				callApi('key', clear === true ? { clear: true } : { value: key }).then(
					function (result) { setStatus(result); setKey(''); setNotice(clear === true ? 'Key cleared.' : 'Key stored.'); setError(undefined); setBusy(false) },
					function (failure) { setError(String((failure && failure.message) || failure)); setBusy(false) })
			}

			function test() {
				setBusy(true)
				setTestResult(undefined)
				callApi('test', { input: testInput }).then(
					function (result) { setTestResult(result.verdict); setError(undefined); setBusy(false) },
					function (failure) { setError(String((failure && failure.message) || failure)); setBusy(false) })
			}

			var presets = status && Array.isArray(status.presets) ? status.presets : []
			var children = []
			children.push(h('h3', { key: 'title' }, 'Decisions Classifiers'))
			children.push(h('div', { className: D + 'desc', key: 'lead', style: { marginBottom: '12px' } },
				'OpenAI Decisions API classifiers (model ' + String(draft.model) + '). The agent tools decisions_ask and decisions_classify plus the injectable decisionsClassifiers service read this configuration.'))

			if (error !== undefined) children.push(h('div', { className: D + 'err', key: 'err' }, error))
			if (notice !== undefined) children.push(h('div', { className: D + 'ok', key: 'notice' }, notice))

			children.push(h('div', { className: D + 'box', key: 'conn' },
				h('div', { className: D + 'name', style: { marginBottom: '8px' } }, 'Connection'),
				TextRow({ label: 'Base URL', value: draft.baseUrl, wide: true, onChange: field('baseUrl') }),
				TextRow({ label: 'Model', value: draft.model, onChange: field('model') }),
				TextRow({ label: 'API key env', value: draft.apiKeyEnv, onChange: field('apiKeyEnv') }),
				TextRow({ label: 'Timeout (ms)', value: String(draft.timeoutMs), onChange: function (v) { field('timeoutMs')(Number(v)) } }),
				h('div', { className: D + 'row' },
					h('span', { className: D + 'name' }, 'Credential'),
					h('span', { className: D + 'desc' }, status && status.hasKey ? ('configured' + (status.keySource ? ' (' + status.keySource + ')' : '')) : 'not configured')),
				h('div', { style: { marginTop: '8px' } },
					h('input', { className: D + 'input', type: 'password', placeholder: 'sk-… (stored through the credential seam; never read back)', value: key, onChange: function (event) { setKey(event.target.value) } })),
				h('div', { className: D + 'actions' },
					h('button', { type: 'button', disabled: busy || key.trim() === '', onClick: function () { saveKey(false) } }, 'Store key'),
					h('button', { type: 'button', disabled: busy || !(status && status.hasKey), onClick: function () { saveKey(true) } }, 'Clear key')),

				h('div', { style: { marginTop: '12px' } },
					h('input', { className: D + 'input', placeholder: 'Test text (optional)', value: testInput, onChange: function (event) { setTestInput(event.target.value) } })),
				h('div', { className: D + 'actions' },
					h('button', { type: 'button', disabled: busy, onClick: test }, busy ? 'Testing…' : 'Test connection')),
				testResult ? h('pre', { className: D + 'mono pre' }, JSON.stringify(testResult, null, 2)) : null))

			children.push(h('div', { className: D + 'box', key: 'behaviour' },
				h('div', { className: D + 'name', style: { marginBottom: '8px' } }, 'Behaviour'),
				h('div', { className: D + 'row' },
					h('span', null, h('div', { className: D + 'name' }, 'Plugin enabled'), h('div', { className: D + 'desc' }, 'Master switch for the tools, the service, the gate, and the advice card.')),
					Switch({ checked: draft.enabled, onChange: field('enabled') })),
				h('div', { className: D + 'row' },
					h('span', null, h('div', { className: D + 'name' }, 'Advice card'), h('div', { className: D + 'desc' }, 'Float the classifier recommendation beside ask_user_question multiple-choice prompts.')),
					Switch({ checked: draft.advisorEnabled, onChange: field('advisorEnabled') })),
				h('div', { className: D + 'row' },
					h('span', null, h('div', { className: D + 'name' }, 'System prompt section'), h('div', { className: D + 'desc' }, 'Tell the agent the two classifiers exist.')),
					Switch({ checked: draft.systemPromptSection, onChange: field('systemPromptSection') })),
				TextRow({ label: 'Default threshold', value: String(draft.defaultThreshold), onChange: function (v) { field('defaultThreshold')(Number(v)) } })))

			children.push(h('div', { className: D + 'box', key: 'gate' },
				h('div', { className: D + 'name', style: { marginBottom: '8px' } }, 'Call gate (off by default)'),
				h('div', { className: D + 'desc', style: { marginBottom: '8px' } }, 'When on, every run_code/bash/write/edit call is classified before it executes. Off by default: installing this plugin must not change how an agent behaves.'),
				h('div', { className: D + 'row' },
					h('span', { className: D + 'name' }, 'Gate enabled'),
					Switch({ checked: draft.gateEnabled, onChange: field('gateEnabled') })),
				TextRow({ label: 'Gate classifier', value: draft.gatePreset, onChange: field('gatePreset') }),
				TextRow({ label: 'Gate threshold', value: String(draft.gateThreshold), onChange: function (v) { field('gateThreshold')(Number(v)) } }),
				TextRow({ label: 'On flag', value: draft.gateDecision, onChange: field('gateDecision') })))

			children.push(h('div', { className: D + 'box', key: 'presets' },
				h('div', { className: D + 'name', style: { marginBottom: '8px' } }, 'Classifier library (' + String(presets.length) + ')'),
				presets.length === 0 ? h('div', { className: D + 'desc' }, 'None reported.')
					: h('div', null, presets.map(function (preset) {
						return h('div', { className: D + 'row', key: preset.id },
							h('span', { className: D + 'name' }, preset.id),
							h('span', { className: D + 'desc' }, preset.title + ' · ' + preset.answerType))
					}))))

			if (status && status.stats) {
				children.push(h('div', { className: D + 'box', key: 'stats' },
					h('div', { className: D + 'name', style: { marginBottom: '8px' } }, 'Session stats'),
					h('div', { className: D + 'desc' },
						'classified ' + String(status.stats.classified) + ' · flagged ' + String(status.stats.flagged) + ' · gated ' + String(status.stats.gated) + ' · denied ' + String(status.stats.denied) + ' · advised ' + String(status.stats.advised) + ' · errors ' + String(status.stats.errors)),
					status.recent && status.recent.length > 0
						? h('pre', { className: D + 'mono pre' }, status.recent.map(function (row) { return row.at + ' ' + row.kind + ' ' + row.detail }).join('\n'))
						: null))
			}

			children.push(h('div', { className: D + 'actions', key: 'save' },
				h('button', { type: 'button', className: D + 'primary', disabled: busy, onClick: save }, busy ? 'Saving…' : 'Save'),
				h('button', { type: 'button', disabled: busy, onClick: load }, 'Reload')))

			return h('div', { className: D + 'panel' }, children)
		}

		/** Mount both surfaces. */
		function apply(ctx) {
			ctx.effect(function () {
				var tag = document.createElement('style')
				tag.id = STYLE_ID
				tag.dataset.plugin = 'dsh-decisions-classifiers'
				tag.textContent = CSS
				document.head.appendChild(tag)
				return function () {
					var existing = document.getElementById(STYLE_ID)
					if (existing) existing.remove()
				}
			}, 'dsh-decisions-classifiers: styles')

			ctx.slots.inject('shell.overlay', function () {
				return ctx.slots.register(
					{ name: 'shell.overlay', id: 'decisions-classifiers-advice', order: 70 },
					AdviceCard)
			})

			ctx.slots.inject('settings.section', function () {
				return ctx.slots.register(
					{ name: 'settings.section', id: 'decisions-classifiers', order: 32, label: 'Decisions Classifiers' },
					SettingsPanel)
			})
		}

		exports.apply = apply
		exports.inject = ['slots']
		return module.exports
	}
})
