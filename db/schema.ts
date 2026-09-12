import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const transferDepartmentBaselines = sqliteTable("transfer_department_baselines", {
  machineryCode: text("machinery_code").primaryKey(),
  department: text("department").notNull(),
  currentDepartment: text("current_department"),
});

export const transferRecords = sqliteTable("transfer_records", {
  id: text("id").primaryKey(),
  transferDate: text("transfer_date").notNull(),
  transportersJson: text("transporters_json").notNull(),
  itemsJson: text("items_json").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
}, table => [index("idx_transfer_records_date").on(table.transferDate)]);

export const machineries = sqliteTable("machineries", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  typeCode: text("type_code"),
  brand: text("brand").notNull(),
  model: text("model"),
  engineModel: text("engine_model"),
  registrationNumber: text("registration_number"),
  serialNumber: text("serial_number").notNull(),
  department: text("department").notNull(),
  owningDepartment: text("owning_department"),
  leasingDepartment: text("leasing_department"),
  renterDepartment: text("renter_department"),
  currentDepartment: text("current_department"),
  condition: text("condition", {
    enum: ["W", "M", "AVAILABLE", "DAMAGED", "AWAITING_DISPOSAL", "DISPOSAL_APPROVED"],
  }).notNull().default("AVAILABLE"),

  status: text("status", {
    enum: [
      "AVAILABLE",
      "RENTED",
      "IN_SERVICE",
      "UNDER_REPAIR",
      "INACTIVE",
    ],
  })
    .notNull()
    .default("AVAILABLE"),
  repairStatus: text("repair_status", { enum: ["NONE", "ACTIVE"] }).notNull().default("NONE"),

  acquiredYear: integer("acquired_year"),
  acquisitionDate: text("acquisition_date"),
  standardLifeYears: integer("standard_life_years"),
  fuelRate: real("fuel_rate"),
  fuelUnit: text("fuel_unit"),
  fuelConsumption: text("fuel_consumption"),
  purchasePrice: integer("purchase_price"),
  utilization2563: real("utilization_2563"),
  utilization2564: real("utilization_2564"),
  utilization2565: real("utilization_2565"),
  yearlyRate: integer("yearly_rate"),
  monthlyRate: integer("monthly_rate"),
  weeklyRate: integer("weekly_rate"),
  dailyRate: integer("daily_rate").notNull().default(0),
  hourlyRate: integer("hourly_rate"),
  note: text("note"),
  source: text("source"),

  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const disposalRecords = sqliteTable("disposal_records", {
  id: text("id").primaryKey(),
  machineryCode: text("machinery_code").notNull().unique(),
  proposedDate: text("proposed_date").notNull(),
  documentNumber: text("document_number").notNull(),
  reason: text("reason").notNull(),
  responsiblePerson: text("responsible_person").notNull(),
  status: text("status", { enum: ["AWAITING_DISPOSAL", "DISPOSAL_APPROVED", "DISPOSED"] }).notNull().default("AWAITING_DISPOSAL"),
  approvalDate: text("approval_date"),
  approvalDocument: text("approval_document"),
  approver: text("approver"),
  note: text("note"),
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_disposal_records_date").on(table.proposedDate)]);

export const serviceRecords = sqliteTable("service_records", {
  id: text("id").primaryKey(),
  machineryCode: text("machinery_code").notNull(),
  serviceDate: text("service_date").notNull(),
  documentNumber: text("document_number"),
  fiscalYear: integer("fiscal_year"),
  documentSequence: integer("document_sequence"),
  meterReading: real("meter_reading"),
  meterUnit: text("meter_unit", { enum: ["KILOMETER", "HOUR"] }),
  provider: text("provider"),
  technician: text("technician"),
  itemsJson: text("items_json").notNull(),
  totalCost: real("total_cost").notNull().default(0),
  note: text("note"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_service_records_machinery_date").on(table.machineryCode, table.serviceDate),
  index("idx_service_records_date").on(table.serviceDate),
  uniqueIndex("service_records_document_number_unique").on(table.documentNumber),
]);

export const serviceDocumentCounters = sqliteTable("service_document_counters", {
  fiscalYear: integer("fiscal_year").primaryKey(),
  lastSequence: integer("last_sequence").notNull().default(0),
});

export const rentals = sqliteTable("rentals", {
  id: text("id").primaryKey(),
  machineryCode: text("machinery_code").notNull(),
  renterName: text("renter_name").notNull(),
  startDate: text("start_date").notNull(),
  expectedReturnDate: text("expected_return_date").notNull(),
  duration: integer("duration").notNull().default(1),
  returnedDate: text("returned_date"),
  rentalMode: text("rental_mode", { enum: ["W", "M"] }).notNull().default("W"),
  rateType: text("rate_type", { enum: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] }).notNull(),
  rateAmount: real("rate_amount").notNull(),
  totalAmount: real("total_amount").notNull().default(0),
  approver: text("approver").notNull(),
  status: text("status", { enum: ["ACTIVE", "RETURNED"] }).notNull().default("ACTIVE"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_rentals_status_start_date").on(table.status, table.startDate),
  index("idx_rentals_machinery_code").on(table.machineryCode),
]);

export const repairRecords = sqliteTable("repair_records", {
  id: text("id").primaryKey(),
  machineryCode: text("machinery_code").notNull(),
  repairDate: text("repair_date").notNull(),
  workSystemsJson: text("work_systems_json").notNull(),
  repairType: text("repair_type", { enum: ["SELF", "OUTSOURCED"] }),
  symptom: text("symptom").notNull(),
  cause: text("cause"),
  repairDetails: text("repair_details"),
  reporter: text("reporter").notNull(),
  responsiblePerson: text("responsible_person"),
  provider: text("provider"),
  partsJson: text("parts_json").notNull().default("[]"),
  totalCost: real("total_cost").notNull().default(0),
  status: text("status", { enum: ["WAITING", "WAITING_PARTS", "IN_PROGRESS", "COMPLETED"] }).notNull().default("WAITING"),
  completedDate: text("completed_date"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_repair_records_machinery_date").on(table.machineryCode, table.repairDate),
  index("idx_repair_records_status_date").on(table.status, table.repairDate),
]);
