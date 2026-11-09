import { useEffect, useRef, useState } from 'react'
import { parseBatchMessage } from '../parseBatch.js'
import { parseMessage, todayKey, yesterdayKey } from '../parseMessage.js'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const EXAMPLES = ['food 12.50 lunch', 'spent 45 on transport', 'yesterday shopping 20']
const YES_RE = /^(yes|y|ok|confirm|save|go|proceed)\b/i
const NO_RE = /^(no|n|cancel|stop|discard)\b/i

function friendlyDate(dateStr) {
  if (dateStr === todayKey()) return 'today'
  if (dateStr === yesterdayKey()) return 'yesterday'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function shortDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function buildPreview(p) {
  const lines = [
    `📋 Parsed ${p.entries.length} entries for ${p.monthLabel} — total ${usd.format(p.total)}`,
  ]
  const shown = p.entries.slice(0, 25)
  shown.forEach((e, i) => {
    lines.push(`${i + 1}. ${e.note} — ${usd.format(e.amount)} (${shortDate(e.date)})`)
  })
  if (p.entries.length > 25) lines.push(`… and ${p.entries.length - 25} more`)
  if (p.warnings.length > 0) {
    lines.push(`⚠️ ${p.warnings.length} line(s) skipped:`)
    for (const w of p.warnings.slice(0, 3)) lines.push(`• ${w}`)
    if (p.warnings.length > 3) lines.push(`… +${p.warnings.length - 3} more`)
  }
  lines.push('Reply YES to save, or NO to cancel.')
  return lines.join('\n')
}

export default function ChatBox({ monthLabel, onAdd, onBatch }) {
  const [messages, setMessages] = useState([
    {
      id: 0,
      from: 'bot',
      kind: 'info',
      text: '👋 Hi! Type one expense like "food 12.50 lunch", or paste a whole month\'s list (header like "September cost 2026" + one item per line) and I\'ll add them all.',
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const pendingRef = useRef(null) // batch waiting for YES/NO
  const nextId = useRef(1)
  const listRef = useRef(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  function push(from, text, kind = 'info') {
    setMessages((m) => [...m, { id: nextId.current++, from, text, kind }])
  }

  // --- single line: one transaction (existing behavior) ---
  async function handleSingle(text) {
    const parsed = parseMessage(text)
    if (!parsed.ok) {
      push('bot', parsed.error, 'error')
      return
    }
    setSending(true)
    try {
      const fresh = await onAdd(parsed.transaction)
      const tx = parsed.transaction
      const notePart = tx.note ? ` · note "${tx.note}"` : ''
      const total = fresh.reduce((s, t) => s + t.amount, 0)
      push(
        'bot',
        `✅ Added — ${tx.category} · ${usd.format(tx.amount)} · ${friendlyDate(tx.date)}${notePart}\n` +
          `📊 ${monthLabel} total: ${usd.format(total)} (${fresh.length} transaction${fresh.length === 1 ? '' : 's'})`,
        'success'
      )
    } catch (err) {
      push('bot', `❌ Couldn't save: ${err.message}\nReply YES to retry, NO to cancel.`, 'error')
      pendingRef.current = { single: parsed.transaction }
    } finally {
      setSending(false)
    }
  }

  // --- multiline: parse whole list, then wait for YES/NO ---
  function handleBulk(text) {
    const hadPending = pendingRef.current !== null
    const p = parseBatchMessage(text)
    if (!p.ok) {
      push('bot', p.error, 'error')
      return
    }
    pendingRef.current = p
    const replaced = hadPending ? '\n(previous unconfirmed batch was replaced)' : ''
    push('bot', buildPreview(p) + replaced, 'info')
  }

  async function savePending() {
    const p = pendingRef.current
    if (!p) return
    setSending(true)
    try {
      if (p.single) {
        // retry of a failed single add
        const fresh = await onAdd(p.single)
        const total = fresh.reduce((s, t) => s + t.amount, 0)
        pendingRef.current = null
        push('bot', `✅ Added — ${p.single.category} · ${usd.format(p.single.amount)}\n📊 ${monthLabel} total: ${usd.format(total)}`, 'success')
      } else {
        const fresh = await onBatch(p.entries, p.month)
        pendingRef.current = null
        const savedTotal = fresh.reduce((s, t) => s + t.amount, 0)
        push(
          'bot',
          `✅ Saved ${p.entries.length} transactions for ${p.monthLabel} — ${usd.format(p.total)}\n` +
            `📊 ${p.monthLabel} now has ${fresh.length} transactions totaling ${usd.format(savedTotal)}. Showing ${p.monthLabel} now.`,
          'success'
        )
      }
    } catch (err) {
      push('bot', `❌ Couldn't save: ${err.message}\nReply YES to retry, NO to cancel.`, 'error')
    } finally {
      setSending(false)
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    push('user', text)
    setInput('')

    // a fresh multiline paste replaces any pending batch
    if (text.includes('\n')) {
      handleBulk(text)
      return
    }

    // a batch is waiting for confirmation
    if (pendingRef.current) {
      if (YES_RE.test(text)) {
        await savePending()
      } else if (NO_RE.test(text)) {
        const count = pendingRef.current.entries?.length ?? 1
        pendingRef.current = null
        push('bot', `❌ Cancelled — the ${count} pending transaction${count === 1 ? '' : 's'} ${count === 1 ? 'was' : 'were'} not saved.`, 'info')
      } else {
        const count = pendingRef.current.entries?.length ?? 1
        push('bot', `I'm still holding ${count} transaction${count === 1 ? '' : 's'} — reply YES to save, or NO to cancel.`, 'info')
      }
      return
    }

    await handleSingle(text)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  return (
    <div className="card chat">
      <h2>💬 Chat Add — just type or paste it</h2>
      <div className="chat-messages" ref={listRef}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`msg msg-${m.from}${m.kind === 'error' ? ' msg-error' : m.kind === 'success' ? ' msg-success' : ''}`}
          >
            {m.text}
          </div>
        ))}
        {sending && <div className="msg msg-bot msg-typing">…</div>}
      </div>
      <form className="chat-input-row" onSubmit={handleSend}>
        <textarea
          className="chat-input"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={'e.g. "lunch 9.50"\nor paste a list: "September cost 2026\\nEgg - 137"'}
          aria-label="Type or paste an expense"
        />
        <button className="chat-send" type="submit" disabled={sending || !input.trim()}>
          {sending ? '…' : 'Send'}
        </button>
      </form>
      <div className="chips">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="chip" onClick={() => setInput(ex)}>
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}
