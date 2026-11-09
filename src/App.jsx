import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import {
  addTransaction,
  addTransactionsBatch,
  clearAuth,
  deleteTransaction,
  getAuth,
  getMonthlyTotals,
  getTransactions,
  getYearlyTotals,
} from './api.js'
import AuthPage from './components/AuthPage.jsx'
import DailyChart from './components/DailyChart.jsx'
import MonthlyChart from './components/MonthlyChart.jsx'
import YearlyChart from './components/YearlyChart.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import ChatBox from './components/ChatBox.jsx'
import Sidebar from './components/Sidebar.jsx'
import TransactionForm from './components/TransactionForm.jsx'
import TransactionList from './components/TransactionList.jsx'

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + delta, 1))
}

export default function App() {
  const [user, setUser] = useState(() => {
    const a = getAuth()
    return a.token && a.email ? a.email : null
  })
  const [page, setPage] = useState('dashboard')
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [transactions, setTransactions] = useState([])
  const [monthlyTotals, setMonthlyTotals] = useState([])
  const [yearlyTotals, setYearlyTotals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)

  // mirror of `user` that event handlers can trust: setState is async, but an
  // action waiting for sign-in must see the fresh value the moment it arrives
  const userRef = useRef(user)
  useEffect(() => {
    userRef.current = user
  }, [user])

  // actions that were started while logged out — they resume once Google auth
  // completes (or fail if the visitor closes the login popup)
  const waitersRef = useRef(new Set())

  function settleWaiters(ok, err) {
    const waiters = [...waitersRef.current]
    waitersRef.current = new Set()
    for (const w of waiters) (ok ? w.resolve : w.reject)(err)
  }

  // resolves as soon as there is a signed-in user, rejects if the popup closes
  function ensureAuth() {
    if (userRef.current) return Promise.resolve()
    setLoginOpen(true)
    return new Promise((resolve, reject) => waitersRef.current.add({ resolve, reject }))
  }

  // session expired (server rejected the token) -> back to browsing as a guest
  useEffect(() => {
    const onExpired = () => {
      userRef.current = null
      setUser(null)
      setTransactions([])
      setMonthlyTotals([])
      setYearlyTotals([])
    }
    window.addEventListener('auth-expired', onExpired)
    return () => window.removeEventListener('auth-expired', onExpired)
  }, [])

  // don't let the page scroll behind the login popup, Escape closes it
  useEffect(() => {
    document.body.style.overflow = loginOpen ? 'hidden' : ''
    if (!loginOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeLogin()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [loginOpen])

  const load = useCallback(async (key) => {
    setError('')
    setLoading(true)
    try {
      const tx = await getTransactions(key)
      setTransactions(tx)
      return tx
    } catch (err) {
      setError(`Could not load transactions: ${err.message}`)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTotals = useCallback(async () => {
    try {
      const [monthly, yearly] = await Promise.all([getMonthlyTotals(), getYearlyTotals()])
      setMonthlyTotals(monthly)
      setYearlyTotals(yearly)
    } catch {
      // non-critical, keep old data
    }
  }, [])

  // anonymous visitors get empty data from the API — boxes/charts render at $0;
  // `user` stays in the deps so signing in re-fetches the real data
  useEffect(() => {
    load(month)
  }, [month, load, user])

  useEffect(() => {
    loadTotals()
  }, [loadTotals, user])

  async function handleAdd(tx) {
    await ensureAuth() // blocks in the login popup, then continues
    await addTransaction(tx)
    const [fresh] = await Promise.all([load(month), loadTotals()])
    return fresh
  }

  async function handleBatch(items, targetMonth) {
    await ensureAuth()
    await addTransactionsBatch(items)
    // jump to the month that was pasted so the user sees the new rows
    setMonth(targetMonth)
    const fresh = await getTransactions(targetMonth)
    setTransactions(fresh)
    await loadTotals()
    return fresh
  }

  async function handleDelete(id) {
    await ensureAuth()
    setDeletingId(id)
    try {
      await deleteTransaction(id)
      await Promise.all([load(month), loadTotals()])
    } finally {
      setDeletingId(null)
    }
  }

  function handleAuth(email) {
    userRef.current = email
    setUser(email)
    setLoginOpen(false)
    settleWaiters(true) // resume whatever was waiting when the popup opened
    setError('')
  }

  function closeLogin() {
    setLoginOpen(false)
    settleWaiters(false, new Error('Sign in with Google to save your transactions.'))
  }

  function logout() {
    clearAuth()
    userRef.current = null
    setUser(null)
    setPage('dashboard')
    setTransactions([])
    setMonthlyTotals([])
    setYearlyTotals([])
    setError('')
  }

  const label = monthLabel(month)

  return (
    <div className="layout">
      <Sidebar
        email={user}
        page={page}
        onNavigate={setPage}
        onLogout={logout}
        onSignIn={() => setLoginOpen(true)}
      />

      <main className="main">
        <div className="page-header">
          <h1 className="page-title">{page === 'dashboard' ? '📊 Dashboard' : '🧾 Transactions'}</h1>
          <div className="month-nav">
            <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
              ‹
            </button>
            <span className="month-label">{label}</span>
            <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
              ›
            </button>
          </div>
        </div>

        {!user && (
          <div className="banner-info">
            👋 You're browsing as a guest — everything is empty.{' '}
            <button type="button" className="link-btn" onClick={() => setLoginOpen(true)}>
              Sign in with Google
            </button>{' '}
            to see your expenses, or try adding one and we'll ask you to sign in.
          </div>
        )}

        {error && <div className="banner-error">{error}</div>}

        {/* ===== Dashboard: boxes + charts ===== */}
        {page === 'dashboard' && (
          <>
            <SummaryCards transactions={transactions} month={month} />
            <div className="charts">
              <DailyChart transactions={transactions} month={month} monthLabel={label} />
              <MonthlyChart totals={monthlyTotals} />
              <YearlyChart totals={yearlyTotals} />
            </div>
          </>
        )}

        {/* ===== Transactions: list + form (main) | chat (right) =====
            kept mounted (hidden) so chat history & pending batch survive page switches */}
        <div className={`tx-layout${page === 'transactions' ? '' : ' is-hidden'}`}>
          <div className="tx-main">
            {loading ? (
              <div className="card list">
                <h2>Transactions</h2>
                <p className="empty">Loading…</p>
              </div>
            ) : (
              <TransactionList transactions={transactions} onDelete={handleDelete} deletingId={deletingId} />
            )}
            <TransactionForm key={month} month={month} onAdd={handleAdd} />
          </div>
          <aside className="tx-chat">
            <ChatBox monthLabel={label} onAdd={handleAdd} onBatch={handleBatch} />
          </aside>
        </div>
      </main>

      {/* ===== login popup: shown on demand (sidebar button or an add attempt) ===== */}
      {loginOpen && (
        <div className="modal-overlay" onClick={closeLogin}>
          <AuthPage
            onClose={closeLogin}
            onAuth={handleAuth}
            title="Sign in to continue"
            subtitle="Use your Google account to save transactions — your expenses stay private to your account."
          />
        </div>
      )}
    </div>
  )
}
