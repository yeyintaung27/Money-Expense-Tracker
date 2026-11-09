function avatarHue(email) {
  let h = 7
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

export default function Sidebar({ email, page, onNavigate, onLogout, onSignIn }) {
  const letter = (email || '?').charAt(0).toUpperCase()

  return (
    <aside className="sidebar">
      <div className="side-user">
        <span
          className={`avatar${email ? '' : ' avatar-guest'}`}
          style={email ? { background: `hsl(${avatarHue(email)}, 62%, 45%)` } : undefined}
        >
          {email ? letter : '👤'}
        </span>
        <span className="side-email" title={email || undefined}>
          {email || 'Not signed in'}
        </span>
      </div>

      <nav className="side-nav">
        <button
          className={`nav-item${page === 'dashboard' ? ' active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          <span className="nav-icon">📊</span> Dashboard
        </button>
        <button
          className={`nav-item${page === 'transactions' ? ' active' : ''}`}
          onClick={() => onNavigate('transactions')}
        >
          <span className="nav-icon">🧾</span> Transactions
        </button>
      </nav>

      <div className="side-footer">
        {email ? (
          <button className="side-logout" onClick={onLogout}>
            ⎋ Logout
          </button>
        ) : (
          <button className="side-signin" onClick={onSignIn}>
            🔑 Sign in
          </button>
        )}
        <a className="side-link" href="/privacy.html" target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
      </div>
    </aside>
  )
}
