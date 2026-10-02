import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/index';

/**
 * A hosted page answers the same with or without the slash after it: `/admin` used to fall to the
 * catch-all and redirect to `/`, while `/admin/` opened the panel. Compared with each other rather
 * than with a built page, so it holds whether or not the bundles exist on the machine running it.
 */
const answer = async (path: string) => {
  const app = await createApp();
  const response = await app.handle(new Request(`http://localhost${path}`, { redirect: 'manual' }));
  return {
    status: response.status,
    location: response.headers.get('location'),
    type: response.headers.get('content-type'),
    body: await response.text(),
  };
};

describe.each([['/admin'], ['/client'], ['/showcase']])('%s', (page) => {
  it('answers alike with and without a trailing slash', async () => {
    expect(await answer(`${page}/`)).toEqual(await answer(page));
  });
});

describe('the admin panel without its slash', () => {
  it('does not send the visitor to the root', async () => {
    const response = await answer('/admin');

    expect(response.status).not.toBe(302);
    expect(response.location).toBeNull();
  });

  it('still refuses the removed API paths with a JSON 404', async () => {
    for (const path of ['/admin/api', '/admin/api/']) {
      const response = await answer(path);
      expect(response.status).toBe(404);
      expect(JSON.parse(response.body)).toEqual({ message: 'Not found' });
    }
  });
});
