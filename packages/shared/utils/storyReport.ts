import type { ReportTarget, ReportType } from '../metadata/ReportTypes';
import { REPORT_TARGETS, REPORT_TYPES } from '../metadata/ReportTypes';

/**
 * Reports travel inside the existing user→administrators message channel, so a report needs a
 * machine-readable envelope the admin inbox can recognise. The client sends only the type and
 * the free-text reason; the server prefixes the target id (nothing report-specific is trusted
 * from the client).
 *
 * Envelope: `[REPORT type:<type> <target>:<id>] <reason>`
 *
 * The older `[NSFW-REPORT story:<id>]` envelope still parses (as an untyped story report) so
 * reports written before types existed keep filtering and reading the same.
 */
export const NSFW_REPORT_TAG = '[NSFW-REPORT';
export const REPORT_TAG = '[REPORT';

export function buildNsfwReportBody(storyId: string, reason: string): string {
  return `${NSFW_REPORT_TAG} story:${storyId}] ${reason}`;
}

export interface ParsedNsfwReport {
  storyId: string;
  reason: string;
}

/** The report behind an admin message body, or null when the body is an ordinary message. */
export function parseNsfwReportBody(body: string): ParsedNsfwReport | null {
  const match = /^\[NSFW-REPORT story:([^\]]+)\] ?([\s\S]*)$/.exec(body);
  if (!match) {
    return null;
  }
  return { storyId: match[1], reason: match[2] };
}

export interface ParsedReport {
  type: ReportType;
  targetKind: ReportTarget;
  targetId: string;
  reason: string;
}

export function buildReportBody(
  type: ReportType,
  targetKind: ReportTarget,
  targetId: string,
  reason: string,
): string {
  return `${REPORT_TAG} type:${type} ${targetKind}:${targetId}] ${reason}`;
}

const isReportType = (value: string): value is ReportType =>
  (REPORT_TYPES as readonly string[]).includes(value);

const isReportTarget = (value: string): value is ReportTarget =>
  (REPORT_TARGETS as readonly string[]).includes(value);

/**
 * The report behind an admin message body, new envelope or legacy, or null when the body is an
 * ordinary message. A legacy body reads as an untyped (`other`) story report.
 */
export function parseReportBody(body: string): ParsedReport | null {
  const match = /^\[REPORT type:([a-z_]+) ([a-z]+):([^\]]+)\] ?([\s\S]*)$/.exec(body);
  if (match) {
    const [, type, targetKind, targetId, reason] = match;
    if (!isReportType(type) || !isReportTarget(targetKind) || targetId.length === 0) {
      return null;
    }
    return { type, targetKind, targetId, reason };
  }
  const legacy = parseNsfwReportBody(body);
  if (!legacy) {
    return null;
  }
  return { type: 'other', targetKind: 'story', targetId: legacy.storyId, reason: legacy.reason };
}
