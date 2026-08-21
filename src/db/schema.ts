import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Users Table ---
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').default('user'),
  accessCode: text('access_code'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// --- Admins Table ---
export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').default('master_admin'),
  isEventAdmin: boolean('is_event_admin').default(true),
  permissions: jsonb('permissions').$type<string[]>().default(['manage_all']),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// --- Clients Table ---
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  accessCode: text('access_code').notNull(),
  name: text('name').notNull(),
  whatsapp: text('whatsapp'),
  email: text('email'),
  packageId: text('package_id'),
  packageName: text('package_name'),
  price: integer('price').default(0),
  startDate: text('start_date'),
  expiryDate: text('expiry_date'),
  status: text('status').default('active'),
  lastLoginAt: text('last_login_at'),
  notes: text('notes'),
  quotaLimit: integer('quota_limit').default(100),
  quotaUsed: integer('quota_used').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// --- Packages Table ---
export const packages = pgTable('packages', {
  id: serial('id').primaryKey(),
  pkgId: text('pkg_id').notNull().unique(),
  name: text('name').notNull(),
  tagline: text('tagline'),
  price: integer('price').notNull().default(0),
  durationDays: integer('duration_days').default(30),
  features: jsonb('features').$type<string[]>().default([]),
  isPopular: boolean('is_popular').default(false),
  isActive: boolean('is_active').default(true),
  badgeLabel: text('badge_label'),
  targetCategory: text('target_category'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// --- Transactions Table ---
export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(), // TRX-XXXXXX
  customerName: text('customer_name').notNull(),
  whatsapp: text('whatsapp'),
  email: text('email'),
  planId: text('plan_id'),
  planName: text('plan_name'),
  packageName: text('package_name'),
  planPrice: integer('plan_price').default(0),
  serviceFee: integer('service_fee').default(0),
  totalPrice: integer('total_price').default(0),
  amount: integer('amount').default(0),
  status: text('status').default('PENDING_PROOF'), // PENDING_PROOF, AWAITING_VERIFICATION, APPROVED, REJECTED
  proofImageBase64: text('proof_image_base64'),
  accessCode: text('access_code'),
  validUntil: text('valid_until'),
  note: text('note'),
  rejectReason: text('reject_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// --- Access Codes Table ---
export const accessCodes = pgTable('access_codes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  note: text('note'),
  clientName: text('client_name'),
  quotaLimit: integer('quota_limit').default(100),
  quotaUsed: integer('quota_used').default(0),
  status: text('status').default('active'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

// --- System Audit Logs Table ---
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  adminEmail: text('admin_email').notNull(),
  adminName: text('admin_name'),
  action: text('action').notNull(),
  details: text('details'),
  category: text('category').default('event_admin'),
  timestamp: timestamp('timestamp').defaultNow(),
});

// --- Live State & Broadcast Table ---
export const liveState = pgTable('live_state', {
  id: text('id').primaryKey(), // 'current_state'
  isMaintenance: boolean('is_maintenance').default(false),
  activeBroadcastMessage: text('active_broadcast_message'),
  currentEventStatus: text('current_event_status').default('live'),
  eventAdminEmail: text('event_admin_email'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// --- AI Agents Table ---
export const aiAgents = pgTable('ai_agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  model: text('model').notNull(),
  status: text('status').default('active'),
  callsCount: integer('calls_count').default(0),
  lastUsed: text('last_used'),
  approvedPatternsCount: integer('approved_patterns_count').default(0),
  rejectedPatternsCount: integer('rejected_patterns_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// --- Tracking Events Table ---
export const trackingEvents = pgTable('tracking_events', {
  id: serial('id').primaryKey(),
  eventType: text('event_type').notNull(),
  userId: text('user_id'),
  accessCode: text('access_code'),
  toolName: text('tool_name'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  trackingEvents: many(trackingEvents),
}));
