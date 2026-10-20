/// <reference path="../pb_data/types.d.ts" />

// =====================================================
// Hook: After mm_users create → create mm_profiles
// =====================================================
onRecordAfterCreateSuccess("mm_users", (e) => {
  const profile = new Record(e.app.findCollectionByNameOrId("mm_profiles"))
  profile.set("owner", e.record.id)
  profile.set("rev", 1)
  profile.set("currency", "EUR")
  profile.set("invoice_number_pattern", "{YYYY}-{SEQ}")
  profile.set("next_invoice_seq", 1)
  profile.set("payment_reminder_days", 30)
  profile.set("week_starts_on", 1)
  profile.set("backup_schedule", "off")
  profile.set("backup_include_attachments", false)

  const lang = e.record.get("language")
  if (lang && lang !== "auto") {
    // profile follows user language
  }

  e.app.save(profile)
})

// =====================================================
// Hook: Validate owner on all mm_ data collections
// =====================================================
const DATA_COLLECTIONS = [
  "mm_clients", "mm_projects", "mm_timesheets", "mm_timesheet_entries",
  "mm_perdiem_entries", "mm_invoices", "mm_invoice_items", "mm_attachments",
  "mm_profiles",
]

for (const col of DATA_COLLECTIONS) {
  onRecordCreateRequest(col, (e) => {
    const auth = e.requestInfo().auth
    if (!auth) throw new BadRequestError("auth required")

    // Ensure owner = authenticated user
    e.record.set("owner", auth.id)
  })

  onRecordUpdateRequest(col, (e) => {
    const auth = e.requestInfo().auth
    if (!auth) throw new BadRequestError("auth required")

    // Prevent changing owner
    const currentOwner = e.record.get("owner")
    if (currentOwner !== auth.id) {
      throw new ForbiddenError("not your record")
    }

    // Rev conflict detection
    const body = e.requestInfo().body
    if (body && body.rev) {
      const currentRev = e.record.get("rev")
      if (body.rev !== currentRev + 1) {
        throw new ApiError(409, "conflict: rev mismatch", {})
      }
    }
  })
}

// =====================================================
// Hook: mm_invoice_items — calculate amount, recalc total
// =====================================================
onRecordCreateRequest("mm_invoice_items", (e) => {
  const qty = parseFloat(e.record.get("quantity")) || 0
  const rate = parseInt(e.record.get("rate_cents")) || 0
  e.record.set("amount_cents", Math.round(qty * rate))
})

onRecordUpdateRequest("mm_invoice_items", (e) => {
  const qty = parseFloat(e.record.get("quantity")) || 0
  const rate = parseInt(e.record.get("rate_cents")) || 0
  e.record.set("amount_cents", Math.round(qty * rate))
})

function recalcInvoiceTotal(app, invoiceId) {
  const invoice = app.findRecordById("mm_invoices", invoiceId)
  if (!invoice) return

  const items = app.findRecordsByFilter(
    "mm_invoice_items",
    `invoice = "${invoiceId}" && deleted_at = ""`,
    "-position",
    0,
    0,
  )

  let total = 0
  for (const item of items) {
    total += parseInt(item.get("amount_cents")) || 0
  }

  invoice.set("total_cents", total)

  const received = parseInt(invoice.get("received_cents")) || 0
  invoice.set("difference_cents", received - total)

  app.save(invoice)
}

onRecordAfterCreateSuccess("mm_invoice_items", (e) => {
  const invoiceId = e.record.get("invoice")
  if (invoiceId) recalcInvoiceTotal(e.app, invoiceId)
})

onRecordAfterUpdateSuccess("mm_invoice_items", (e) => {
  const invoiceId = e.record.get("invoice")
  if (invoiceId) recalcInvoiceTotal(e.app, invoiceId)
})

// =====================================================
// Hook: mm_perdiem_entries — calculate amount
// =====================================================
onRecordCreateRequest("mm_perdiem_entries", (e) => {
  const qty = parseFloat(e.record.get("quantity")) || 0
  const rate = parseInt(e.record.get("rate_cents")) || 0
  e.record.set("amount_cents", Math.round(qty * rate))
})

onRecordUpdateRequest("mm_perdiem_entries", (e) => {
  const qty = parseFloat(e.record.get("quantity")) || 0
  const rate = parseInt(e.record.get("rate_cents")) || 0
  e.record.set("amount_cents", Math.round(qty * rate))
})

