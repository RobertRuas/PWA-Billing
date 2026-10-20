export type InvoiceStatus = 'draft' | 'sent' | 'confirmed' | 'paid' | 'cancelled'

const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['confirmed', 'paid', 'cancelled'],
  confirmed: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
}

const BACK_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus | null> = {
  draft: null,
  sent: 'draft',
  confirmed: 'sent',
  paid: 'confirmed',
  cancelled: null,
}

export function canAdvance(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function canRevert(status: InvoiceStatus): boolean {
  return BACK_TRANSITIONS[status] !== null
}

export function revertTarget(status: InvoiceStatus): InvoiceStatus | null {
  return BACK_TRANSITIONS[status]
}

export function nextSteps(status: InvoiceStatus): InvoiceStatus[] {
  return TRANSITIONS[status]
}

export function isEditable(status: InvoiceStatus): boolean {
  return status !== 'paid' && status !== 'cancelled'
}

export function isPending(status: InvoiceStatus): boolean {
  return status === 'sent' || status === 'confirmed'
}
