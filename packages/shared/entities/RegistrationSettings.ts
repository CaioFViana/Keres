export interface RegistrationSettings {
  id: string;
  isRegistrationOpen: boolean;
  maxUsers: number | null;
  autoManage: boolean;
  defaultTierId: string | null;
  updatedAt: Date;
}
