import { CATEGORY_COLORS } from '../categories.js'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function formatDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TransactionList({ transactions, onDelete, deletingId }) {
  if (transactions.length === 0) {
    return (
      <div className="card list">
        <h2>Transactions</h2>
        <p className="empty">No transactions this month yet. Add one above ↑</p>
      </div>
    )
  }

  async function handleDelete(id) {
    if (window.confirm('Delete this transaction?')) {
      try {
        await onDelete(id)
      } catch (err) {
        alert(`Could not delete: ${err.message}`)
      }
    }
  }

  return (
    <div className="card list">
      <h2>Transactions</h2>
      <ul className="tx-rows">
        {transactions.map((t) => (
          <li key={t.id} className="tx-row">
            <span className="tx-date">{formatDay(t.date)}</span>
            <span className="tx-category" style={{ background: CATEGORY_COLORS[t.category] || '#6b7280' }}>
              {t.category}
            </span>
            <span className="tx-note">{t.note}</span>
            <span className="tx-amount">{usd.format(t.amount)}</span>
            <button
              className="tx-delete"
              title="Delete"
              disabled={deletingId === t.id}
              onClick={() => handleDelete(t.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
