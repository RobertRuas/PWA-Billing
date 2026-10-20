/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // mm_users (auth collection)
    const users = new Collection({
      name: "mm_users",
      type: "auth",
      listRule: "id = @request.auth.id",
      viewRule: "id = @request.auth.id",
      createRule: "", // open registration (close later by setting to null)
      updateRule: "id = @request.auth.id",
      deleteRule: null,
      fields: [
        { name: "name", type: "text", required: true, min: 1, max: 120 },
        { name: "language", type: "select", values: ["auto", "pt-BR", "en"], maxSelect: 1 },
        { name: "theme", type: "select", values: ["auto", "light", "dark"], maxSelect: 1 },
        { name: "password", type: "password", required: true, system: true, hidden: true, min: 6, max: 0, cost: 0 },
      ],
      passwordAuth: { enabled: true },
      emailAuth: { enabled: true },
      authRule: "verified = true",
      authToken: { duration: 604800 }, // 7 days
      verificationToken: { duration: 172800 }, // 48h
      passwordResetToken: { duration: 1800 }, // 30 min
      emailChangeToken: { duration: 3600 }, // 1h
    })
    app.save(users)

    // mm_profiles
    const profiles = new Collection({
      name: "mm_profiles",
      type: "base",
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: null,
      updateRule: "owner = @request.auth.id",
      deleteRule: null,
      fields: [
        { name: "owner", type: "relation", required: true, collectionId: users.id, cascadeDelete: true },
        { name: "rev", type: "number", required: true, min: 1 },
        { name: "deleted_at", type: "date" },
        { name: "currency", type: "select", values: ["EUR", "USD", "GBP", "CHF", "BRL"], maxSelect: 1 },
        { name: "default_hourly_rate_cents", type: "number", min: 0 },
        { name: "default_perdiem_cents", type: "number", min: 0 },
        { name: "invoice_number_pattern", type: "text", max: 40 },
        { name: "next_invoice_seq", type: "number", min: 1, max: 999999 },
        { name: "payment_reminder_days", type: "number", min: 0, max: 365 },
        { name: "week_starts_on", type: "number", min: 0, max: 1 },
        { name: "tech_name", type: "text", max: 120 },
        { name: "tech_company", type: "text", max: 160 },
        { name: "tech_email", type: "text", max: 200 },
        { name: "tech_address", type: "text", max: 300 },
        { name: "tech_vat", type: "text", max: 40 },
        { name: "tech_tel", type: "text", max: 40 },
        { name: "bank_iban_name", type: "text", max: 120 },
        { name: "bank_iban", type: "text", max: 40 },
        { name: "bank_swift", type: "text", max: 11 },
        { name: "backup_schedule", type: "select", values: ["off", "weekly", "monthly"], maxSelect: 1 },
        { name: "backup_include_attachments", type: "bool" },
        { name: "backup_last_at", type: "date" },
        { name: "backup_next_at", type: "date" },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_mm_profiles_owner ON mm_profiles (owner)"],
    })
    app.save(profiles)

    // mm_clients
    const clients = new Collection({
      name: "mm_clients",
      type: "base",
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: '@request.auth.id != "" && @request.auth.collectionName = "mm_users" && @request.body.owner = @request.auth.id',
      updateRule: "owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)",
      deleteRule: null,
      fields: [
        { name: "owner", type: "relation", required: true, collectionId: users.id, cascadeDelete: true },
        { name: "rev", type: "number", required: true, min: 1 },
        { name: "deleted_at", type: "date" },
        { name: "name", type: "text", required: true, min: 1, max: 160 },
        { name: "address", type: "text", max: 300 },
        { name: "vat", type: "text", max: 40 },
        { name: "email", type: "email" },
        { name: "notes", type: "text", max: 1000 },
        { name: "archived", type: "bool" },
      ],
      indexes: ["CREATE INDEX idx_mm_clients_owner ON mm_clients (owner)"],
    })
    app.save(clients)

    // mm_projects
    const projects = new Collection({
      name: "mm_projects",
      type: "base",
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: '@request.auth.id != "" && @request.auth.collectionName = "mm_users" && @request.body.owner = @request.auth.id',
      updateRule: "owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)",
      deleteRule: null,
      fields: [
        { name: "owner", type: "relation", required: true, collectionId: users.id, cascadeDelete: true },
        { name: "rev", type: "number", required: true, min: 1 },
        { name: "deleted_at", type: "date" },
        { name: "client", type: "relation", required: true, collectionId: clients.id },
        { name: "name", type: "text", required: true, min: 1, max: 160 },
        { name: "role", type: "text", max: 120 },
        { name: "start_date", type: "date" },
        { name: "end_date", type: "date" },
        { name: "location", type: "text", max: 160 },
        { name: "hourly_rate_cents", type: "number", min: 0 },
        { name: "perdiem_cents", type: "number", min: 0 },
        { name: "currency", type: "select", values: ["EUR", "USD", "GBP", "CHF", "BRL"], maxSelect: 1 },
        { name: "archived", type: "bool" },
      ],
      indexes: ["CREATE INDEX idx_mm_projects_owner ON mm_projects (owner)"],
    })
    app.save(projects)

    // Add relation fields now that clients and projects exist
    const p2 = app.findCollectionByNameOrId("mm_profiles")
    const dcField = new RelationField({ name: "default_client", collectionId: clients.id, maxSelect: 1 })
    const dpField = new RelationField({ name: "default_project", collectionId: projects.id, maxSelect: 1 })
    p2.fields.add(dcField)
    p2.fields.add(dpField)
    app.save(p2)

    // mm_invoices
    const invoices = new Collection({
      name: "mm_invoices",
      type: "base",
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: '@request.auth.id != "" && @request.auth.collectionName = "mm_users" && @request.body.owner = @request.auth.id',
      updateRule: "owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)",
      deleteRule: null,
      fields: [
        { name: "owner", type: "relation", required: true, collectionId: users.id, cascadeDelete: true },
        { name: "rev", type: "number", required: true, min: 1 },
        { name: "deleted_at", type: "date" },
        { name: "type", type: "select", required: true, values: ["hours", "expenses"], maxSelect: 1 },
        { name: "number", type: "text", required: true, min: 1, max: 40 },
        { name: "invoice_date", type: "date", required: true },
        { name: "period_start", type: "date", required: true },
        { name: "period_end", type: "date", required: true },
        { name: "currency", type: "select", values: ["EUR", "USD", "GBP", "CHF", "BRL"], maxSelect: 1 },
        { name: "status", type: "select", required: true, values: ["draft", "sent", "confirmed", "paid", "cancelled"], maxSelect: 1 },
        { name: "client", type: "relation", collectionId: clients.id, maxSelect: 1 },
        { name: "project", type: "relation", collectionId: projects.id, maxSelect: 1 },
        { name: "technician", type: "json" },
        { name: "bank", type: "json" },
        { name: "client_snapshot", type: "json" },
        { name: "project_snapshot", type: "json" },
        { name: "total_cents", type: "number" },
        { name: "sent_at", type: "date" },
        { name: "confirmed_at", type: "date" },
        { name: "paid_at", type: "date" },
        { name: "received_cents", type: "number" },
        { name: "difference_cents", type: "number" },
        { name: "payment_note", type: "text", max: 1000 },
        { name: "notes", type: "text", max: 2000 },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_mm_invoices_owner_number ON mm_invoices (owner, number) WHERE deleted_at = ''",
        "CREATE INDEX idx_mm_invoices_owner_date ON mm_invoices (owner, invoice_date)",
        "CREATE INDEX idx_mm_invoices_owner_status ON mm_invoices (owner, status)",
        "CREATE INDEX idx_mm_invoices_owner_paid ON mm_invoices (owner, paid_at)",
      ],
    })
    app.save(invoices)

    // mm_timesheets
    const timesheets = new Collection({
      name: "mm_timesheets",
      type: "base",
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: '@request.auth.id != "" && @request.auth.collectionName = "mm_users" && @request.body.owner = @request.auth.id',
      updateRule: "owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)",
      deleteRule: null,
      fields: [
        { name: "owner", type: "relation", required: true, collectionId: users.id, cascadeDelete: true },
        { name: "rev", type: "number", required: true, min: 1 },
        { name: "deleted_at", type: "date" },
        { name: "project", type: "relation", required: true, collectionId: projects.id },
        { name: "week_start", type: "date", required: true },
        { name: "week_end", type: "date", required: true },
        { name: "status", type: "select", values: ["draft", "submitted", "approved"], maxSelect: 1 },
        { name: "submitted_at", type: "date" },
        { name: "total_hours", type: "number", min: 0 },
        { name: "file", type: "file", maxSize: 10485760, mimeTypes: ["application/pdf", "image/jpeg", "image/png"], protected: true },
        { name: "notes", type: "text", max: 1000 },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_mm_timesheets_unique ON mm_timesheets (owner, project, week_start) WHERE deleted_at = ''",
        "CREATE INDEX idx_mm_timesheets_owner ON mm_timesheets (owner)",
      ],
    })
    app.save(timesheets)

    // mm_timesheet_entries
    const tsEntries = new Collection({
      name: "mm_timesheet_entries",
      type: "base",
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: '@request.auth.id != "" && @request.auth.collectionName = "mm_users" && @request.body.owner = @request.auth.id',
      updateRule: "owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)",
      deleteRule: null,
      fields: [
        { name: "owner", type: "relation", required: true, collectionId: users.id, cascadeDelete: true },
        { name: "rev", type: "number", required: true, min: 1 },
        { name: "deleted_at", type: "date" },
        { name: "timesheet", type: "relation", required: true, collectionId: timesheets.id, cascadeDelete: true },
        { name: "date", type: "date", required: true },
        { name: "hours", type: "number", min: 0, max: 24 },
        { name: "note", type: "text", max: 300 },
        { name: "invoice", type: "relation", collectionId: invoices.id, maxSelect: 1 },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_mm_ts_entries_unique ON mm_timesheet_entries (timesheet, date) WHERE deleted_at = ''",
        "CREATE INDEX idx_mm_ts_entries_owner ON mm_timesheet_entries (owner)",
      ],
    })
    app.save(tsEntries)

    // mm_perdiem_entries
    const pdEntries = new Collection({
      name: "mm_perdiem_entries",
      type: "base",
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: '@request.auth.id != "" && @request.auth.collectionName = "mm_users" && @request.body.owner = @request.auth.id',
      updateRule: "owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)",
      deleteRule: null,
      fields: [
        { name: "owner", type: "relation", required: true, collectionId: users.id, cascadeDelete: true },
        { name: "rev", type: "number", required: true, min: 1 },
        { name: "deleted_at", type: "date" },
        { name: "project", type: "relation", required: true, collectionId: projects.id },
        { name: "date", type: "date", required: true },
        { name: "kind", type: "select", required: true, values: ["perdiem", "meal", "lodging", "travel", "mileage", "other"], maxSelect: 1 },
        { name: "description", type: "text", max: 300 },
        { name: "quantity", type: "number", min: 0 },
        { name: "rate_cents", type: "number", min: 0 },
        { name: "amount_cents", type: "number" },
        { name: "receipt", type: "file", maxSize: 10485760, mimeTypes: ["application/pdf", "image/jpeg", "image/png"], protected: true },
        { name: "invoice", type: "relation", collectionId: invoices.id, maxSelect: 1 },
      ],
      indexes: ["CREATE INDEX idx_mm_pd_entries_owner ON mm_perdiem_entries (owner)"],
    })
    app.save(pdEntries)

    // mm_invoice_items
    const invoiceItems = new Collection({
      name: "mm_invoice_items",
      type: "base",
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: '@request.auth.id != "" && @request.auth.collectionName = "mm_users" && @request.body.owner = @request.auth.id',
      updateRule: "owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)",
      deleteRule: null,
      fields: [
        { name: "owner", type: "relation", required: true, collectionId: users.id, cascadeDelete: true },
        { name: "rev", type: "number", required: true, min: 1 },
        { name: "deleted_at", type: "date" },
        { name: "invoice", type: "relation", required: true, collectionId: invoices.id, cascadeDelete: true },
        { name: "position", type: "number", min: 0 },
        { name: "description", type: "text", required: true, min: 1, max: 300 },
        { name: "quantity", type: "number", min: 0, max: 100000 },
        { name: "unit", type: "select", values: ["h", "day", "unit", "km"], maxSelect: 1 },
        { name: "rate_cents", type: "number", min: 0 },
        { name: "amount_cents", type: "number" },
        { name: "date_from", type: "date" },
        { name: "date_to", type: "date" },
      ],
      indexes: ["CREATE INDEX idx_mm_inv_items_owner ON mm_invoice_items (owner)"],
    })
    app.save(invoiceItems)

    // mm_invoice_events
    const invoiceEvents = new Collection({
      name: "mm_invoice_events",
      type: "base",
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "owner", type: "relation", required: true, collectionId: users.id, cascadeDelete: true },
        { name: "invoice", type: "relation", required: true, collectionId: invoices.id, cascadeDelete: true },
        { name: "from_status", type: "select", values: ["draft", "sent", "confirmed", "paid", "cancelled"], maxSelect: 1 },
        { name: "to_status", type: "select", values: ["draft", "sent", "confirmed", "paid", "cancelled"], maxSelect: 1 },
        { name: "at", type: "date", required: true },
        { name: "note", type: "text", max: 500 },
      ],
    })
    app.save(invoiceEvents)

    // mm_attachments
    const attachments = new Collection({
      name: "mm_attachments",
      type: "base",
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: '@request.auth.id != "" && @request.auth.collectionName = "mm_users" && @request.body.owner = @request.auth.id',
      updateRule: "owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)",
      deleteRule: null,
      fields: [
        { name: "owner", type: "relation", required: true, collectionId: users.id, cascadeDelete: true },
        { name: "rev", type: "number", required: true, min: 1 },
        { name: "deleted_at", type: "date" },
        { name: "invoice", type: "relation", required: true, collectionId: invoices.id, cascadeDelete: true },
        { name: "kind", type: "select", required: true, values: ["invoice_pdf", "payment_proof", "confirmation", "receipt", "other"], maxSelect: 1 },
        { name: "file", type: "file", required: true, maxSize: 10485760, mimeTypes: ["application/pdf", "image/jpeg", "image/png"], protected: true },
        { name: "file_name", type: "text", max: 200 },
        { name: "size_bytes", type: "number", min: 0 },
        { name: "sha256", type: "text", max: 64 },
      ],
      indexes: ["CREATE INDEX idx_mm_attachments_owner ON mm_attachments (owner)"],
    })
    app.save(attachments)

    // mm_backup_destinations
    const backupDest = new Collection({
      name: "mm_backup_destinations",
      type: "base",
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: null,
      updateRule: null,
      deleteRule: "owner = @request.auth.id",
      fields: [
        { name: "owner", type: "relation", required: true, collectionId: users.id, cascadeDelete: true },
        { name: "email", type: "email", required: true },
        { name: "status", type: "select", values: ["pending", "verified"], maxSelect: 1 },
        { name: "verified_at", type: "date" },
        { name: "token_hash", type: "text", hidden: true },
        { name: "token_expires", type: "date", hidden: true },
        { name: "last_sent_at", type: "date" },
      ],
      indexes: ["CREATE UNIQUE INDEX idx_mm_backup_dest_unique ON mm_backup_destinations (owner, email)"],
    })
    app.save(backupDest)

    // mm_backup_logs
    const backupLogs = new Collection({
      name: "mm_backup_logs",
      type: "base",
      listRule: "owner = @request.auth.id",
      viewRule: "owner = @request.auth.id",
      createRule: '@request.auth.id != "" && @request.auth.collectionName = "mm_users" && @request.body.owner = @request.auth.id',
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "owner", type: "relation", required: true, collectionId: users.id, cascadeDelete: true },
        { name: "kind", type: "select", required: true, values: ["email", "export", "restore"], maxSelect: 1 },
        { name: "destinations", type: "json" },
        { name: "size_bytes", type: "number", min: 0 },
        { name: "status", type: "select", required: true, values: ["ok", "error"], maxSelect: 1 },
        { name: "error", type: "text", max: 500 },
      ],
    })
    app.save(backupLogs)

    // Update profile backup_destinations relation
    const profileFields2 = profiles.fields
    for (const f of profileFields2) {
      if (f.name === "backup_destinations") {
        // This field doesn't exist yet as a relation; we'll handle it via JSON
      }
    }
  },
  (app) => {
    // Rollback: delete all collections in reverse order
    const names = [
      "mm_backup_logs", "mm_backup_destinations", "mm_attachments",
      "mm_invoice_events", "mm_invoice_items", "mm_perdiem_entries",
      "mm_timesheet_entries", "mm_timesheets", "mm_invoices",
      "mm_projects", "mm_clients", "mm_profiles", "mm_users",
    ]
    for (const name of names) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (e) {
        // collection may not exist
      }
    }
  },
)
