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

export default function YearlyChart({ totals }) {
  const data = totals.map((t) => ({
    label: String(t.year),
    total: t.total,
  }))
  const hasData = data.some((d) => d.total > 0)

  return (
    <div className="card chart-card">
      <h2>Yearly Comparison (per year)</h2>
      {hasData ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip formatter={(v) => usd(v)} cursor={{ fill: 'rgba(245,158,11,0.08)' }} />
            <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={72} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="empty">No spending recorded yet.</p>
      )}
    </div>
  )
}
