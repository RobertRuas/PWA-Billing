import { describe, it, expect } from 'vitest'
import {
  parseDate, toDateStr, addDays, daysBetween, daysInRange,
  weekStart, weekEnd, weekRangesInPeriod,
  formatPeriod, periodTitle, overlapDays, isoWeekNumber,
} from '../dates'

describe('parseDate / toDateStr', () => {
  it('round-trips a date string', () => {
    expect(toDateStr(parseDate('2026-03-15'))).toBe('2026-03-15')
  })
})

describe('addDays', () => {
  it('adds days within a month', () => {
    expect(addDays('2026-10-01', 5)).toBe('2026-10-06')
  })

  it('crosses month boundary', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
  })

  it('crosses year boundary', () => {
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04')
  })

  it('subtracts days', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('daysBetween', () => {
  it('calculates days between two dates', () => {
    expect(daysBetween('2026-10-01', '2026-10-10')).toBe(9)
  })

  it('returns 0 for same day', () => {
    expect(daysBetween('2026-10-01', '2026-10-01')).toBe(0)
  })

  it('returns negative when reversed', () => {
    expect(daysBetween('2026-10-10', '2026-10-01')).toBe(-9)
  })
})

describe('daysInRange', () => {
  it('returns all days inclusive', () => {
    const days = daysInRange('2026-10-01', '2026-10-03')
    expect(days).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
  })

  it('returns single day when start equals end', () => {
    expect(daysInRange('2026-10-01', '2026-10-01')).toEqual(['2026-10-01'])
  })
})

describe('weekStart', () => {
  it('Monday start: Wednesday returns previous Monday', () => {
    // 2026-10-14 is a Wednesday
    expect(weekStart('2026-10-14', 1)).toBe('2026-10-12')
  })

  it('Monday start: Monday returns same day', () => {
    expect(weekStart('2026-10-12', 1)).toBe('2026-10-12')
  })

  it('Sunday start: Wednesday returns previous Sunday', () => {
    expect(weekStart('2026-10-14', 0)).toBe('2026-10-11')
  })

  it('Sunday start: Sunday returns same day', () => {
    expect(weekStart('2026-10-11', 0)).toBe('2026-10-11')
  })
})

describe('weekEnd', () => {
  it('returns 6 days after week start', () => {
    expect(weekEnd('2026-10-12')).toBe('2026-10-18')
  })
})

describe('weekRangesInPeriod', () => {
  it('clips weeks to the period boundaries', () => {
    const ranges = weekRangesInPeriod('2026-09-28', '2026-10-25', 1)
    expect(ranges.length).toBeGreaterThan(0)
    expect(ranges[0]!.clippedStart).toBe('2026-09-28')
    expect(ranges[ranges.length - 1]!.clippedEnd).toBe('2026-10-25')
  })

  it('single-day period returns one range', () => {
    const ranges = weekRangesInPeriod('2026-10-14', '2026-10-14', 1)
    expect(ranges).toHaveLength(1)
    expect(ranges[0]!.clippedStart).toBe('2026-10-14')
    expect(ranges[0]!.clippedEnd).toBe('2026-10-14')
  })
})

describe('formatPeriod', () => {
  it('same day (pt-BR)', () => {
    expect(formatPeriod('2026-10-15', '2026-10-15', 'pt-BR')).toBe('15 out 2026')
  })

  it('same day (en)', () => {
    expect(formatPeriod('2026-10-15', '2026-10-15', 'en')).toBe('15 Oct 2026')
  })

  it('same month (pt-BR)', () => {
    expect(formatPeriod('2026-10-01', '2026-10-31', 'pt-BR')).toBe('1–31 out 2026')
  })

  it('same month (en)', () => {
    expect(formatPeriod('2026-10-01', '2026-10-31', 'en')).toBe('1–31 Oct 2026')
  })

  it('different months same year (pt-BR)', () => {
    expect(formatPeriod('2026-09-28', '2026-10-25', 'pt-BR')).toBe('28 set – 25 out 2026')
  })

  it('different months same year (en)', () => {
    expect(formatPeriod('2026-09-28', '2026-10-25', 'en')).toBe('28 Sep – 25 Oct 2026')
  })

  it('different years (pt-BR)', () => {
    expect(formatPeriod('2025-12-01', '2026-01-15', 'pt-BR')).toBe('1 dez 2025 – 15 jan 2026')
  })

  it('different years (en)', () => {
    expect(formatPeriod('2025-12-01', '2026-01-15', 'en')).toBe('1 Dec 2025 – 15 Jan 2026')
  })
})

describe('periodTitle', () => {
  it('single month returns full month name', () => {
    expect(periodTitle('2026-10-01', '2026-10-31', 'pt-BR')).toBe('Outubro 2026')
    expect(periodTitle('2026-10-01', '2026-10-31', 'en')).toBe('October 2026')
  })

  it('spanning months returns abbreviated range', () => {
    expect(periodTitle('2026-09-01', '2026-10-31', 'pt-BR')).toBe('set – out 2026')
    expect(periodTitle('2026-09-01', '2026-10-31', 'en')).toBe('Sep – Oct 2026')
  })
})

describe('overlapDays', () => {
  it('full overlap', () => {
    expect(overlapDays('2026-10-05', '2026-10-10', '2026-10-01', '2026-10-31')).toBe(6)
  })

  it('partial overlap at start', () => {
    expect(overlapDays('2026-09-28', '2026-10-03', '2026-10-01', '2026-10-31')).toBe(3)
  })

  it('partial overlap at end', () => {
    expect(overlapDays('2026-10-29', '2026-11-05', '2026-10-01', '2026-10-31')).toBe(3)
  })

  it('no overlap', () => {
    expect(overlapDays('2026-11-01', '2026-11-05', '2026-10-01', '2026-10-31')).toBe(0)
  })
})

describe('isoWeekNumber', () => {
  it('first week of 2026', () => {
    // 2026-01-05 is Monday of ISO week 2
    expect(isoWeekNumber('2026-01-01')).toBe(1)
  })

  it('known week number', () => {
    // 2026-10-12 is Monday, ISO week 42
    expect(isoWeekNumber('2026-10-12')).toBe(42)
  })
})
