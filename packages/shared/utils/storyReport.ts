/**
 * Story reports travel inside the existing user→administrators message channel, so the report
 * needs a machine-readable envelope the admin inbox can recognise. The client only sends the
 * free-text reason; the server prefixes the story id (nothing report-specific is trusted from
 * the client).
 *
 * Envelope: `[NSFW-REPORT story:<storyId>] <reason>`
 */
export const NSFW_REPORT_TAG = '[NSFW-REPORT';

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
