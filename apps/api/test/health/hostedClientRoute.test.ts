import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { clientDistPath } from '../../src/config/resourceRoot';
import { createApp } from '../../src/index';

describe('GET /app', () => {
  it('serves the hosted client HTML with isolation headers when the export exists', async () => {
    if (!existsSync(`${clientDistPath()}/index.html`)) {
      return;
    }
    const app = await createApp();
    const response = await app.handle(new Request('http://localhost/app'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/html/);
    expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
    expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    const html = await response.text();
    expect(html).toContain('/app/_expo/');
  });
});
