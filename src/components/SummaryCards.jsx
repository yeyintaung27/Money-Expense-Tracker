const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function SummaryCards({ transactions, month }) {
  const total = transactions.reduce((s, t) => s + t.amount, 0)
  const count = transactions.length

  const [year, m] = month.split('-').map(Number)
  const now = new Date()
  const isCurrent = now.getFullYear() === year && now.getMonth() + 1 === m
  const isFuture = year > now.getFullYear() || (year === now.getFullYear() && m > now.getMonth() + 1)
  const daysInMonth = new Date(year, m, 0).getDate()
  const elapsed = isCurrent ? now.getDate() : isFuture ? 0 : daysInMonth
  const avgPerDay = elapsed > 0 ? total / elapsed : 0

  const byCategory = {}
  for (const t of transactions) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount
  }
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

  return (
    <div className="summary-cards">
      <div className="card stat">
        <span className="stat-label">Total Spent</span>
        <span className="stat-value">{usd.format(total)}</span>
      </div>
      <div className="card stat">
        <span className="stat-label">Transactions</span>
        <span className="stat-value">{count}</span>
      </div>
      <div className="card stat">
        <span className="stat-label">Avg / Day</span>
        <span className="stat-value">{usd.format(avgPerDay)}</span>
      </div>
      <div className="card stat">
        <span className="stat-label">Top Category</span>
        <span className="stat-value">{topCategory}</span>
      </div>
    </div>
  )
}
