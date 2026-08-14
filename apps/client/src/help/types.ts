import type { GeneratedHelpPageId } from './generated/registry';

export type HelpPageId = GeneratedHelpPageId;

export type HelpBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'steps'; items: string[] }
  | { type: 'path'; segments: string[] }
  | { type: 'callout'; tone: 'info' | 'warning'; text: string }
  | { type: 'example'; title?: string; text: string }
  | { type: 'fields'; rows: HelpFieldRow[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'faq'; items: { question: string; answer: string }[] }
  | { type: 'seeAlso'; pages: HelpPageId[] };

export interface HelpFieldRow { key: string; label: string; whatToWrite: string; note?: string }
export interface HelpPage { id: HelpPageId; title: string; summary: string; keywords: string[]; blocks: HelpBlock[] }
export interface HelpSection { id: string; titleKey: string; pageIds: HelpPageId[] }
