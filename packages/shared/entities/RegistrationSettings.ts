export interface RegistrationSettings {
  id: string;
  isRegistrationOpen: boolean;
  maxUsers: number | null;
  autoManage: boolean;
  defaultTierId: string | null;
  /** ISO-4217 code (`BRL`): the one currency tier prices are expressed in. */
  currency: string;
  updatedAt: Date;
}
