import type { EntityPropertyClassification } from './fieldSources';

/**
 * The classifications of what the server sends and the admin panel reads (accounts, plans, registration settings,
 * the public showcase and publications). Kept apart from `fieldSources.ts` to keep that file under the size ceiling.
 */
export const serverFieldClassifications: Record<string, EntityPropertyClassification> = {
  AdminUserInfo: {
    documented: [
      'username',
      'tag',
      'avatarColor',
      'avatarIcon',
      'bio',
      'isAdmin',
      'createdAt',
      'updatedAt',
    ],
    invisible: [
      'id',
      'tierId',
      'effectiveTierId',
      'tierSource',
      'isDeleted',
      'deletedAt',
      'isAdultVerified',
      'verificationStatus',
      'verifiedAt',
      'verificationMethod',
    ],
  },
  RegistrationSettings: {
    documented: ['isRegistrationOpen', 'maxUsers', 'autoManage', 'defaultTierId', 'updatedAt'],
    // The sale currency is an admin-panel concern; the client never prices anything.
    // So is the adults-only gate: the client only obeys the server's refusal.
    // And how the public landing page shows the plans (sale or information only).
    // The onboarding gate is read from the public config, not from a screen of settings.
    invisible: ['id', 'currency', 'allowNsfw', 'tiersDisplay', 'requireAccountOnboarding'],
  },
  // What the admin panel reads: the settings plus the server's age-verification mode (an operator concern).
  RegistrationSettingsView: {
    documented: [],
    invisible: ['ageVerificationMode'],
  },
  /**
   * The Showcase (public site) shapes describe what the *server* returns to an anonymous web page, not
   * an app screen. Nothing here is editable by the writer - the author chooses to publish and under what
   * name, and the rest is assembled from the story itself. That is why they are entirely internal as far
   * as help is concerned.
   */
  ShowcaseOwner: {
    documented: [],
    invisible: ['username', 'tag', 'avatarColor', 'avatarIcon'],
  },
  ShowcaseProtectedStub: {
    documented: [],
    invisible: ['storyId', 'protected'],
  },
  ShowcaseStoryCard: {
    documented: [],
    invisible: [
      'storyId',
      'snapshot',
      'owner',
      'versionCount',
      'latestVersion',
      'hasCover',
      'updatedAt',
      'isNsfw',
    ],
  },
  ShowcaseStoryDetail: {
    documented: [],
    invisible: ['storyId', 'snapshot', 'owner', 'versions', 'hasCover', 'workCovers', 'updatedAt'],
  },
  // What the public site reads to list its authors and draw their pages (the page's own texts are `OwnPublicProfile`).
  ShowcaseAuthorCard: {
    documented: [],
    invisible: ['owner', 'storyCount', 'updatedAt'],
  },
  ShowcaseAuthorPage: {
    documented: [],
    invisible: ['owner', 'biography', 'links', 'theme', 'stories', 'updatedAt'],
  },
  ShowcaseFacet: {
    documented: [],
    invisible: ['value', 'count'],
  },
  ShowcaseFacets: {
    documented: [],
    invisible: ['genres', 'languages', 'mediums', 'types'],
  },
  ShowcaseVersion: {
    documented: [],
    invisible: [
      'id',
      'arc',
      'label',
      'byteSize',
      'mediaIncluded',
      'mediaTotal',
      'createdAt',
      'packageIncluded',
      'manuscript',
      'reader',
    ],
  },
  StoryPublication: {
    documented: [],
    invisible: [
      'id',
      'storyId',
      'arcId',
      'ownerUserId',
      'label',
      'operationVersion',
      'formatVersion',
      'byteSize',
      'mediaIncluded',
      'mediaTotal',
      'manuscriptFormat',
      'readerByteSize',
      'packageIncluded',
      'createdAt',
    ],
  },
  StoryPublicationSnapshot: {
    documented: [],
    invisible: [
      'title',
      'description',
      'genre',
      'language',
      'author',
      'type',
      'theme',
      'isNsfw',
      'arc',
    ],
  },
  StoryPublicationArcSnapshot: {
    documented: [],
    invisible: ['id', 'title', 'description', 'author', 'medium'],
  },
  Tier: {
    documented: [
      'name',
      'isDefault',
      'maxStories',
      'maxEntitiesPerStory',
      'maxEntitiesTotal',
      'maxStorageBytesPerStory',
      'maxStorageBytesTotal',
      'maxPublicationsPerDay',
      'maxPublishedArcs',
      'maxCommentsPerStory',
      'maxContributorsPerStory',
      'maxMessagesPerDay',
      'createdAt',
      'updatedAt',
    ],
    // Sale pricing and landing display order live in the admin panel and landing page.
    invisible: [
      'id',
      'priceMonthlyCents',
      'priceYearlyCents',
      'isPublicForSale',
      'webMonthlyEnabled',
      'webYearlyEnabled',
      'playMonthlyProductId',
      'playYearlyProductId',
      'sortOrder',
      'isDeleted',
      'deletedAt',
    ],
  },
  // What the user writes for their author page on a server's public showcase (the `PublicProfile` screen).
  OwnPublicProfile: {
    documented: ['biography', 'links', 'theme'],
    invisible: [],
  },
  ProfileLink: {
    documented: ['label', 'url'],
    invisible: [],
  },
  UserPublicInfo: {
    documented: ['username', 'tag', 'avatarColor', 'avatarIcon', 'bio'],
    invisible: ['id', 'isAdultVerified'],
  },
};
