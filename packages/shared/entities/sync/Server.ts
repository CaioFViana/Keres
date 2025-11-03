export interface Server {
  id: string; // ULID
  name: string; // Nome amigável do servidor (ex: "Keres Cloud")
  url: string; // URL base do servidor (ex: "https://keres.com")
  lastSyncDate?: Date; // Opcional: para controle de sincronização
  createdAt: Date;
  updatedAt: Date;
  version: number;
}
