import { useState } from 'react'
import { CATEGORIES } from '../categories.js'

export default function TransactionForm({ month, onAdd }) {
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const defaultDate = month === currentMonth ? formatDate(today) : `${month}-01`

  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [category, setCategory] = useState('Food')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onAdd({ amount: Number(amount), date, category, note: note.trim() })
      setAmount('')
      setNote('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h2>Add Transaction</h2>
      <div className="form-grid">
        <label>
          Amount ($)
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Note (optional)
          <input
            type="text"
            placeholder="e.g. Lunch with friends"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn-primary" type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Add Transaction'}
      </button>
    </form>
  )
}
