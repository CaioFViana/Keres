import type {
  ManuscriptFormat,
  ManuscriptLabels,
  ReaderLabels,
  ManuscriptStyle,
  PageLayout,
  PublicationLabelMode,
  ShowcaseVisibility,
  StoryPublication,
} from '@keres/shared';
import type { ServerSelect } from '@/src/db/schemas/servers';
import { createKeresAxiosInstance } from './apiClient';
import { authTokenManager } from '@/src/services/auth/AuthTokenManager';

/**
 * How long a publication upload may take. The default HTTP timeout trips on a
 * slow network long before 100MB of manuscript and reader bytes arrive; the
 * upload carries its own ceiling instead.
 */
export const PUBLISH_UPLOAD_TIMEOUT_MS = 300_000;

/** Per-request options for a publication call: progress, patience and a way out. */
export interface PublishRequestOptions {
  /** Called with 0–1 as the upload progresses; never called on the legacy JSON path. */
  onUploadProgress?: (fraction: number) => void;
  /** Overrides the timeout for this call only. */
  timeoutMs?: number;
  /** Cancels the upload in flight. */
  signal?: AbortSignal;
}

/** One compiled file of a multipart publication: the bytes plus what to call them. */
export interface CompiledPublishUpload {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
}

export interface StoryShowcaseState {
  isPublished: boolean;
  visibility: ShowcaseVisibility;
  labelMode: PublicationLabelMode;
  hasPassword: boolean;
  publications: StoryPublication[];
}

/** Manuscript renditions the server can build: every one, in pure TypeScript. */
export const SERVER_MANUSCRIPT_FORMATS: ManuscriptFormat[] = [
  'docx',
  'pdf',
  'epub',
  'html',
  'md',
  'txt',
];

/**
 * How the server should render the story's manuscript for this version. Options
 * only - no bytes leave the device; the server compiles from its own copy.
 */
/** What the server compiles from its own copy: the same choices as the device export. */
export interface PublishManuscriptOptions {
  format: ManuscriptFormat;
  includeLooseScenes: boolean;
  includeSceneNames: boolean;
  includeToc: boolean;
  resetSceneNumbers: boolean;
  style: ManuscriptStyle;
  /** Branching stories: how the gamebook numbers its scenes. */
  sceneOrder?: 'discovery' | 'shuffled';
  /** Branching, paged formats: every scene opens a page of its own. */
  scenePerPage?: boolean;
  /** A comic's or a storyboard's pages: laid out in a flow, as a planning sheet or in spreads. */
  pageLayout?: PageLayout;
  /** When set, only this arc ships, under its title. */
  arcId?: string;
  /** Only for the screenplay formats: paper, numbering and headings. */
  screenplay?: { paper: 'letter' | 'a4'; numberScenes: boolean; generateHeadings: boolean };
  labels: ManuscriptLabels;
  /** Absent: the server credits the work's author, then the story's, then the owner's handle. */
  author?: string | null;
  language: string;
}

/** The online reader: the manuscript's choices (no file format) and the words of its own interface. */
export interface PublishReaderOptions extends Omit<PublishManuscriptOptions, 'format'> {
  readerLabels: ReaderLabels;
}

/**
 * The publication routes, spoken to a specific server.
 *
 * The same reason as `FriendshipApiService` for not using the shared `apiClient`: that one points at a
 * single server at a time (the last one synchronization or the open story set), and the publication
 * screen lists stories from every registered server.
 */
export class PublicationApiService {
  private clientFor(server: ServerSelect) {
    const client = createKeresAxiosInstance({ baseURL: server.url });
    client.setTokenProvider(authTokenManager);
    client.setActiveServer(server);
    return client;
  }

  /**
   * The server's public showcase config, `undefined` when it cannot say:
   * unreachable, or older than the route. The route is public: it needs no
   * sign-in. `compiledUpload` is absent on servers that predate
   * client-compiled uploads.
   */
  async getPublicConfig(
    server: ServerSelect,
  ): Promise<{ showcaseEnabled?: boolean; compiledUpload?: boolean } | undefined> {
    try {
      const response = await this.clientFor(server).get<{
        showcaseEnabled?: boolean;
        compiledUpload?: boolean;
      }>('/public/config');
      return response.data;
    } catch {
      return undefined;
    }
  }

  /**
   * Whether the server has its public pages turned on - without them it refuses every publication. `undefined`
   * when it cannot say: unreachable, or older than the route. The route is public: it needs no sign-in.
   */
  async isShowcaseEnabled(server: ServerSelect): Promise<boolean | undefined> {
    const config = await this.getPublicConfig(server);
    return typeof config?.showcaseEnabled === 'boolean' ? config.showcaseEnabled : undefined;
  }

  /**
   * Whether the server takes client-compiled manuscript and reader bytes: it
   * does when its config advertises the upload capability. Absent on older
   * servers and when unreachable: those only speak the legacy JSON
   * publication, which the server compiles itself.
   */
  async supportsCompiledUpload(server: ServerSelect): Promise<boolean> {
    const config = await this.getPublicConfig(server);
    return config?.compiledUpload === true;
  }

