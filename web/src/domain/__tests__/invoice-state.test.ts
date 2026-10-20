import { describe, it, expect } from 'vitest'
import { canAdvance, canRevert, revertTarget, nextSteps, isEditable, isPending } from '../invoice-state'
import type { InvoiceStatus } from '../invoice-state'

describe('canAdvance', () => {
  const validTransitions: [InvoiceStatus, InvoiceStatus][] = [
    ['draft', 'sent'],
    ['draft', 'cancelled'],
    ['sent', 'confirmed'],
    ['sent', 'paid'],
    ['sent', 'cancelled'],
    ['confirmed', 'paid'],
    ['confirmed', 'cancelled'],
  ]

  for (const [from, to] of validTransitions) {
    it(`allows ${from} → ${to}`, () => {
      expect(canAdvance(from, to)).toBe(true)
    })
  }

  const invalidTransitions: [InvoiceStatus, InvoiceStatus][] = [
    ['draft', 'confirmed'],
    ['draft', 'paid'],
    ['sent', 'draft'],
    ['confirmed', 'draft'],
    ['confirmed', 'sent'],
    ['paid', 'draft'],
    ['paid', 'sent'],
    ['paid', 'confirmed'],
    ['paid', 'cancelled'],
    ['cancelled', 'draft'],
    ['cancelled', 'sent'],
    ['cancelled', 'confirmed'],
    ['cancelled', 'paid'],
  ]

  for (const [from, to] of invalidTransitions) {
    it(`rejects ${from} → ${to}`, () => {
      expect(canAdvance(from, to)).toBe(false)
    })
  }
})

describe('canRevert', () => {
  it('cannot revert draft', () => {
    expect(canRevert('draft')).toBe(false)
  })

  it('can revert sent to draft', () => {
    expect(canRevert('sent')).toBe(true)
    expect(revertTarget('sent')).toBe('draft')
  })

  it('can revert confirmed to sent', () => {
    expect(canRevert('confirmed')).toBe(true)
    expect(revertTarget('confirmed')).toBe('sent')
  })

  it('can revert paid to confirmed', () => {
    expect(canRevert('paid')).toBe(true)
    expect(revertTarget('paid')).toBe('confirmed')
  })

  it('cannot revert cancelled', () => {
    expect(canRevert('cancelled')).toBe(false)
    expect(revertTarget('cancelled')).toBeNull()
  })
})

describe('nextSteps', () => {
  it('draft can go to sent or cancelled', () => {
    expect(nextSteps('draft')).toEqual(['sent', 'cancelled'])
  })

  it('paid has no next steps', () => {
    expect(nextSteps('paid')).toEqual([])
  })

  it('cancelled has no next steps', () => {
    expect(nextSteps('cancelled')).toEqual([])
  })
})

describe('isEditable', () => {
  it('draft is editable', () => {
    expect(isEditable('draft')).toBe(true)
  })

  it('sent is editable', () => {
    expect(isEditable('sent')).toBe(true)
  })

  it('confirmed is editable', () => {
    expect(isEditable('confirmed')).toBe(true)
  })

  it('paid is not editable', () => {
    expect(isEditable('paid')).toBe(false)
  })

  it('cancelled is not editable', () => {
    expect(isEditable('cancelled')).toBe(false)
  })
})

describe('isPending', () => {
  it('sent is pending', () => {
    expect(isPending('sent')).toBe(true)
  })

  it('confirmed is pending', () => {
    expect(isPending('confirmed')).toBe(true)
  })

  it('draft is not pending', () => {
    expect(isPending('draft')).toBe(false)
  })

  it('paid is not pending', () => {
    expect(isPending('paid')).toBe(false)
  })

  it('cancelled is not pending', () => {
    expect(isPending('cancelled')).toBe(false)
  })
})
