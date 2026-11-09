import 'dotenv/config'
import crypto from 'crypto'
import fs from 'fs'
import express from 'express'
import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

const app = express()
const PORT = process.env.PORT || 3001
const SPREADSHEET_ID = process.env.SHEET_ID
const AUTH_SECRET = process.env.AUTH_SECRET
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const TOKEN_DAYS = 30

if (!SPREADSHEET_ID) {
  console.error('Missing SHEET_ID in .env')
  process.exit(1)
}
if (!AUTH_SECRET) {
  console.error('Missing AUTH_SECRET in .env')
  process.exit(1)
}
if (!GOOGLE_CLIENT_ID) {
  console.error('Missing GOOGLE_CLIENT_ID in .env')
  process.exit(1)
}

app.use(express.json())

// ---------- CORS: the React app lives on another domain in production ----------
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})

// used by hosting platforms (Render) as a health-check target
app.get('/health', (_req, res) => res.json({ ok: true }))
app.get('/', (_req, res) => res.json({ ok: true, name: 'Money Expense Tracker API' }))

// In production (Render/Vercel) there is no file to read, so the whole
// credentials.json is pasted into a GOOGLE_CREDENTIALS environment variable.
const creds = process.env.GOOGLE_CREDENTIALS
  ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
  : JSON.parse(fs.readFileSync(process.env.CREDENTIALS_PATH || './credentials.json', 'utf8'))
const auth = new google.auth.JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})
const sheets = google.sheets({ version: 'v4', auth })

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

const HEADERS = ['ID', 'Date', 'Amount', 'Category', 'Note', 'Owner']
const USERS_HEADERS = ['ID', 'Gmail', 'PasswordHash', 'Created']
const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
let sheetId = 0

// ---------- session tokens (HMAC-signed, no external dependency) ----------
function signToken(email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + TOKEN_DAYS * 86400000 })).toString('base64url')
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

function verifyToken(token) {
  const [payload, sig] = String(token || '').split('.')
  if (!payload || !sig) return null
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const { email, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) return null
    if (typeof exp !== 'number' || Date.now() > exp) return null
    return email
  } catch {
    return null
  }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const email = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : null)
  if (!email) return res.status(401).json({ error: 'Please sign in again.' })
  req.user = email
  next()
}

// Reads are public: anyone can browse (an anonymous visitor simply gets empty
// data), but a token that IS present must still be valid or we reject it so the
// client can clear its stale session.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || ''
  if (!header) {
    req.user = null
    return next()
  }
  const email = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : null)
  if (!email) return res.status(401).json({ error: 'Please sign in again.' })
  req.user = email
  next()
}

app.use('/api/transactions', optionalAuth)
app.use('/api/summary', optionalAuth)
app.use('/api/monthly-totals', optionalAuth)
app.use('/api/yearly-totals', optionalAuth)

// public reads: no session -> empty result (and no spreadsheet read at all)
async function readRowsFor(req) {
  if (!req.user) return []
  return (await readRows()).filter((r) => r.owner === req.user)
}

// ---------- sheet setup ----------
async function initSheet() {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  sheetId = meta.data.sheets[0].properties.sheetId

  // make sure the Users tab exists
  if (!meta.data.sheets.some((s) => s.properties.title.toLowerCase() === 'users')) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { requests: [{ addSheet: { properties: { title: 'Users' } } }] },
    })
    console.log('Users tab created')
  }

  // transactions headers (adds the Owner column if missing)
  const txHead = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'A1:F1' })
  if (!txHead.data.values || txHead.data.values[0].length < HEADERS.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'A1:F1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [HEADERS] },
    })
    console.log('Transaction headers updated (Owner column added)')
  }

  // users headers
  const uHead = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Users!A1:D1' })
  if (!uHead.data.values || uHead.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A1:D1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [USERS_HEADERS] },
    })
    console.log('Users headers created')
  }
}

async function readRows() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A2:F',
  })
  const rows = res.data.values || []
  return rows
    .map((r, i) => ({
      id: r[0],
      date: r[1] || '',
      amount: Number(r[2]) || 0,
      category: r[3] || '',
      note: r[4] || '',
      owner: String(r[5] || '').trim().toLowerCase(),
      rowNumber: i + 2, // 1-based + header row
    }))
    .filter((r) => r.id)
}

async function readUsers() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Users!A2:D',
  })
  return (res.data.values || [])
    .map((r) => ({ id: r[0], email: String(r[1] || '').trim().toLowerCase(), hash: r[2] || '', created: r[3] || '' }))
    .filter((u) => u.email)
}

