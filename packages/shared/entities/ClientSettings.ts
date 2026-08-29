import type { GregorianDateDisplayFormat } from '../utils/attributeDateValue';

export interface ClientSettings {
  id: string; // ULID for unique identification
  localUsername: string; // Local display name for the client
  language: string; // Preferred language for this device
  darkMode: boolean; // Preferred dark mode setting for this device
  /** Formato de hora das features de Data neste dispositivo: `true` = 24h, `false` = AM/PM. */
  use24HourTime: boolean;
  /** How civil Gregorian story dates are written for this device. */
  dateDisplayFormat: GregorianDateDisplayFormat;
  /** When on, it shows the contextual help shortcut in the application's headers. */
  showContextualHelp: boolean;
  /** When on, the menu offers the list of literary devices. */
  suggestLiteraryDevices: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number; // For synchronization and conflict resolution
  isDeleted: boolean; // For tombstone-based conflict resolution
  deletedAt: Date | null; // For tombstone-based conflict resolution
}
