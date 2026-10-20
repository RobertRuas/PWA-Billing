/// <reference path="../pb_data/types.d.ts" />

// PocketBase 0.25 JSVM hooks

// After mm_users create → create mm_profiles
onRecordAfterCreateSuccess((e) => {
  try {
    const col = e.app.findCollectionByNameOrId("mm_profiles")
    const profile = new Record(col)
    profile.set("owner", e.record.id)
    profile.set("rev", 1)
    profile.set("currency", "EUR")
    profile.set("invoice_number_pattern", "{YYYY}-{SEQ}")
    profile.set("next_invoice_seq", 1)
    profile.set("payment_reminder_days", 30)
    profile.set("week_starts_on", 1)
    profile.set("backup_schedule", "off")
    profile.set("backup_include_attachments", false)
    e.app.save(profile)
    console.log("Profile created for user: " + e.record.id)
  } catch (err) {
    console.log("HOOK ERROR creating profile: " + err)
  }
}, "mm_users")

// Validate owner on all mm_ data collections
const DATA_COLLECTIONS = [
  "mm_clients", "mm_projects", "mm_timesheets",
  "mm_timesheet_entries", "mm_perdiem_entries", "mm_attachments",
]

for (const col of DATA_COLLECTIONS) {
  onRecordCreate((e) => {
    const auth = e.requestInfo().auth
    if (auth) e.record.set("owner", auth.id)
    e.next()
  }, col)

  onRecordUpdate((e) => {
    const auth = e.requestInfo().auth
    if (auth) {
      const currentOwner = e.record.get("owner")
      if (currentOwner !== auth.id) {
        throw new ForbiddenError("not your record")
      }
    }
    const body = e.requestInfo().body
    if (body && body.rev) {
      const currentRev = e.record.get("rev")
      if (body.rev !== currentRev + 1) {
        throw new ApiError(409, "conflict: rev mismatch", {})
      }
    }
    e.next()
  }, col)
}

// mm_profiles: owner validation on API updates only
onRecordUpdate((e) => {
  const auth = e.requestInfo().auth
  if (auth) {
    const currentOwner = e.record.get("owner")
    if (currentOwner !== auth.id) {
      throw new ForbiddenError("not your record")
    }
  }
  e.next()
}, "mm_profiles")

// mm_invoice_items — calculate amount
onRecordCreate((e) => {
  const qty = parseFloat(e.record.get("quantity")) || 0
  const rate = parseInt(e.record.get("rate_cents")) || 0
  e.record.set("amount_cents", Math.round(qty * rate))
  e.next()

  // Recalc invoice total after save
  const invoiceId = e.record.get("invoice")
  if (invoiceId) recalcInvoiceTotal(e.app, invoiceId)
}, "mm_invoice_items")

onRecordUpdate((e) => {
  const qty = parseFloat(e.record.get("quantity")) || 0
  const rate = parseInt(e.record.get("rate_cents")) || 0
  e.record.set("amount_cents", Math.round(qty * rate))
  e.next()

  const invoiceId = e.record.get("invoice")
  if (invoiceId) recalcInvoiceTotal(e.app, invoiceId)
}, "mm_invoice_items")

