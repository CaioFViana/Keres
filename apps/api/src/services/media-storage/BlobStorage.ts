/** Backend físico dos bytes de mídia. Metadados, autorização e deduplicação seguem no serviço acima dele. */
export type BlobBody = Blob | ReadableStream<Uint8Array>;

export interface BlobStorage {
  has(key: string): Promise<boolean>;
  put(key: string, bytes: ArrayBuffer, mimeType: string): Promise<void>;
  get(key: string): Promise<BlobBody | null>;
  delete(key: string): Promise<void>;
  /** Opcional porque só o backend de disco possui uploads temporários locais. */
  cleanupTemporaryFiles?(olderThanMs: number): Promise<number>;
  /**
   * URL temporária que o navegador pode buscar direto do armazenamento, sem passar pela API.
   *
   * Opcional porque só faz sentido em backend remoto: o disco local não tem endereço público
   * para assinar, e quem chama trata a ausência caindo de volta em servir os bytes. Existe
   * para o download de uma publicação (um .zip grande, potencialmente popular) não transformar
   * o processo da API no gargalo de banda - que é justamente o motivo de usar S3.
   */
  presignGet?(key: string, ttlSeconds: number): Promise<string>;
}
