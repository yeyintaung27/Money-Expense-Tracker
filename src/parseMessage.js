import { CATEGORIES, CATEGORY_KEYWORDS } from './categories.js'

// Words that get removed from the note because they're just filler
const FILLER = new Set([
  'spent', 'pay', 'paid', 'for', 'on', 'the', 'a', 'an', 'i', 'my',
  'was', 'were', 'cost', 'of', 'usd', 'dollars', 'dollar', 'bucks',
  'expense', 'money', 'today', 'yesterday',
])

// The main category name itself (always stripped from notes, wins keyword priority)
const PRIMARY = new Set(CATEGORIES.map((c) => c.toLowerCase()))

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function todayKey() {
  return fmt(new Date())
}

export function yesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return fmt(d)
}

/**
 * Understands messages like:
 *   "food 12.50 lunch"          -> Food, 12.50, today, note "Lunch"
 *   "spent 45 on transport"     -> Transport, 45, today, no note
 *   "shopping 89.99 new shoes"  -> Shopping, 89.99, note "New shoes"
 *   "yesterday transport 20"    -> Transport, 20, yesterday
 *   "2026-10-20 bills 120"      -> Bills, 120, Oct 20, no note
 * Returns { ok: true, transaction } or { ok: false, error }.
 */
export function parseMessage(raw) {
  const text = String(raw || '').trim()
  if (!text) return { ok: false, error: 'Please type something — e.g. "food 12.50"' }
  const lower = text.toLowerCase()

  // --- date: explicit ISO > yesterday > today ---
  let date = todayKey()
  const iso = lower.match(/\b\d{4}-\d{2}-\d{2}\b/)
  if (iso) date = iso[0]
  else if (/\byesterday\b/.test(lower)) date = yesterdayKey()

  // Remove date words first so dates don't get mistaken for the amount
  const search = lower
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b(today|yesterday)\b/g, ' ')

  // --- amount: first number (allows $, €, £ and 1,200.50) ---
  const amountMatch = search.match(
    /(?:^|[^\w.,])[$€£]?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/
  )
  if (!amountMatch) {
    return { ok: false, error: '⚠️ I couldn\'t find an amount. Try "food 12.50"' }
  }
  const amount = Number(amountMatch[1].replace(/,/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: '⚠️ The amount must be greater than 0.' }
  }

  // --- category: main name wins, else first keyword match, else Other ---
  let category = null
  for (const c of CATEGORIES) {
    if (wordPresent(lower, c.toLowerCase())) {
      category = c
      break
    }
  }
  if (!category) {
    outer: for (const c of CATEGORIES) {
      for (const kw of CATEGORY_KEYWORDS[c]) {
        if (wordPresent(lower, kw)) {
          category = c
          break outer
        }
      }
    }
  }
  if (!category) category = 'Other'

  // --- note: leftover words after removing amount, filler and category names ---
  const leftover = search.replace(amountMatch[0], ' ')
  const words = leftover
    .split(/[^a-z0-9']+/)
    .filter((w) => w && !FILLER.has(w) && !PRIMARY.has(w))
  let note = words.join(' ').trim()
  if (note) note = note.charAt(0).toUpperCase() + note.slice(1)

  return { ok: true, transaction: { amount, date, category, note } }
}

function wordPresent(text, word) {
  return new RegExp(`\\b${word}\\b`).test(text)
}


export { wordPresent }
