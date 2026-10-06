import { ContactCreateSchema } from '@keres/shared';
import { Elysia, t } from 'elysia';
import { createHash } from 'node:crypto';
import { contactService } from '../../services/ContactService';
import { registrationSettingsService } from '../../services/RegistrationSettingsService';
import { tierService } from '../../services/TierService';
import { AppError } from '../../utils/errors';
import { createAttemptLimiter } from '../../utils/rateLimiter';

/**
 * The landing page's two server calls, mounted at `/api/public` next to the showcase routes -
 * but outside their guard, in a module of their own: the landing page needs them whether or
 * not this server runs a showcase.
 *
 * Its own module also keeps `public.route.ts` below the file-size ceiling the architecture
 * tests enforce.
 */

/** A contact form is not a chat: 5 messages per hour per IP is plenty for a human. */
const contactLimiter = createAttemptLimiter({ maxAttempts: 5, windowMs: 60 * 60 * 1000 });

export const publicLandingRoutes = new Elysia()
  .get(
    '/tiers',
    async ({ set, headers }) => {
      const [settings, tiers] = await Promise.all([
        registrationSettingsService.getOrCreate(),
        tierService.listPublicForSale(),
      ]);
      const payload = {
        currency: settings.currency,
        tiers: tiers.map((tier) => ({
          id: tier.id,
          name: tier.name,
          isDefault: tier.isDefault,
          priceMonthlyCents: tier.priceMonthlyCents,
          priceYearlyCents: tier.priceYearlyCents,
          maxStories: tier.maxStories,
          maxEntitiesPerStory: tier.maxEntitiesPerStory,
          maxEntitiesTotal: tier.maxEntitiesTotal,
          maxStorageBytesPerStory: tier.maxStorageBytesPerStory,
          maxStorageBytesTotal: tier.maxStorageBytesTotal,
          maxPublicationsPerDay: tier.maxPublicationsPerDay,
          maxPublishedArcs: tier.maxPublishedArcs,
          playMonthlyProductId: tier.playMonthlyProductId,
          playYearlyProductId: tier.playYearlyProductId,
          webMonthlyEnabled: tier.webMonthlyEnabled,
          webYearlyEnabled: tier.webYearlyEnabled,
        })),
      };
      // The list is tiny (a handful of tiers), so hashing the payload itself is the cheapest
      // fingerprint - no extra query, and any price/visibility change busts the cache.
      const etag = `W/"tiers-${createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32)}"`;
      const cacheControl = 'public, max-age=60';
      if (headers['if-none-match'] === etag) {
        return new Response(null, {
          status: 304,
          headers: { etag, 'cache-control': cacheControl },
        });
      }
      set.headers['etag'] = etag;
      set.headers['cache-control'] = cacheControl;
      return payload;
    },
    {
      // No `response:` schema: the 304 path returns a raw `Response`, which a declared schema
      // rejects at the type level (same reason `/stories` declares none). The payload shape is
      // `PublicTiersResponseSchema` in `@keres/shared`, asserted by the integration tests.
      detail: {
        summary: 'Tiers available for sale',
        description:
          'The currency and the tiers this server offers, with prices and limits, for the landing page. Answers while the showcase is disabled.',
        tags: ['Showcase'],
      },
    },
  )
  .post(
    '/contact',
    async ({ body, server, request, set }) => {
      const clientIp = server?.requestIP(request)?.address ?? 'unknown';
      if (!contactLimiter.registerAttempt(clientIp)) {
        throw new AppError(429, 'Too many attempts. Try again later.');
      }
      const parsed = ContactCreateSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(400, parsed.error.issues[0]?.message || 'Invalid contact message');
      }
      const created = await contactService.create(parsed.data);
      set.status = 201;
      return { id: created.id };
    },
    {
      body: t.Object({
        subject: t.String(),
        body: t.String(),
        contactEmail: t.String(),
      }),
      response: t.Object({ id: t.String() }),
      detail: {
        summary: 'Contact the administrators',
        description:
          'Stores a visitor message for the administrators to read in the admin panel. Rate-limited per IP; answers while the showcase is disabled.',
        tags: ['Showcase'],
      },
    },
  );
