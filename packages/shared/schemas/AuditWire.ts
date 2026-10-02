import type { AuditCategory, AuditOutcome } from '../metadata/AuditEvents';

/** A user as the activity record shows them: the name kept when the event happened, and who they are now. */
export interface AuditUserRef {
  /** `null` when the event had no known account (a login with a name nobody has). */
  id: string | null;
  username: string;
  tag: string | null;
  isDeleted: boolean;
}

/** One line of the activity record. Dates are ISO strings: this is the wire shape. */
export interface AuditEvent {
  id: string;
  createdAt: string;
  category: AuditCategory;
  /** `area.what`, like `auth.login` or `friend.request_sent`. */
  action: string;
  outcome: AuditOutcome;
  /** Who did it. */
  actor: AuditUserRef | null;
  /** The user it was done to, when there is one (the friend asked, the person written to). */
  subject: AuditUserRef | null;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  userAgent: string | null;
  /** Never holds secrets or content: the status, the reason a refusal gave, names of what changed. */
  meta: Record<string, unknown> | null;
}

export interface AuditEventPage {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

/** How the server is doing right now, for the top of the monitoring page. */
export interface AuditSystemInfo {
  version: string;
  startedAt: string;
  uptimeSeconds: number;
  databaseDriver: 'postgres' | 'sqlite';
  runtime: string;
  memoryRssMb: number;
  users: { total: number; active: number; deleted: number; admins: number };
  stories: number;
  /** Errors the technical log (`api_logs`) recorded in the summary's window. */
  errorLogs: number;
  /** How many days of the record are kept. */
  retentionDays: number;
}

export interface AuditSummary {
  since: string;
  hours: number;
  total: number;
  byCategory: Partial<Record<AuditCategory, number>>;
  failures: number;
  denied: number;
  failedLogins: number;
  newAccounts: number;
  messages: number;
  limitHits: number;
  adminActions: number;
  /** The addresses with the most failed logins in the window, worst first. */
  topFailedLoginIps: Array<{ ip: string; count: number }>;
  /** Events per day over the last fortnight, oldest first (UTC days). */
  perDay: Array<{ day: string; count: number }>;
  system: AuditSystemInfo;
}