function recalcInvoiceTotal(app, invoiceId) {
  const invoice = app.findRecordById("mm_invoices", invoiceId)
  if (!invoice) return

  const items = app.findRecordsByFilter(
    "mm_invoice_items",
    `invoice = "${invoiceId}" && deleted_at = ""`,
    "-position", 0, 0,
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

// mm_perdiem_entries — calculate amount
onRecordCreate((e) => {
  const qty = parseFloat(e.record.get("quantity")) || 0
  const rate = parseInt(e.record.get("rate_cents")) || 0
  e.record.set("amount_cents", Math.round(qty * rate))
  e.next()
}, "mm_perdiem_entries")

onRecordUpdate((e) => {
  const qty = parseFloat(e.record.get("quantity")) || 0
  const rate = parseInt(e.record.get("rate_cents")) || 0
  e.record.set("amount_cents", Math.round(qty * rate))
  e.next()
}, "mm_perdiem_entries")

// mm_timesheet_entries — recalculate total_hours
function recalcTimesheetHours(app, timesheetId) {
  const ts = app.findRecordById("mm_timesheets", timesheetId)
  if (!ts) return

  const entries = app.findRecordsByFilter(
    "mm_timesheet_entries",
    `timesheet = "${timesheetId}" && deleted_at = ""`,
    "", 0, 0,
  )

  let total = 0
  for (const entry of entries) {
    total += parseFloat(entry.get("hours")) || 0
  }

  ts.set("total_hours", Math.round(total * 100) / 100)
  app.save(ts)
}

onRecordCreate((e) => {
  e.next()
  const tsId = e.record.get("timesheet")
  if (tsId) recalcTimesheetHours(e.app, tsId)
}, "mm_timesheet_entries")

onRecordUpdate((e) => {
  e.next()
  const tsId = e.record.get("timesheet")
  if (tsId) recalcTimesheetHours(e.app, tsId)
}, "mm_timesheet_entries")

// mm_invoices — validate state transitions
const VALID_TRANSITIONS = {
  draft: ["sent", "cancelled"],
  sent: ["confirmed", "paid", "cancelled"],
  confirmed: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
}

onRecordUpdate((e) => {
  const body = e.requestInfo().body
  if (body && body.status) {
    const oldStatus = e.record.get("status")
    const newStatus = body.status

    if (oldStatus !== newStatus) {
      const allowed = VALID_TRANSITIONS[oldStatus] || []
      if (!allowed.includes(newStatus)) {
        throw new BadRequestError(`invalid transition: ${oldStatus} → ${newStatus}`)
      }

      if (newStatus === "paid") {
        if (!body.paid_at && !e.record.get("paid_at")) {
          throw new BadRequestError("paid_at required for paid status")
        }
        if (body.received_cents === undefined && !e.record.get("received_cents")) {
          throw new BadRequestError("received_cents required for paid status")
        }
        const received = parseInt(body.received_cents || e.record.get("received_cents")) || 0
        const total = parseInt(e.record.get("total_cents")) || 0
        e.record.set("difference_cents", received - total)
      }
    }
  }

  e.next()

  // After update: create invoice event if status changed
  if (e.record.original()) {
    const oldStatus = e.record.original().get("status")
    const newStatus = e.record.get("status")
    if (oldStatus && newStatus && oldStatus !== newStatus) {
      try {
        const event = new Record(e.app.findCollectionByNameOrId("mm_invoice_events"))
        event.set("owner", e.record.get("owner"))
        event.set("invoice", e.record.id)
        event.set("from_status", oldStatus)
        event.set("to_status", newStatus)
        event.set("at", new Date().toISOString())
        e.app.save(event)
      } catch (err) {
        console.log("Failed to create invoice event:", err)
      }
    }
  }

  // If soft-deleted, release linked entries
  if (e.record.get("deleted_at") && (!e.record.original() || !e.record.original().get("deleted_at"))) {
    try {
      const tsEntries = e.app.findRecordsByFilter(
        "mm_timesheet_entries", `invoice = "${e.record.id}"`, "", 0, 0,
      )
      for (const entry of tsEntries) {
        entry.set("invoice", "")
        e.app.save(entry)
      }
      const pdEntries = e.app.findRecordsByFilter(
        "mm_perdiem_entries", `invoice = "${e.record.id}"`, "", 0, 0,
      )
      for (const entry of pdEntries) {
        entry.set("invoice", "")
        e.app.save(entry)
      }
    } catch (err) {
      console.log("Failed to release entries:", err)
    }
  }
}, "mm_invoices")

// Custom routes

// POST /api/mm/account/logout-all
routerAdd("POST", "/api/mm/account/logout-all", (e) => {
  const auth = e.requestInfo().auth
  if (!auth) throw new UnauthorizedError("auth required")
  auth.refreshTokenKey()
  e.app.save(auth)
  const token = auth.newAuthToken()
  return e.json(200, { token: token })
})

// POST /api/mm/account/delete
routerAdd("POST", "/api/mm/account/delete", (e) => {
  const auth = e.requestInfo().auth
  if (!auth) throw new UnauthorizedError("auth required")
  const body = e.requestInfo().body
  if (!body || !body.password) throw new BadRequestError("password required")
  if (!auth.validatePassword(body.password)) throw new BadRequestError("invalid password")
  e.app.delete(auth)
  return e.json(200, { message: "account deleted" })
})

// POST /api/mm/backup/destinations
routerAdd("POST", "/api/mm/backup/destinations", (e) => {
  const auth = e.requestInfo().auth
  if (!auth) throw new UnauthorizedError("auth required")
  const body = e.requestInfo().body
  if (!body || !body.email) throw new BadRequestError("email required")

  const existing = e.app.findRecordsByFilter(
    "mm_backup_destinations", `owner = "${auth.id}"`, "", 0, 0,
  )
  if (existing.length >= 5) throw new BadRequestError("max 5 destinations")
  for (const dest of existing) {
    if (dest.get("email") === body.email) throw new BadRequestError("destination already exists")
  }

  const tokenBytes = $security.randomString(32)
  const tokenHash = $security.sha256(tokenBytes)

  const dest = new Record(e.app.findCollectionByNameOrId("mm_backup_destinations"))
  dest.set("owner", auth.id)
  dest.set("email", body.email)
  dest.set("status", "pending")
  dest.set("token_hash", tokenHash)
  dest.set("token_expires", new Date(Date.now() + 48 * 3600 * 1000).toISOString())
  e.app.save(dest)

  return e.json(200, { id: dest.id, status: "pending" })
})

// POST /api/mm/backup/destinations/verify (public)
routerAdd("POST", "/api/mm/backup/destinations/verify", (e) => {
  const body = e.requestInfo().body
  if (!body || !body.token) throw new BadRequestError("token required")

  const tokenHash = $security.sha256(body.token)
  const dests = e.app.findRecordsByFilter(
    "mm_backup_destinations",
    `token_hash = "${tokenHash}" && status = "pending"`,
    "", 1, 0,
  )
  if (dests.length === 0) throw new BadRequestError("invalid or expired token")

  const dest = dests[0]
  const expires = new Date(dest.get("token_expires"))
  if (expires < new Date()) throw new BadRequestError("invalid or expired token")

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

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayLogs = e.app.findRecordsByFilter(
    "mm_backup_logs",
    `owner = "${auth.id}" && kind = "email" && created >= "${today.toISOString()}"`,
    "", 0, 0,
  )
  if (todayLogs.length >= 10) throw new BadRequestError("max 10 backup sends per day")

  return e.json(200, { message: "backup sent" })
})