// ---------- auth routes (Google OAuth) ----------
app.post('/api/auth/google', async (req, res) => {
  try {
    const credential = String(req.body?.credential || '')
    if (!credential) return res.status(400).json({ error: 'Missing Google credential.' })

    // verify the ID token's signature, audience, issuer and expiry with Google
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    const email = String(payload?.email || '').trim().toLowerCase()
    if (!payload?.email_verified) return res.status(400).json({ error: 'Google account email is not verified.' })
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email from Google.' })

    const users = await readUsers()
    const exists = users.some((u) => u.email === email)

    // first account ever claims all rows that don't have an owner yet
    if (!exists && users.length === 0) {
      const txRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'A2:F' })
      const rows = txRes.data.values || []
      if (rows.length > 0 && rows.some((r) => !String(r[5] || '').trim())) {
        const owners = rows.map((r) => [String(r[5] || '').trim() || email])
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `F2:F${rows.length + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: owners },
        })
        console.log(`First Google user ${email} claimed ${owners.length} existing rows`)
      }
    }

    if (!exists) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Users!A:D',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [[Date.now().toString(), email, '', new Date().toISOString()]] },
      })
    }

    res.json({ token: signToken(email), email })
  } catch {
    // verifyIdToken throws on bad/expired tokens
    res.status(401).json({ error: 'Google sign-in failed. Please try again.' })
  }
})

// ---------- transactions ----------
// GET /api/transactions?month=YYYY-MM
app.get('/api/transactions', async (req, res) => {
  try {
    const { month } = req.query
    let rows = await readRowsFor(req)
    if (month) rows = rows.filter((r) => String(r.date).startsWith(month))
    rows.sort((a, b) => (String(b.date) + String(b.id)).localeCompare(String(a.date) + String(a.id)))
    res.json(rows.map(({ rowNumber: _rowNumber, owner: _owner, ...tx }) => tx))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/transactions
app.post('/api/transactions', requireAuth, async (req, res) => {
  try {
    const { amount, date, category, note = '' } = req.body || {}
    const num = Number(amount)
    if (!num || num <= 0) return res.status(400).json({ error: 'Amount must be a positive number' })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'Date must be YYYY-MM-DD' })
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' })

    const tx = { id: Date.now().toString(), date, amount: num, category, note: String(note) }
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'A:F',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [[tx.id, tx.date, tx.amount, tx.category, tx.note, req.user]] },
    })
    res.status(201).json(tx)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/transactions/batch  { items: [{ amount, date, category, note }] }
app.post('/api/transactions/batch', requireAuth, async (req, res) => {
  try {
    const { items } = req.body || {}
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' })
    }
    if (items.length > 200) {
      return res.status(400).json({ error: 'Too many items (max 200 per batch)' })
    }

    const rows = items.map((it, i) => {
      const num = Number(it?.amount)
      if (!Number.isFinite(num) || num <= 0) {
        throw Object.assign(new Error(`Item ${i + 1}: amount must be a positive number`), { status: 400 })
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(it?.date))) {
        throw Object.assign(new Error(`Item ${i + 1}: date must be YYYY-MM-DD`), { status: 400 })
      }
      if (!CATEGORIES.includes(it?.category)) {
        throw Object.assign(new Error(`Item ${i + 1}: invalid category`), { status: 400 })
      }
      return [
        `${Date.now()}_${i}`,
        it.date,
        Math.round(num * 100) / 100,
        it.category,
        String(it.note || '').slice(0, 100),
        req.user,
      ]
    })

    // single append call = one Google Sheets API request for the whole list
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'A:F',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: rows },
    })

    res.status(201).json({
      count: rows.length,
      items: rows.map((r) => ({ id: r[0], date: r[1], amount: r[2], category: r[3], note: r[4] })),
    })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
})

// DELETE /api/transactions/:id
app.delete('/api/transactions/:id', requireAuth, async (req, res) => {
  try {
    const rows = await readRows()
    const target = rows.find((r) => String(r.id) === String(req.params.id) && r.owner === req.user)
    if (!target) return res.status(404).json({ error: 'Transaction not found' })

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: target.rowNumber - 1, // 0-based
                endIndex: target.rowNumber,
              },
            },
          },
        ],
      },
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---------- summaries / charts ----------
// GET /api/summary?month=YYYY-MM
app.get('/api/summary', async (req, res) => {
  try {
    const { month } = req.query
    let rows = await readRowsFor(req)
    if (month) rows = rows.filter((r) => String(r.date).startsWith(month))
    const total = rows.reduce((s, r) => s + r.amount, 0)
    res.json({ total, count: rows.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/monthly-totals  -> last 6 months including zeros
app.get('/api/monthly-totals', async (req, res) => {
  try {
    const rows = await readRowsFor(req)
    const now = new Date()
    const totals = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      totals.push({
        month: key,
        total: rows.filter((r) => String(r.date).startsWith(key)).reduce((s, r) => s + r.amount, 0),
      })
    }
    res.json(totals)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/yearly-totals  -> every year in the data (plus the current year), oldest first
app.get('/api/yearly-totals', async (req, res) => {
  try {
    const rows = await readRowsFor(req)
    const map = new Map()
    map.set(new Date().getFullYear(), 0)
    for (const r of rows) {
      const y = Number(String(r.date).slice(0, 4))
      if (Number.isFinite(y) && y > 1970) map.set(y, (map.get(y) || 0) + r.amount)
    }
    const years = [...map.entries()]
      .map(([year, total]) => ({ year, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => a.year - b.year)
    res.json(years)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

initSheet()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`))
  })
  .catch((err) => {
    console.error('Failed to init sheet:', err.message)
    process.exit(1)
  })
