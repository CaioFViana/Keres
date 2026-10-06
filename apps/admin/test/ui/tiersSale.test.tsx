import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TiersPage } from '../../src/pages/tiers/TiersPage';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { changeInput, click, flush, render, submit } from '../helpers/react';

const mocks = vi.hoisted(() => ({
  listTiers: vi.fn(),
  createTier: vi.fn(),
  updateTier: vi.fn(),
  softDeleteTier: vi.fn(),
}));

vi.mock('../../src/api/TierApiService', () => ({
  TierApiService: {
    list: mocks.listTiers,
    create: mocks.createTier,
    update: mocks.updateTier,
    softDelete: mocks.softDeleteTier,
  },
}));

/** A plan as an older server sends it: none of the sale fields present. */
const bareTier = () => ({
  id: 'tier-1',
  name: 'Pro',
  isDefault: false,
  maxStories: 10,
  maxEntitiesPerStory: null,
  maxEntitiesTotal: null,
  maxStorageBytesPerStory: null,
  maxStorageBytesTotal: null,
  maxPublicationsPerDay: null,
  maxMessagesPerDay: null,
  isDeleted: false,
  deletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const open = async () => {
  mocks.listTiers.mockResolvedValue([bareTier()]);
  const view = await render(
    <MemoryRouter>
      <ThemeProvider>
        <TiersPage />
      </ThemeProvider>
    </MemoryRouter>,
  );
  await flush();
  return view;
};

const edit = async (container: HTMLElement) => {
  await click(
    Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Edit',
    )!,
  );
};

const field = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll('.form-card label'))
    .find((entry) => entry.textContent?.startsWith(label))!
    .querySelector('input') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateTier.mockResolvedValue(bareTier());
});

describe('tiers page: what is sold', () => {
  it('shows the sale fields of a plan that has none as off for sale, with the web methods on', async () => {
    const view = await open();

    expect(view.container.textContent).toContain('—');
    await edit(view.container);
    const checkboxes = Array.from(
      view.container.querySelectorAll('.form-card input[type="checkbox"]'),
    ) as HTMLInputElement[];
    // isDefault, for sale, web monthly, web yearly.
    expect(checkboxes.map((box) => box.checked)).toEqual([false, false, true, true]);
    await view.unmount();
  });

  it('saves prices in cents, the store products, the web switches and the order', async () => {
    const view = await open();
    await edit(view.container);

    await changeInput(field(view.container, 'Price per month'), '19.90');
    await changeInput(field(view.container, 'Price per year'), '199');
    await changeInput(field(view.container, 'Play product (monthly)'), '  pro_monthly ');
    await changeInput(field(view.container, 'Play product (yearly)'), 'pro_yearly');
    await changeInput(field(view.container, 'Display order'), '3');
    const boxes = Array.from(
      view.container.querySelectorAll('.form-card input[type="checkbox"]'),
    ) as HTMLInputElement[];
    await click(boxes[1]);
    await click(boxes[2]);
    await click(boxes[3]);
    await submit(view.container.querySelector('.form-card')!);
    await flush();

    expect(mocks.updateTier).toHaveBeenCalledWith(
      'tier-1',
      expect.objectContaining({
        priceMonthlyCents: 1990,
        priceYearlyCents: 19900,
        playMonthlyProductId: 'pro_monthly',
        playYearlyProductId: 'pro_yearly',
        isPublicForSale: true,
        webMonthlyEnabled: false,
        webYearlyEnabled: false,
        sortOrder: 3,
      }),
    );
    await view.unmount();
  });

  it('keeps a cleared price or product empty, and refuses a negative or unreadable price', async () => {
    const view = await open();
    await edit(view.container);

    await changeInput(field(view.container, 'Price per month'), '-5');
    await changeInput(field(view.container, 'Price per year'), 'abc');
    await changeInput(field(view.container, 'Play product (monthly)'), 'x');
    await changeInput(field(view.container, 'Play product (monthly)'), '   ');
    await changeInput(field(view.container, 'Display order'), '');
    await submit(view.container.querySelector('.form-card')!);
    await flush();

    expect(mocks.updateTier).toHaveBeenCalledWith(
      'tier-1',
      expect.objectContaining({
        priceMonthlyCents: null,
        priceYearlyCents: null,
        playMonthlyProductId: null,
        sortOrder: 0,
      }),
    );
    await view.unmount();
  });
});