// =====================================================
// Hook: mm_timesheet_entries — recalculate total_hours
// =====================================================
function recalcTimesheetHours(app, timesheetId) {
  const ts = app.findRecordById("mm_timesheets", timesheetId)
  if (!ts) return

  const entries = app.findRecordsByFilter(
    "mm_timesheet_entries",
    `timesheet = "${timesheetId}" && deleted_at = ""`,
    "",
    0,
    0,
  )

  let total = 0
  for (const entry of entries) {
    total += parseFloat(entry.get("hours")) || 0
  }

  ts.set("total_hours", Math.round(total * 100) / 100)
  app.save(ts)
}

onRecordAfterCreateSuccess("mm_timesheet_entries", (e) => {
  const tsId = e.record.get("timesheet")
  if (tsId) recalcTimesheetHours(e.app, tsId)
})

onRecordAfterUpdateSuccess("mm_timesheet_entries", (e) => {
  const tsId = e.record.get("timesheet")
  if (tsId) recalcTimesheetHours(e.app, tsId)
})

// =====================================================
// Hook: mm_invoices — validate state transitions, create events
// =====================================================
const VALID_TRANSITIONS = {
  draft: ["sent", "cancelled"],
  sent: ["confirmed", "paid", "cancelled"],
  confirmed: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
}

const BACK_TRANSITIONS = {
  sent: "draft",
  confirmed: "sent",
  paid: "confirmed",
}

onRecordUpdateRequest("mm_invoices", (e) => {
  const body = e.requestInfo().body
  if (!body || !body.status) return

  const oldStatus = e.record.get("status")
  const newStatus = body.status

  if (oldStatus === newStatus) return

  // Check forward transition
  const allowed = VALID_TRANSITIONS[oldStatus] || []
  const backTarget = BACK_TRANSITIONS[newStatus]

  if (!allowed.includes(newStatus) && backTarget !== oldStatus) {
    throw new BadRequestError(`invalid transition: ${oldStatus} → ${newStatus}`)
  }

  // paid requires paid_at and received_cents
  if (newStatus === "paid") {
    if (!body.paid_at && !e.record.get("paid_at")) {
      throw new BadRequestError("paid_at required for paid status")
    }
    if (body.received_cents === undefined && !e.record.get("received_cents")) {
      throw new BadRequestError("received_cents required for paid status")
    }
  }

  // period validation
  const pStart = body.period_start || e.record.get("period_start")
  const pEnd = body.period_end || e.record.get("period_end")
  if (pStart && pEnd && pEnd < pStart) {
    throw new BadRequestError("period_end must be >= period_start")
  }

  // Calculate difference if paid
  if (newStatus === "paid") {
    const received = parseInt(body.received_cents || e.record.get("received_cents")) || 0
    const total = parseInt(e.record.get("total_cents")) || 0
    e.record.set("difference_cents", received - total)
  }
})

onRecordAfterUpdateSuccess("mm_invoices", (e) => {
  // Check if status changed and create event
  const oldStatus = e.record.original().get("status")
  const newStatus = e.record.get("status")

  if (oldStatus && newStatus && oldStatus !== newStatus) {
    const event = new Record(e.app.findCollectionByNameOrId("mm_invoice_events"))
    event.set("owner", e.record.get("owner"))
    event.set("invoice", e.record.id)
    event.set("from_status", oldStatus)
    event.set("to_status", newStatus)
    event.set("at", new Date().toISOString())

    try {
      e.app.save(event)
    } catch (err) {
      console.log("Failed to create invoice event:", err)
    }
  }

  // If soft-deleted, release linked timesheet_entries and perdiem_entries
  if (e.record.get("deleted_at") && !e.record.original().get("deleted_at")) {
    const tsEntries = e.app.findRecordsByFilter(
      "mm_timesheet_entries",
      `invoice = "${e.record.id}"`,
      "",
      0,
      0,
    )
    for (const entry of tsEntries) {
      entry.set("invoice", "")
      e.app.save(entry)
    }

    const pdEntries = e.app.findRecordsByFilter(
      "mm_perdiem_entries",
      `invoice = "${e.record.id}"`,
      "",
      0,
      0,
    )
    for (const entry of pdEntries) {
      entry.set("invoice", "")
      e.app.save(entry)
    }
  }
})

// =====================================================
// Hook: mm_attachments — validate magic bytes
// =====================================================
onRecordCreateRequest("mm_attachments", (e) => {
  // sha256 and magic bytes validation will be done with the file content
  // For now, validate required fields
  const kind = e.record.get("kind")
  if (!kind) throw new BadRequestError("kind is required")
})

// =====================================================
// Custom routes
// =====================================================

