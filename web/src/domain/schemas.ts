import { z } from 'zod'

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'BRL'] as const
export const LANGUAGES = ['auto', 'pt-BR', 'en'] as const
export const THEMES = ['auto', 'light', 'dark'] as const
export const INVOICE_TYPES = ['hours', 'expenses'] as const
export const INVOICE_STATUSES = ['draft', 'sent', 'confirmed', 'paid', 'cancelled'] as const
export const TIMESHEET_STATUSES = ['draft', 'submitted', 'approved'] as const
export const EXPENSE_KINDS = ['perdiem', 'meal', 'lodging', 'travel', 'mileage', 'other'] as const
export const LINE_UNITS = ['h', 'day', 'unit', 'km'] as const
export const ATTACHMENT_KINDS = ['invoice_pdf', 'payment_proof', 'confirmation', 'receipt', 'other'] as const
export const BACKUP_SCHEDULES = ['off', 'weekly', 'monthly'] as const
export const BACKUP_DEST_STATUSES = ['pending', 'verified'] as const
export const BACKUP_LOG_KINDS = ['email', 'export', 'restore'] as const
export const BACKUP_LOG_STATUSES = ['ok', 'error'] as const

const id = z.string().regex(/^[a-z0-9]{15}$/)
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(''))

export const technicianSnapshotSchema = z.object({
  name: z.string().max(120).default(''),
  company: z.string().max(160).default(''),
  email: z.string().max(200).default(''),
  address: z.string().max(300).default(''),
  vat: z.string().max(40).default(''),
  tel: z.string().max(40).default(''),
})

export const bankSnapshotSchema = z.object({
  ibanName: z.string().max(120).default(''),
  iban: z.string().max(40).default(''),
  swift: z.string().max(11).default(''),
})

export const clientSnapshotSchema = z.object({
  name: z.string().max(160).default(''),
  address: z.string().max(300).default(''),
  vat: z.string().max(40).default(''),
  email: z.string().max(200).default(''),
})

export const projectSnapshotSchema = z.object({
  name: z.string().max(160).default(''),
  role: z.string().max(120).default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  location: z.string().max(160).default(''),
})

export const profileSchema = z.object({
  id,
  owner: id,
  currency: z.enum(CURRENCIES).default('EUR'),
  default_hourly_rate_cents: z.number().int().min(0).default(0),
  default_perdiem_cents: z.number().int().min(0).default(0),
  invoice_number_pattern: z.string().max(40).default('{YYYY}-{SEQ}'),
  next_invoice_seq: z.number().int().min(1).max(999999).default(1),
  payment_reminder_days: z.number().int().min(0).max(365).default(30),
  week_starts_on: z.union([z.literal(0), z.literal(1)]).default(1),
  tech_name: z.string().max(120).default(''),
  tech_company: z.string().max(160).default(''),
  tech_email: z.string().max(200).default(''),
  tech_address: z.string().max(300).default(''),
  tech_vat: z.string().max(40).default(''),
  tech_tel: z.string().max(40).default(''),
  bank_iban_name: z.string().max(120).default(''),
  bank_iban: z.string().max(40).default(''),
  bank_swift: z.string().max(11).default(''),
  default_client: z.string().default(''),
  default_project: z.string().default(''),
  backup_schedule: z.enum(BACKUP_SCHEDULES).default('off'),
  backup_destinations: z.array(z.string()).default([]),
  backup_include_attachments: z.boolean().default(false),
  backup_last_at: z.string().default(''),
  backup_next_at: z.string().default(''),
  rev: z.number().int().min(1).default(1),
  deleted_at: z.string().default(''),
})

export const clientSchema = z.object({
  id,
  owner: id,
  name: z.string().min(1).max(160),
  address: z.string().max(300).default(''),
  vat: z.string().max(40).default(''),
  email: z.string().max(200).default(''),
  notes: z.string().max(1000).default(''),
  archived: z.boolean().default(false),
  rev: z.number().int().min(1).default(1),
  deleted_at: z.string().default(''),
})

export const projectSchema = z.object({
  id,
  owner: id,
  client: id,
  name: z.string().min(1).max(160),
  role: z.string().max(120).default(''),
  start_date: optionalDate.default(''),
  end_date: optionalDate.default(''),
  location: z.string().max(160).default(''),
  hourly_rate_cents: z.number().int().min(0).default(0),
  perdiem_cents: z.number().int().min(0).default(0),
  currency: z.enum(CURRENCIES).default('EUR'),
  archived: z.boolean().default(false),
  rev: z.number().int().min(1).default(1),
  deleted_at: z.string().default(''),
})

export const timesheetSchema = z.object({
  id,
  owner: id,
  project: id,
  week_start: dateStr,
  week_end: dateStr,
  status: z.enum(TIMESHEET_STATUSES).default('draft'),
  submitted_at: z.string().default(''),
  total_hours: z.number().min(0).default(0),
  notes: z.string().max(1000).default(''),
  rev: z.number().int().min(1).default(1),
  deleted_at: z.string().default(''),
})

