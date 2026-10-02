export interface Tier {
  id: string;
  name: string;
  isDefault: boolean;
  /** Every `max*` field is `null` when unlimited. */
  maxStories: number | null;
  maxEntitiesPerStory: number | null;
  maxEntitiesTotal: number | null;
  maxStorageBytesPerStory: number | null;
  maxStorageBytesTotal: number | null;
  /** Versions the user may publish to the showcase in any 24 hours. */
  maxPublicationsPerDay: number | null;
  /** Messages the user may send to other users in any 24 hours (the cap for administrators is fixed). */
  maxMessagesPerDay: number | null;
  /** Monthly price in the system's currency minor units (`null` = not priced monthly). */
  priceMonthlyCents: number | null;
  /** Yearly price in the system's currency minor units (`null` = not priced yearly). */
  priceYearlyCents: number | null;
  /** Listed on the public landing page as available for sale. */
  isPublicForSale: boolean;
  /** Display order on the public landing page (ascending). */
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
}
