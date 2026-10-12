import type { AgeVerificationMode } from '../age-verification/AgeVerificationConnector';

export interface RegistrationSettings {
  id: string;
  isRegistrationOpen: boolean;
  maxUsers: number | null;
  autoManage: boolean;
  allowNsfw: boolean;
  defaultTierId: string | null;
  /** ISO-4217 code (`BRL`): the one currency tier prices are expressed in. */
  currency: string;
  updatedAt: Date;
}

/**
 * What the admin panel reads: the settings row plus the server's age-verification mode. The mode is read-only -
 * the update does not take it - and the switch for adults-only content depends on it.
 */
export interface RegistrationSettingsView extends RegistrationSettings {
  ageVerificationMode: AgeVerificationMode;
}