  /** Every story publication this account can read on this server - its own or shared with it. */
  async listVisible(server: ServerSelect): Promise<StoryPublication[]> {
    const response = await this.clientFor(server).get('/stories/publications/mine');
    return response.data;
  }

  async getStoryShowcase(server: ServerSelect, storyId: string): Promise<StoryShowcaseState> {
    const response = await this.clientFor(server).get(`/stories/${storyId}/publications`);
    return response.data;
  }

  /**
   * `visibility` travels with the publication on purpose: it describes how *this* publication should be
   * exposed, and the server rewrites it on every publication. A separate call only when there is a
   * password would make the "publish without a password" path change nothing, leaving an earlier
   * protection in force with nobody having asked for it.
   */
  async publish(
    server: ServerSelect,
    storyId: string,
    operationVersion: number,
    labelMode: PublicationLabelMode,
    visibility: ShowcaseVisibility = 'public',
    password?: string,
    manuscript?: PublishManuscriptOptions,
    reader?: PublishReaderOptions,
    includePackage = true,
    arcId?: string,
    options?: PublishRequestOptions,
  ): Promise<StoryPublication> {
    const response = await this.clientFor(server).post(
      `/stories/${storyId}/publications`,
      {
        operationVersion,
        labelMode,
        visibility,
        password,
        manuscript,
        reader,
        includePackage,
        // One work of the story: a manuscript and/or the reader of it, never the package.
        ...(arcId ? { arcId } : {}),
      },
      {
        ...(options?.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
        ...(options?.signal ? { signal: options.signal } : {}),
        ...(options?.onUploadProgress
          ? {
              onUploadProgress: (event: { loaded?: number; total?: number }) => {
                if (event.total) options.onUploadProgress?.((event.loaded ?? 0) / event.total);
              },
            }
          : {}),
      },
    );
    return response.data;
  }

  /**
   * Publishes with client-compiled bytes: the exact JSON body above rides as
   * the `data` part, and a file part's presence selects the pre-compiled path
   * for that artifact. The other artifact, when asked for, still compiles on
   * the server. Only for servers that advertise the capability (see
   * `supportsCompiledUpload`); older servers only speak `publish`.
   */
  async publishCompiled(
    server: ServerSelect,
    storyId: string,
    operationVersion: number,
    labelMode: PublicationLabelMode,
    visibility: ShowcaseVisibility = 'public',
    password?: string,
    manuscript?: PublishManuscriptOptions,
    reader?: PublishReaderOptions,
    includePackage = true,
    arcId?: string,
    files?: { manuscript?: CompiledPublishUpload; reader?: CompiledPublishUpload },
    options?: PublishRequestOptions,
  ): Promise<StoryPublication> {
    const form = new FormData();
    form.append(
      'data',
      JSON.stringify({
        operationVersion,
        labelMode,
        visibility,
        password,
        manuscript,
        reader,
        includePackage,
        // One work of the story: a manuscript and/or the reader of it, never the package.
        ...(arcId ? { arcId } : {}),
      }),
    );
    // A Blob uploads from memory on every platform: the native `{uri, name,
    // type}` file only points at files on disk, and these bytes were compiled
    // here, not written anywhere.
    if (files?.manuscript) {
      form.append(
        'manuscript',
        new Blob([files.manuscript.bytes as unknown as BlobPart], {
          type: files.manuscript.mimeType,
        }),
        files.manuscript.filename,
      );
    }
    if (files?.reader) {
      form.append(
        'reader',
        new Blob([files.reader.bytes as unknown as BlobPart], { type: files.reader.mimeType }),
        files.reader.filename,
      );
    }
    const response = await this.clientFor(server).post(`/stories/${storyId}/publications`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: options?.timeoutMs ?? PUBLISH_UPLOAD_TIMEOUT_MS,
      ...(options?.signal ? { signal: options.signal } : {}),
      ...(options?.onUploadProgress
        ? {
            onUploadProgress: (event: { loaded: number; total?: number }) => {
              if (event.total) options.onUploadProgress?.(event.loaded / event.total);
            },
          }
        : {}),
    });
    return response.data;
  }

  async setVisibility(
    server: ServerSelect,
    storyId: string,
    visibility: ShowcaseVisibility,
    password?: string,
  ): Promise<void> {
    await this.clientFor(server).put(`/stories/${storyId}/showcase`, { visibility, password });
  }

  async deletePublication(
    server: ServerSelect,
    storyId: string,
    publicationId: string,
  ): Promise<void> {
    await this.clientFor(server).delete(`/stories/${storyId}/publications/${publicationId}`);
  }

  async unpublish(server: ServerSelect, storyId: string): Promise<void> {
    await this.clientFor(server).delete(`/stories/${storyId}/publications`);
  }
}

export const publicationApiService = new PublicationApiService();
