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

export default function MonthlyChart({ totals }) {
  const data = totals.map((t) => ({
    label: new Date(t.month + '-01T00:00:00').toLocaleString('en-US', { month: 'short' }),
    total: t.total,
  }))
  const hasData = data.some((d) => d.total > 0)

  return (
    <div className="card chart-card">
      <h2>Monthly Comparison (last 6 months)</h2>
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip formatter={(v) => usd(v)} cursor={{ fill: 'rgba(79,109,245,0.06)' }} />
            <Bar dataKey="total" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="empty">No spending recorded yet.</p>
      )}
    </div>
  )
}
