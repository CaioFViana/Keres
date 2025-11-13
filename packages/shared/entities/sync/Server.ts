export interface Server {
  // your info in remote servers. Local Replica.
  id: string; // ULID
  idUser: string // Your id in the remote server.
  userName: string // Publicly visible name
  name: string; // Nome amigável do servidor (ex: "Keres Cloud")
  url: string; // URL base do servidor (ex: "https://keres.com")
  lastSyncDate?: Date;
  jwtToken?: string;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}