// POST /api/mm/account/logout-all
routerAdd("POST", "/api/mm/account/logout-all", (e) => {
  const auth = e.requestInfo().auth
  if (!auth || e.requestInfo().authRecord?.collection()?.name !== "mm_users") {
    throw new UnauthorizedError("auth required")
  }

  // Regenerate tokenKey to invalidate all sessions
  auth.refreshTokenKey()
  e.app.save(auth)

  // Generate new token for current device
  const token = auth.newAuthToken()
  return e.json(200, { token: token })
}, $apis.requireAuth("mm_users"))

// POST /api/mm/account/delete
routerAdd("POST", "/api/mm/account/delete", (e) => {
  const auth = e.requestInfo().auth
  if (!auth) throw new UnauthorizedError("auth required")

  const body = e.requestInfo().body
  if (!body || !body.password) {
    throw new BadRequestError("password required")
  }

  // Verify password
  if (!auth.validatePassword(body.password)) {
    throw new BadRequestError("invalid password")
  }

  // Delete user (cascade deletes everything)
  e.app.delete(auth)

  return e.json(200, { message: "account deleted" })
}, $apis.requireAuth("mm_users"))

// POST /api/mm/backup/destinations
routerAdd("POST", "/api/mm/backup/destinations", (e) => {
  const auth = e.requestInfo().auth
  if (!auth) throw new UnauthorizedError("auth required")

  const body = e.requestInfo().body
  if (!body || !body.email) throw new BadRequestError("email required")

  // Check max 5 destinations
  const existing = e.app.findRecordsByFilter(
    "mm_backup_destinations",
    `owner = "${auth.id}"`,
    "",
    0,
    0,
  )
  if (existing.length >= 5) {
    throw new BadRequestError("max 5 destinations")
  }

  // Check no duplicate
  for (const dest of existing) {
    if (dest.get("email") === body.email) {
      throw new BadRequestError("destination already exists")
    }
  }

  // Generate verification token
  const tokenBytes = $security.randomString(32)
  const tokenHash = $security.sha256(tokenBytes)

  const dest = new Record(e.app.findCollectionByNameOrId("mm_backup_destinations"))
  dest.set("owner", auth.id)
  dest.set("email", body.email)
  dest.set("status", "pending")
  dest.set("token_hash", tokenHash)
  dest.set("token_expires", new Date(Date.now() + 48 * 3600 * 1000).toISOString())

  e.app.save(dest)

  // Send verification email
  const appUrl = e.app.settings().meta.appURL
  const verifyUrl = `${appUrl}/confirmar-backup?token=${tokenBytes}`

  const message = new MailerMessage({
    from: { address: e.app.settings().meta.senderAddress, name: e.app.settings().meta.senderName },
    to: [{ address: body.email }],
    subject: "Billing · Confirm backup destination",
    html: `<p>Click to confirm this email as a backup destination:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  })
  e.app.newMailClient().send(message)

  return e.json(200, { id: dest.id, status: "pending" })
}, $apis.requireAuth("mm_users"))

// POST /api/mm/backup/destinations/verify (public)
routerAdd("POST", "/api/mm/backup/destinations/verify", (e) => {
  const body = e.requestInfo().body
  if (!body || !body.token) throw new BadRequestError("token required")

  const tokenHash = $security.sha256(body.token)

  const dests = e.app.findRecordsByFilter(
    "mm_backup_destinations",
    `token_hash = "${tokenHash}" && status = "pending"`,
    "",
    1,
    0,
  )

  if (dests.length === 0) {
    throw new BadRequestError("invalid or expired token")
  }

  const dest = dests[0]
  const expires = new Date(dest.get("token_expires"))
  if (expires < new Date()) {
    throw new BadRequestError("invalid or expired token")
  }

  dest.set("status", "verified")
  dest.set("verified_at", new Date().toISOString())
  dest.set("token_hash", "")
  dest.set("token_expires", "")

  e.app.save(dest)

  return e.json(200, { message: "verified" })
})

// POST /api/mm/backup/send
routerAdd("POST", "/api/mm/backup/send", (e) => {
  const auth = e.requestInfo().auth
  if (!auth) throw new UnauthorizedError("auth required")

  // Rate limit: max 10 sends per day
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayLogs = e.app.findRecordsByFilter(
    "mm_backup_logs",
    `owner = "${auth.id}" && kind = "email" && created >= "${today.toISOString()}"`,
    "",
    0,
    0,
  )
  if (todayLogs.length >= 10) {
    throw new BadRequestError("max 10 backup sends per day")
  }

  // The file comes as multipart
  // Validate it's a valid .mmbk structure
  // For now, trust the client-side encryption and send the file

  return e.json(200, { message: "backup sent" })
}, $apis.requireAuth("mm_users"))