export const timesheetEntrySchema = z.object({
  id,
  owner: id,
  timesheet: id,
  date: dateStr,
  hours: z.number().min(0).max(24).default(0),
  note: z.string().max(300).default(''),
  invoice: z.string().default(''),
  rev: z.number().int().min(1).default(1),
  deleted_at: z.string().default(''),
})

export const perdiemEntrySchema = z.object({
  id,
  owner: id,
  project: id,
  date: dateStr,
  kind: z.enum(EXPENSE_KINDS),
  description: z.string().max(300).default(''),
  quantity: z.number().min(0).default(1),
  rate_cents: z.number().int().min(0).default(0),
  amount_cents: z.number().int().default(0),
  invoice: z.string().default(''),
  rev: z.number().int().min(1).default(1),
  deleted_at: z.string().default(''),
})

export const invoiceSchema = z.object({
  id,
  owner: id,
  type: z.enum(INVOICE_TYPES),
  number: z.string().min(1).max(40),
  invoice_date: dateStr,
  period_start: dateStr,
  period_end: dateStr,
  currency: z.enum(CURRENCIES).default('EUR'),
  status: z.enum(INVOICE_STATUSES).default('draft'),
  client: z.string().default(''),
  project: z.string().default(''),
  technician: technicianSnapshotSchema.default({ name: '', company: '', email: '', address: '', vat: '', tel: '' }),
  bank: bankSnapshotSchema.default({ ibanName: '', iban: '', swift: '' }),
  client_snapshot: clientSnapshotSchema.default({ name: '', address: '', vat: '', email: '' }),
  project_snapshot: projectSnapshotSchema.default({ name: '', role: '', startDate: '', endDate: '', location: '' }),
  total_cents: z.number().int().default(0),
  sent_at: z.string().default(''),
  confirmed_at: z.string().default(''),
  paid_at: z.string().default(''),
  received_cents: z.number().int().default(0),
  difference_cents: z.number().int().default(0),
  payment_note: z.string().max(1000).default(''),
  notes: z.string().max(2000).default(''),
  rev: z.number().int().min(1).default(1),
  deleted_at: z.string().default(''),
})

export const invoiceItemSchema = z.object({
  id,
  owner: id,
  invoice: id,
  position: z.number().int().min(0).default(0),
  description: z.string().min(1).max(300),
  quantity: z.number().min(0).max(100000).default(0),
  unit: z.enum(LINE_UNITS).default('h'),
  rate_cents: z.number().int().min(0).default(0),
  amount_cents: z.number().int().default(0),
  date_from: z.string().default(''),
  date_to: z.string().default(''),
  rev: z.number().int().min(1).default(1),
  deleted_at: z.string().default(''),
})

export const invoiceEventSchema = z.object({
  id,
  owner: id,
  invoice: id,
  from_status: z.enum(INVOICE_STATUSES),
  to_status: z.enum(INVOICE_STATUSES),
  at: dateStr,
  note: z.string().max(500).default(''),
})

export const attachmentSchema = z.object({
  id,
  owner: id,
  invoice: id,
  kind: z.enum(ATTACHMENT_KINDS),
  file_name: z.string().max(200).default(''),
  size_bytes: z.number().int().min(0).default(0),
  sha256: z.string().length(64).default(''),
  rev: z.number().int().min(1).default(1),
  deleted_at: z.string().default(''),
})

export const backupDestinationSchema = z.object({
  id,
  owner: id,
  email: z.string().email(),
  status: z.enum(BACKUP_DEST_STATUSES).default('pending'),
  verified_at: z.string().default(''),
  last_sent_at: z.string().default(''),
})

export const backupLogSchema = z.object({
  id,
  owner: id,
  kind: z.enum(BACKUP_LOG_KINDS),
  destinations: z.array(z.string()).default([]),
  size_bytes: z.number().int().min(0).default(0),
  status: z.enum(BACKUP_LOG_STATUSES),
  error: z.string().max(500).default(''),
})

export type Profile = z.infer<typeof profileSchema>
export type Client = z.infer<typeof clientSchema>
export type Project = z.infer<typeof projectSchema>
export type Timesheet = z.infer<typeof timesheetSchema>
export type TimesheetEntry = z.infer<typeof timesheetEntrySchema>
export type PerdiemEntry = z.infer<typeof perdiemEntrySchema>
export type Invoice = z.infer<typeof invoiceSchema>
export type InvoiceItem = z.infer<typeof invoiceItemSchema>
export type InvoiceEvent = z.infer<typeof invoiceEventSchema>
export type Attachment = z.infer<typeof attachmentSchema>
export type BackupDestination = z.infer<typeof backupDestinationSchema>
export type BackupLog = z.infer<typeof backupLogSchema>
export type TechnicianSnapshot = z.infer<typeof technicianSnapshotSchema>
export type BankSnapshot = z.infer<typeof bankSnapshotSchema>
export type ClientSnapshot = z.infer<typeof clientSnapshotSchema>
export type ProjectSnapshot = z.infer<typeof projectSnapshotSchema>
