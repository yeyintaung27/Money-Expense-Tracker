import { CATEGORIES, CATEGORY_KEYWORDS } from './categories.js'
import { wordPresent } from './parseMessage.js'

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sept: 9, sep: 9, oct: 10, nov: 11, dec: 12,
}

// Full month names listed before abbreviations so "march" matches before "mar"
const MONTH_RE =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b/i
const YEAR_RE = /\b(20\d{2})\b/
const NUMBER_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g

const pad = (n) => String(n).padStart(2, '0')
const round2 = (n) => Math.round(n * 100) / 100

// A line is a header if it has a month name AND (a year or the word "cost")
function headerInfo(line) {
  const m = line.toLowerCase().match(MONTH_RE)
  if (!m) return null
  if (!YEAR_RE.test(line) && !/\bcost\b/i.test(line)) return null
  const year = line.match(YEAR_RE)?.[1]
  return { monthNum: MONTHS[m[1].toLowerCase()], year: year ? Number(year) : null }
}

function findCategory(lower) {
  for (const c of CATEGORIES) {
    if (wordPresent(lower, c.toLowerCase())) return c
  }
  for (const c of CATEGORIES) {
    for (const kw of CATEGORY_KEYWORDS[c]) {
      if (wordPresent(lower, kw)) return c
    }
  }
  return 'Other'
}

/**
 * Parses a pasted monthly list:
 *
 *   September cost 2026
 *   Market- 60-10-5-20-50     -> Food, $145.00, Sep 1, note "Market"
 *   Coconut - 35              -> Food, $35.00, Sep 1, note "Coconut"
 *   5 Egg 137                 -> Food, $137.00, Sep 5 (day prefix), note "Egg"
 *
 * Returns { ok: true, month, monthLabel, entries, total, warnings }
 * or      { ok: false, error }
 */
export function parseBatchMessage(raw) {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return { ok: false, error: 'Empty message.' }

  const warnings = []
  const yearNow = new Date().getFullYear()

  // --- header line(s): first one wins ---
  let month = null
  let year = null
  const headerIndexes = new Set()
  lines.forEach((line, i) => {
    const h = headerInfo(line)
    if (!h || h.monthNum == null) return
    headerIndexes.add(i)
    if (month === null) {
      month = h.monthNum
      year = h.year ?? yearNow
    } else {
      warnings.push(`Ignored a second month header: "${line}"`)
    }
  })
  if (month === null) {
    month = new Date().getMonth() + 1
    year = yearNow
    warnings.push(`No month header found — using ${new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}`)
  }

  const monthKey = `${year}-${pad(month)}`
  const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const daysInMonth = new Date(year, month, 0).getDate()

  // --- every non-header line = one entry (multiple numbers summed) ---
  const entries = []
  lines.forEach((line, i) => {
    if (headerIndexes.has(i)) return

    // optional day prefix: "5 Egg 137"
    let rest = line
    let day = 1
    const dayMatch = line.match(/^(\d{1,2})\s+([A-Za-z].*)$/)
    if (dayMatch) {
      const d = Number(dayMatch[1])
      if (d >= 1 && d <= daysInMonth) {
        day = d
        rest = dayMatch[2]
      } else {
        warnings.push(`Line ${i + 1}: day ${d} doesn't exist in ${monthLabel} — using the 1st: "${line}"`)
      }
    }

    // all amounts on the line (summed)
    const nums = [...rest.matchAll(NUMBER_RE)].map((m) => Number(m[0].replace(/,/g, '')))
    if (nums.length === 0) {
      warnings.push(`No amount found: "${line}"`)
      return
    }
    const amount = round2(nums.reduce((s, n) => s + n, 0))
    if (!(amount > 0)) {
      warnings.push(`Amount is zero: "${line}"`)
      return
    }

    // item name = text before the first number
    const firstNumIndex = rest.search(NUMBER_RE)
    const name = rest
      .slice(0, firstNumIndex)
      .replace(/[-–—:.,\s]+$/, '')
      .trim()
    if (!name) {
      warnings.push(`No item name found: "${line}"`)
      return
    }

    const category = findCategory(name.toLowerCase())
    const note = name.charAt(0).toUpperCase() + name.slice(1)
    entries.push({ amount, date: `${year}-${pad(month)}-${pad(day)}`, category, note })
  })

  if (entries.length === 0) {
    return {
      ok: false,
      error: '⚠️ I couldn\'t find any entries with amounts. Each line should look like "Egg - 137".',
    }
  }

  const total = round2(entries.reduce((s, e) => s + e.amount, 0))
  return { ok: true, month: monthKey, monthLabel, entries, total, warnings }
}
