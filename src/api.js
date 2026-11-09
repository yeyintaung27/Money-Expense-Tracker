const TOKEN_KEY = 'met_token'
const EMAIL_KEY = 'met_email'

// Production: the API runs on another host (Render), so VITE_API_BASE is set at
// build time. Locally it's empty and Vite's dev proxy forwards /api to :3001.
const BASE = String(import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')

export function getAuth() {
  try {
    return { token: localStorage.getItem(TOKEN_KEY), email: localStorage.getItem(EMAIL_KEY) }
  } catch {
    return { token: null, email: null }
  }
}

export function setAuth(token, email) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EMAIL_KEY, email)
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EMAIL_KEY)
}

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) }
  const token = getAuth().token
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'

  const res = await fetch(BASE + url, { ...options, headers })
  const data = await res.json().catch(() => null)
  if (res.status === 401) {
    clearAuth()
    window.dispatchEvent(new Event('auth-expired'))
    throw new Error(data?.error || 'Please sign in again.')
  }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

// ---------- auth (Google OAuth) ----------
export const authGoogle = (credential) =>
  request('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  })

// ---------- expenses ----------
export const getTransactions = (month) => request(`/api/transactions?month=${month}`)

export const addTransaction = (tx) =>
  request('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(tx),
  })

export const addTransactionsBatch = (items) =>
  request('/api/transactions/batch', {
    method: 'POST',
    body: JSON.stringify({ items }),
  })

export const deleteTransaction = (id) => request(`/api/transactions/${id}`, { method: 'DELETE' })

export const getMonthlyTotals = () => request('/api/monthly-totals')

export const getYearlyTotals = () => request('/api/yearly-totals')
