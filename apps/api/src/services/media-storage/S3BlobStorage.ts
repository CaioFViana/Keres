import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import type { BlobStorage } from './BlobStorage';

function isMissingObject(error: unknown): boolean {
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    value?.name === 'NotFound' ||
    value?.name === 'NoSuchKey' ||
    value?.$metadata?.httpStatusCode === 404
  );
}

/** Adaptador para AWS S3 e endpoints compatíveis, como SeaweedFS e Ceph RGW. */
export class S3BlobStorage implements BlobStorage {
  private readonly client: S3Client;

  constructor() {
    this.client = new S3Client({
      endpoint: env.MEDIA_S3_ENDPOINT,
      region: env.MEDIA_S3_REGION,
      forcePathStyle: env.MEDIA_S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.MEDIA_S3_ACCESS_KEY_ID!,
        secretAccessKey: env.MEDIA_S3_SECRET_ACCESS_KEY!,
      },
    });
  }

  private objectKey(key: string): string {
    return [env.MEDIA_S3_PREFIX.replace(/^\/+|\/+$/g, ''), key].filter(Boolean).join('/');
  }

  async has(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: env.MEDIA_S3_BUCKET!, Key: this.objectKey(key) }),
      );
      return true;
    } catch (error) {
      if (isMissingObject(error)) {
        return false;
      }
      throw error;
    }
  }

  async put(key: string, bytes: ArrayBuffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.MEDIA_S3_BUCKET!,
        Key: this.objectKey(key),
        Body: new Uint8Array(bytes),
        ContentType: mimeType,
      }),
    );
  }

  async get(key: string): Promise<ReadableStream<Uint8Array> | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: env.MEDIA_S3_BUCKET!, Key: this.objectKey(key) }),
      );
      if (!response.Body) {
        return null;
      }
      return response.Body.transformToWebStream();
    } catch (error) {
      if (isMissingObject(error)) {
        return null;
      }
      throw error;
    }
  }

  async presignGet(key: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: env.MEDIA_S3_BUCKET!, Key: this.objectKey(key) }),
      { expiresIn: ttlSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: env.MEDIA_S3_BUCKET!, Key: this.objectKey(key) }),
    );
  }
}
