import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const usd = (v) =>
  `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`

export default function DailyChart({ transactions, month, monthLabel }) {
  const [year, m] = month.split('-').map(Number)
  const daysInMonth = new Date(year, m, 0).getDate()

  const data = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    total: 0,
  }))
  for (const t of transactions) {
    const day = Number(String(t.date).slice(8, 10))
    if (day >= 1 && day <= daysInMonth) data[day - 1].total += t.amount
  }

  const hasData = data.some((d) => d.total > 0)

  return (
    <div className="card chart-card">
      <h2>Daily Spending — {monthLabel}</h2>
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip formatter={(v) => usd(v)} labelFormatter={(l) => `${monthLabel.split(' ')[0]} ${l}`} />
            <Bar dataKey="total" fill="#4f6df5" radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="empty">No spending recorded for this month.</p>
      )}
    </div>
  )
}
