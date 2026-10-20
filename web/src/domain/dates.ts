// All calendar dates as YYYY-MM-DD strings (§4.9), instants as UTC ISO 8601

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setUTCDate(d.getUTCDate() + n)
  return toDateStr(d)
}

export function daysBetween(start: string, end: string): number {
  const s = parseDate(start).getTime()
  const e = parseDate(end).getTime()
  return Math.round((e - s) / 86400000)
}

export function daysInRange(start: string, end: string): string[] {
  const days: string[] = []
  let cur = start
  while (cur <= end) {
    days.push(cur)
    cur = addDays(cur, 1)
  }
  return days
}

export function weekStart(date: string, weekStartsOn: 0 | 1): string {
  const d = parseDate(date)
  const dow = d.getUTCDay()
  const diff = (dow - weekStartsOn + 7) % 7
  d.setUTCDate(d.getUTCDate() - diff)
  return toDateStr(d)
}

export function weekEnd(ws: string): string {
  return addDays(ws, 6)
}

export function weekRangesInPeriod(
  periodStart: string,
  periodEnd: string,
  weekStartsOn: 0 | 1,
): Array<{ weekStart: string; weekEnd: string; clippedStart: string; clippedEnd: string }> {
  const ranges: Array<{ weekStart: string; weekEnd: string; clippedStart: string; clippedEnd: string }> = []
  let ws = weekStart(periodStart, weekStartsOn)
  while (ws <= periodEnd) {
    const we = weekEnd(ws)
    const clippedStart = ws < periodStart ? periodStart : ws
    const clippedEnd = we > periodEnd ? periodEnd : we
    if (clippedStart <= clippedEnd) {
      ranges.push({ weekStart: ws, weekEnd: we, clippedStart, clippedEnd })
    }
    ws = addDays(ws, 7)
  }
  return ranges
}

const MONTHS_PT: Record<number, string> = {
  0: 'jan', 1: 'fev', 2: 'mar', 3: 'abr', 4: 'mai', 5: 'jun',
  6: 'jul', 7: 'ago', 8: 'set', 9: 'out', 10: 'nov', 11: 'dez',
}
const MONTHS_EN: Record<number, string> = {
  0: 'Jan', 1: 'Feb', 2: 'Mar', 3: 'Apr', 4: 'May', 5: 'Jun',
  6: 'Jul', 7: 'Aug', 8: 'Sep', 9: 'Oct', 10: 'Nov', 11: 'Dec',
}
const MONTHS_FULL_PT: Record<number, string> = {
  0: 'Janeiro', 1: 'Fevereiro', 2: 'Março', 3: 'Abril', 4: 'Maio', 5: 'Junho',
  6: 'Julho', 7: 'Agosto', 8: 'Setembro', 9: 'Outubro', 10: 'Novembro', 11: 'Dezembro',
}
const MONTHS_FULL_EN: Record<number, string> = {
  0: 'January', 1: 'February', 2: 'March', 3: 'April', 4: 'May', 5: 'June',
  6: 'July', 7: 'August', 8: 'September', 9: 'October', 10: 'November', 11: 'December',
}

function monthAbbr(m: number, locale: string): string {
  return locale.startsWith('pt') ? MONTHS_PT[m]! : MONTHS_EN[m]!
}

function monthFull(m: number, locale: string): string {
  return locale.startsWith('pt') ? MONTHS_FULL_PT[m]! : MONTHS_FULL_EN[m]!
}

export function formatPeriod(start: string, end: string, locale: string): string {
  const s = parseDate(start)
  const e = parseDate(end)
  const sd = s.getUTCDate(), sm = s.getUTCMonth(), sy = s.getUTCFullYear()
  const ed = e.getUTCDate(), em = e.getUTCMonth(), ey = e.getUTCFullYear()

  if (start === end) {
    return `${sd} ${monthAbbr(sm, locale)} ${sy}`
  }
  if (sm === em && sy === ey) {
    return `${sd}–${ed} ${monthAbbr(sm, locale)} ${sy}`
  }
  if (sy === ey) {
    return `${sd} ${monthAbbr(sm, locale)} – ${ed} ${monthAbbr(em, locale)} ${sy}`
  }
  return `${sd} ${monthAbbr(sm, locale)} ${sy} – ${ed} ${monthAbbr(em, locale)} ${ey}`
}

export function periodTitle(start: string, end: string, locale: string): string {
  const s = parseDate(start)
  const e = parseDate(end)
  const sm = s.getUTCMonth(), sy = s.getUTCFullYear()
  const em = e.getUTCMonth(), ey = e.getUTCFullYear()

  if (sm === em && sy === ey) {
    return `${monthFull(sm, locale)} ${sy}`
  }
  return `${monthAbbr(sm, locale)} – ${monthAbbr(em, locale)} ${ey}`
}

export function overlapDays(rangeStart: string, rangeEnd: string, periodStart: string, periodEnd: string): number {
  const start = rangeStart > periodStart ? rangeStart : periodStart
  const end = rangeEnd < periodEnd ? rangeEnd : periodEnd
  if (start > end) return 0
  return daysBetween(start, end) + 1
}

export function isoWeekNumber(date: string): number {
  const d = parseDate(date)
  const dayOfYear = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1
  const dow = d.getUTCDay() || 7
  const wn = Math.floor((dayOfYear - dow + 10) / 7)
  return wn
}
