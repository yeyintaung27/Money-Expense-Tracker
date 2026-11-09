import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { authGoogle, setAuth } from '../api.js'

export default function AuthPage({ onAuth, onClose, title = 'Sign in with Google', subtitle }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCredential(credential) {
    setError('')
    setBusy(true)
    try {
      const res = await authGoogle(credential)
      setAuth(res.token, res.email)
      onAuth(res.email)
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-card" role="dialog" aria-modal="true" aria-label="Sign in" onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <button className="modal-close" onClick={onClose} aria-label="Close sign-in">
          ×
        </button>
      )}

      <div className="auth-logo">💰</div>
      <h1 className="auth-title">Money Expense Tracker</h1>
      <h2>{title}</h2>
      <p className="auth-sub">{subtitle || 'Use your Google account to access your expenses. Your data is private to your account.'}</p>

      <div className="google-btn-wrap">
        {busy ? (
          <p className="empty">Signing you in…</p>
        ) : (
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              if (credentialResponse?.credential) handleCredential(credentialResponse.credential)
              else setError('No credential returned by Google.')
            }}
            onError={() => setError('Google sign-in was cancelled or failed.')}
            theme="outline"
            size="large"
            text="signin_with"
            shape="rectangular"
            logo_alignment="left"
          />
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <p className="auth-note">
        The first Google account to sign in links all existing expense data to it.
      </p>
    </div>
  )
}
