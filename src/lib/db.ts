import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DEFAULT_RULES, type RulesConfig } from "./rules";
import type {
  AssistantRecommendation,
  Message,
  MessageRole,
  Negotiation,
  NegotiationDetail,
  NegotiationStatus,
  PastDeal,
  Platform,
  RelationshipStage,
  Report,
  ReportMetrics,
  Scores,
} from "./types";

// ── Connection ───────────────────────────────────────────────────────────────
//
// Local dev (and `file:` URLs) use an embedded SQLite file. In production set
// DATABASE_URL to your Turso libsql:// URL and DATABASE_AUTH_TOKEN to its token.

function resolveDbConfig(): { url: string; authToken?: string } {
  const url = process.env.DATABASE_URL?.trim();
  const authToken = process.env.DATABASE_AUTH_TOKEN?.trim() || undefined;
  if (url) return { url, authToken };
  // Default: local embedded SQLite file.
  const dir = join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  return { url: `file:${join(dir, "app.db")}` };
}

const globalForDb = globalThis as unknown as {
  __libsql?: Client;
  __libsqlSchema?: Promise<void>;
};

function client(): Client {
  if (!globalForDb.__libsql) {
    globalForDb.__libsql = createClient({ ...resolveDbConfig(), intMode: "number" });
  }
  return globalForDb.__libsql;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS negotiations (
    id                 TEXT PRIMARY KEY,
    creator_name       TEXT NOT NULL,
    creator_handle     TEXT,
    platforms          TEXT NOT NULL DEFAULT '[]',
    campaign           TEXT,
    budget_eur         REAL,
    currency           TEXT NOT NULL DEFAULT 'EUR',
    relationship_stage TEXT NOT NULL DEFAULT 'first',
    status             TEXT NOT NULL DEFAULT 'active',
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS reports (
    id              TEXT PRIMARY KEY,
    negotiation_id  TEXT NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL DEFAULT 'unknown',
    filename        TEXT,
    file_path       TEXT,
    metrics_json    TEXT,
    scores_json     TEXT,
    created_at      TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    negotiation_id  TEXT NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    meta_json       TEXT,
    created_at      TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS past_deals (
    id              TEXT PRIMARY KEY,
    negotiation_id  TEXT NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
    label           TEXT,
    platform        TEXT,
    spend_eur       REAL,
    revenue_eur     REAL,
    conversions     INTEGER,
    notes           TEXT,
    created_at      TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rules_config (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    config_json TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_reports_negotiation ON reports(negotiation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_negotiation ON messages(negotiation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pastdeals_negotiation ON past_deals(negotiation_id)`,
];

async function ensureSchema(c: Client): Promise<void> {
  if (!globalForDb.__libsqlSchema) {
    globalForDb.__libsqlSchema = (async () => {
      await c.batch(SCHEMA, "write");
      const existing = await c.execute("SELECT id FROM rules_config WHERE id = 1");
      if (existing.rows.length === 0) {
        await c.execute({
          sql: "INSERT INTO rules_config (id, config_json, updated_at) VALUES (1, ?, ?)",
          args: [JSON.stringify(DEFAULT_RULES), new Date().toISOString()],
        });
      }
    })();
  }
  return globalForDb.__libsqlSchema;
}

/** Get a ready-to-use client (schema ensured). */
async function db(): Promise<Client> {
  const c = client();
  await ensureSchema(c);
  return c;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseJSON<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function now(): string {
  return new Date().toISOString();
}

function num(v: unknown): number | null {
  return v == null ? null : Number(v);
}

// ── Rules ────────────────────────────────────────────────────────────────────

export async function getRules(): Promise<RulesConfig> {
  const c = await db();
  const res = await c.execute("SELECT config_json FROM rules_config WHERE id = 1");
  const row = res.rows[0] as unknown as { config_json: string } | undefined;
  const stored = parseJSON<Partial<RulesConfig>>(row?.config_json, {});
  return { ...DEFAULT_RULES, ...stored } as RulesConfig;
}

export async function saveRules(config: RulesConfig): Promise<RulesConfig> {
  const c = await db();
  await c.execute({
    sql:
      "INSERT INTO rules_config (id, config_json, updated_at) VALUES (1, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at",
    args: [JSON.stringify(config), now()],
  });
  return config;
}

export async function resetRules(): Promise<RulesConfig> {
  return saveRules(DEFAULT_RULES);
}

// ── Negotiations ─────────────────────────────────────────────────────────────

interface NegotiationRow {
  id: string;
  creator_name: string;
  creator_handle: string | null;
  platforms: string;
  campaign: string | null;
  budget_eur: number | null;
  currency: string;
  relationship_stage: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function mapNegotiation(r: NegotiationRow): Negotiation {
  return {
    id: r.id,
    creatorName: r.creator_name,
    creatorHandle: r.creator_handle,
    platforms: parseJSON<Platform[]>(r.platforms, []),
    campaign: r.campaign,
    budgetEur: num(r.budget_eur),
    currency: r.currency,
    relationshipStage: r.relationship_stage as RelationshipStage,
    status: r.status as NegotiationStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface CreateNegotiationInput {
  creatorName: string;
  creatorHandle?: string | null;
  platforms?: Platform[];
  campaign?: string | null;
  budgetEur?: number | null;
  currency?: string;
  relationshipStage?: RelationshipStage;
}

export async function createNegotiation(input: CreateNegotiationInput): Promise<Negotiation> {
  const c = await db();
  const id = randomUUID();
  const ts = now();
  await c.execute({
    sql: `INSERT INTO negotiations
      (id, creator_name, creator_handle, platforms, campaign, budget_eur, currency, relationship_stage, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    args: [
      id,
      input.creatorName.trim(),
      input.creatorHandle?.trim() || null,
      JSON.stringify(input.platforms ?? []),
      input.campaign?.trim() || null,
      input.budgetEur ?? null,
      input.currency ?? "EUR",
      input.relationshipStage ?? "first",
      ts,
      ts,
    ],
  });
  return (await getNegotiation(id))!;
}

export interface NegotiationListItem extends Negotiation {
  reportCount: number;
  messageCount: number;
}

export async function listNegotiations(): Promise<NegotiationListItem[]> {
  const c = await db();
  const res = await c.execute(
    `SELECT n.*,
      (SELECT COUNT(*) FROM reports r WHERE r.negotiation_id = n.id) AS report_count,
      (SELECT COUNT(*) FROM messages m WHERE m.negotiation_id = n.id) AS message_count
     FROM negotiations n
     ORDER BY n.updated_at DESC`
  );
  const rows = res.rows as unknown as (NegotiationRow & {
    report_count: number;
    message_count: number;
  })[];
  return rows.map((r) => ({
    ...mapNegotiation(r),
    reportCount: Number(r.report_count),
    messageCount: Number(r.message_count),
  }));
}

export async function getNegotiation(id: string): Promise<Negotiation | null> {
  const c = await db();
  const res = await c.execute({
    sql: "SELECT * FROM negotiations WHERE id = ?",
    args: [id],
  });
  const row = res.rows[0] as unknown as NegotiationRow | undefined;
  return row ? mapNegotiation(row) : null;
}

export interface UpdateNegotiationInput {
  creatorName?: string;
  creatorHandle?: string | null;
  platforms?: Platform[];
  campaign?: string | null;
  budgetEur?: number | null;
  relationshipStage?: RelationshipStage;
  status?: NegotiationStatus;
}

export async function updateNegotiation(
  id: string,
  patch: UpdateNegotiationInput
): Promise<Negotiation | null> {
  const current = await getNegotiation(id);
  if (!current) return null;
  const merged = {
    creatorName: patch.creatorName ?? current.creatorName,
    creatorHandle:
      patch.creatorHandle !== undefined ? patch.creatorHandle : current.creatorHandle,
    platforms: patch.platforms ?? current.platforms,
    campaign: patch.campaign !== undefined ? patch.campaign : current.campaign,
    budgetEur: patch.budgetEur !== undefined ? patch.budgetEur : current.budgetEur,
    relationshipStage: patch.relationshipStage ?? current.relationshipStage,
    status: patch.status ?? current.status,
  };
  const c = await db();
  await c.execute({
    sql: `UPDATE negotiations SET
      creator_name = ?, creator_handle = ?, platforms = ?, campaign = ?,
      budget_eur = ?, relationship_stage = ?, status = ?, updated_at = ?
     WHERE id = ?`,
    args: [
      merged.creatorName,
      merged.creatorHandle,
      JSON.stringify(merged.platforms),
      merged.campaign,
      merged.budgetEur,
      merged.relationshipStage,
      merged.status,
      now(),
      id,
    ],
  });
  return getNegotiation(id);
}

export async function touchNegotiation(id: string): Promise<void> {
  const c = await db();
  await c.execute({
    sql: "UPDATE negotiations SET updated_at = ? WHERE id = ?",
    args: [now(), id],
  });
}

export async function deleteNegotiation(id: string): Promise<void> {
  const c = await db();
  await c.execute({ sql: "DELETE FROM negotiations WHERE id = ?", args: [id] });
}

// ── Reports ──────────────────────────────────────────────────────────────────

interface ReportRow {
  id: string;
  negotiation_id: string;
  platform: string;
  filename: string | null;
  file_path: string | null;
  metrics_json: string | null;
  scores_json: string | null;
  created_at: string;
}

function mapReport(r: ReportRow): Report {
  return {
    id: r.id,
    negotiationId: r.negotiation_id,
    platform: r.platform as Platform,
    filename: r.filename,
    metrics: parseJSON<ReportMetrics | null>(r.metrics_json, null),
    scores: parseJSON<Scores | null>(r.scores_json, null),
    createdAt: r.created_at,
  };
}

export interface AddReportInput {
  negotiationId: string;
  platform: Platform;
  filename?: string | null;
  filePath?: string | null;
  metrics: ReportMetrics | null;
  scores: Scores | null;
}

export async function addReport(input: AddReportInput): Promise<Report> {
  const c = await db();
  const id = randomUUID();
  await c.execute({
    sql: `INSERT INTO reports
      (id, negotiation_id, platform, filename, file_path, metrics_json, scores_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.negotiationId,
      input.platform,
      input.filename ?? null,
      input.filePath ?? null,
      input.metrics ? JSON.stringify(input.metrics) : null,
      input.scores ? JSON.stringify(input.scores) : null,
      now(),
    ],
  });
  await touchNegotiation(input.negotiationId);
  return (await getReport(id))!;
}

export async function getReport(id: string): Promise<Report | null> {
  const c = await db();
  const res = await c.execute({ sql: "SELECT * FROM reports WHERE id = ?", args: [id] });
  const row = res.rows[0] as unknown as ReportRow | undefined;
  return row ? mapReport(row) : null;
}

export async function listReports(negotiationId: string): Promise<Report[]> {
  const c = await db();
  const res = await c.execute({
    sql: "SELECT * FROM reports WHERE negotiation_id = ? ORDER BY created_at ASC",
    args: [negotiationId],
  });
  return (res.rows as unknown as ReportRow[]).map(mapReport);
}

export async function deleteReport(id: string): Promise<void> {
  const report = await getReport(id);
  const c = await db();
  await c.execute({ sql: "DELETE FROM reports WHERE id = ?", args: [id] });
  if (report) await touchNegotiation(report.negotiationId);
}

// ── Messages ─────────────────────────────────────────────────────────────────

interface MessageRow {
  id: string;
  negotiation_id: string;
  role: string;
  content: string;
  meta_json: string | null;
  created_at: string;
}

function mapMessage(r: MessageRow): Message {
  return {
    id: r.id,
    negotiationId: r.negotiation_id,
    role: r.role as MessageRole,
    content: r.content,
    recommendation: parseJSON<AssistantRecommendation | null>(r.meta_json, null),
    createdAt: r.created_at,
  };
}

export interface AddMessageInput {
  negotiationId: string;
  role: MessageRole;
  content: string;
  recommendation?: AssistantRecommendation | null;
}

export async function addMessage(input: AddMessageInput): Promise<Message> {
  const c = await db();
  const id = randomUUID();
  await c.execute({
    sql: `INSERT INTO messages (id, negotiation_id, role, content, meta_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.negotiationId,
      input.role,
      input.content,
      input.recommendation ? JSON.stringify(input.recommendation) : null,
      now(),
    ],
  });
  await touchNegotiation(input.negotiationId);
  return (await getMessage(id))!;
}

export async function getMessage(id: string): Promise<Message | null> {
  const c = await db();
  const res = await c.execute({ sql: "SELECT * FROM messages WHERE id = ?", args: [id] });
  const row = res.rows[0] as unknown as MessageRow | undefined;
  return row ? mapMessage(row) : null;
}

export async function listMessages(negotiationId: string): Promise<Message[]> {
  const c = await db();
  const res = await c.execute({
    sql: "SELECT * FROM messages WHERE negotiation_id = ? ORDER BY created_at ASC",
    args: [negotiationId],
  });
  return (res.rows as unknown as MessageRow[]).map(mapMessage);
}

export async function deleteMessage(id: string): Promise<void> {
  const c = await db();
  await c.execute({ sql: "DELETE FROM messages WHERE id = ?", args: [id] });
}

// ── Past deals ───────────────────────────────────────────────────────────────

interface PastDealRow {
  id: string;
  negotiation_id: string;
  label: string | null;
  platform: string | null;
  spend_eur: number | null;
  revenue_eur: number | null;
  conversions: number | null;
  notes: string | null;
  created_at: string;
}

function mapPastDeal(r: PastDealRow): PastDeal {
  return {
    id: r.id,
    negotiationId: r.negotiation_id,
    label: r.label,
    platform: (r.platform as Platform) ?? null,
    spendEur: num(r.spend_eur),
    revenueEur: num(r.revenue_eur),
    conversions: num(r.conversions),
    notes: r.notes,
    createdAt: r.created_at,
  };
}

export interface AddPastDealInput {
  negotiationId: string;
  label?: string | null;
  platform?: Platform | null;
  spendEur?: number | null;
  revenueEur?: number | null;
  conversions?: number | null;
  notes?: string | null;
}

export async function addPastDeal(input: AddPastDealInput): Promise<PastDeal> {
  const c = await db();
  const id = randomUUID();
  await c.execute({
    sql: `INSERT INTO past_deals
      (id, negotiation_id, label, platform, spend_eur, revenue_eur, conversions, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.negotiationId,
      input.label ?? null,
      input.platform ?? null,
      input.spendEur ?? null,
      input.revenueEur ?? null,
      input.conversions ?? null,
      input.notes ?? null,
      now(),
    ],
  });
  await touchNegotiation(input.negotiationId);
  return (await getPastDeal(id))!;
}

export async function getPastDeal(id: string): Promise<PastDeal | null> {
  const c = await db();
  const res = await c.execute({ sql: "SELECT * FROM past_deals WHERE id = ?", args: [id] });
  const row = res.rows[0] as unknown as PastDealRow | undefined;
  return row ? mapPastDeal(row) : null;
}

export async function listPastDeals(negotiationId: string): Promise<PastDeal[]> {
  const c = await db();
  const res = await c.execute({
    sql: "SELECT * FROM past_deals WHERE negotiation_id = ? ORDER BY created_at ASC",
    args: [negotiationId],
  });
  return (res.rows as unknown as PastDealRow[]).map(mapPastDeal);
}

export async function deletePastDeal(id: string): Promise<void> {
  const deal = await getPastDeal(id);
  const c = await db();
  await c.execute({ sql: "DELETE FROM past_deals WHERE id = ?", args: [id] });
  if (deal) await touchNegotiation(deal.negotiationId);
}

// ── Aggregate ────────────────────────────────────────────────────────────────

export async function getNegotiationDetail(id: string): Promise<NegotiationDetail | null> {
  const negotiation = await getNegotiation(id);
  if (!negotiation) return null;
  const [reports, messages, pastDeals] = await Promise.all([
    listReports(id),
    listMessages(id),
    listPastDeals(id),
  ]);
  return { ...negotiation, reports, messages, pastDeals };
}
