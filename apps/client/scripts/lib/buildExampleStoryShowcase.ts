import { createHash } from 'node:crypto';

type Context = {
  slug: string;
  language: 'en' | 'pt';
  showcase: any;
  storyId: string;
  id: (key: string) => string;
  base: (id: string, storyId: string) => Record<string, any>;
  publicSourceUrl: (slug: string) => string;
  chapters: any[];
  scenes: any[];
  characters: any[];
  locations: any[];
  items: any[];
};

export function buildExampleStoryShowcase(context: Context) {
  const {
    slug,
    language,
    showcase,
    storyId,
    id,
    base,
    publicSourceUrl,
    chapters,
    scenes,
    characters,
    locations,
    items,
  } = context;
  const pt = language === 'pt';
  const storyCalendars =
    slug === 'cinderella'
      ? [
          {
            ...base(id('calendar-primary'), storyId),
            name: showcase.calendarName,
            isPrimary: true,
            description: showcase.calendarDescription,
            extraNotes: null,
            definition: {
              secondsPerMinute: 60,
              minutesPerHour: 60,
              hoursPerDay: 24,
              daysPerWeek: 6,
              weekdayNames: pt
                ? ['Lua', 'Vênus', 'Marte', 'Mercúrio', 'Júpiter', 'Saturno']
                : ['Moon', 'Venus', 'Mars', 'Mercury', 'Jupiter', 'Saturn'],
              unitNames: {},
              months: (pt
                ? ['Cinzas', 'Abóboras', 'Baile', 'Vidro']
                : ['Ashes', 'Pumpkins', 'Ball', 'Glass']
              ).map((name) => ({ name, days: 30 })),
              eras: [
                {
                  name: pt ? 'Era do Reino' : 'Kingdom Era',
                  abbreviation: pt ? 'ER' : 'KE',
                  startYear: 1,
                  direction: 'forward',
                },
              ],
              moons: [
                {
                  name: pt ? 'Lua Madrinha' : 'Godmother Moon',
                  periodDays: 29.5,
                  referenceDay: 1,
                },
              ],
              seasons: [
                { name: pt ? 'Preparação' : 'Preparation', startDayOfYear: 1 },
                { name: pt ? 'Celebração' : 'Celebration', startDayOfYear: 61 },
              ],
            },
          },
        ]
      : slug === 'princess-kaguya'
        ? [
            {
              ...base(id('calendar-parallel'), storyId),
              name: showcase.parallelCalendarName,
              isPrimary: false,
              description: showcase.parallelCalendarDescription,
              extraNotes: null,
              definition: {
                secondsPerMinute: 60,
                minutesPerHour: 60,
                hoursPerDay: 24,
                daysPerWeek: 5,
                weekdayNames: pt
                  ? ['Bambu', 'Névoa', 'Lua', 'Vento', 'Estrela']
                  : ['Bamboo', 'Mist', 'Moon', 'Wind', 'Star'],
                unitNames: {},
                months: (pt ? ['Bambu', 'Prata', 'Retorno'] : ['Bamboo', 'Silver', 'Return']).map(
                  (name) => ({ name, days: 28 }),
                ),
                eras: [
                  {
                    name: pt ? 'Antes da Lua' : 'Before the Moon',
                    abbreviation: pt ? 'AL' : 'BM',
                    startYear: 1,
                    direction: 'backward',
                  },
                ],
                moons: [
                  {
                    name: pt ? 'Lua' : 'Moon',
                    periodDays: 28,
                    referenceDay: 1,
                  },
                ],
                seasons: [],
              },
            },
          ]
        : [];
  const chapterAnchors =
    slug === 'cinderella'
      ? [
          {
            ...base(id('chapter-anchor-1'), storyId),
            chapterId: chapters[1].id,
            order: 1,
            startSceneId: scenes[4].id,
            startPosition: 'start',
            startOffset: null,
            startOffsetUnit: null,
            endSceneId: scenes[7].id,
            endPosition: 'end',
            endOffset: null,
            endOffsetUnit: null,
          },
          {
            ...base(id('chapter-anchor-2'), storyId),
            chapterId: chapters[2].id,
            order: 1,
            startSceneId: scenes[8].id,
            startPosition: 'start',
            startOffset: 1,
            startOffsetUnit: 'days',
            endSceneId: scenes[11].id,
            endPosition: 'end',
            endOffset: null,
            endOffsetUnit: null,
          },
        ]
      : [];
  const storyBoards =
    slug === 'alice-in-wonderland'
      ? [
          {
            ...base(id('board-decisions'), storyId),
            name: showcase.boardName,
            description: showcase.boardDescription,
            content: {
              nodes: [
                {
                  id: 'A1CE0001',
                  kind: 'entity',
                  x: 80,
                  y: 100,
                  entityType: 'Character',
                  entityId: characters[0].id,
                  labelAtPin: characters[0].name,
                },
                {
                  id: 'A1CE0002',
                  kind: 'entity',
                  x: 360,
                  y: 80,
                  entityType: 'Scene',
                  entityId: scenes[3].id,
                  labelAtPin: scenes[3].name,
                },
                {
                  id: 'A1CE0003',
                  kind: 'entity',
                  x: 350,
                  y: 300,
                  entityType: 'Item',
                  entityId: items[0].id,
                  labelAtPin: items[0].name,
                },
                {
                  id: 'A1CE0004',
                  kind: 'note',
                  x: 100,
                  y: 310,
                  title: showcase.boardNoteTitle,
                  body: showcase.boardNoteBody,
                },
              ],
              edges: [
                {
                  id: 'A1CE1001',
                  from: 'A1CE0001',
                  to: 'A1CE0002',
                  directed: true,
                  label: null,
                },
                {
                  id: 'A1CE1002',
                  from: 'A1CE0002',
                  to: 'A1CE0003',
                  directed: true,
                  label: null,
                },
                {
                  id: 'A1CE1003',
                  from: 'A1CE0004',
                  to: 'A1CE0002',
                  directed: false,
                  label: null,
                },
              ],
            },
          },
        ]
      : [];
  const mapSlug =
    slug === 'beauty-and-the-beast' ? 'castle' : slug === 'little-mermaid' ? 'sea' : null;
  const storyLocationMaps = mapSlug
    ? [
        {
          ...base(id(`location-map-${mapSlug}`), storyId),
          name: mapSlug === 'castle' ? showcase.castleMapName : showcase.seaMapName,
          description:
            mapSlug === 'castle' ? showcase.castleMapDescription : showcase.seaMapDescription,
          content: {
            images: [],
            nodes: locations.slice(0, 5).map((location, index) => ({
              id: `${mapSlug === 'castle' ? 'CA571E' : '5EA000'}0${index + 1}`,
              locationId: location.id,
              x: 120 + (index % 3) * 230,
              y: 120 + Math.floor(index / 3) * 190,
              icon: index < 2 ? 'home-outline' : 'location-outline',
              color: ['#8BC34A', '#38BDF8', '#F59E0B', '#F472B6', '#A78BFA'][index],
            })),
          },
        },
      ]
    : [];
  const gallery: any = {
    ...base(id('gallery-public-source'), storyId),
    mediaType: 'link',
    mimeType: 'text/uri-list',
    fileName: 'public-story-source.url',
    hash: createHash('md5').update(`${slug}:public-source`).digest('hex'),
    sizeBytes: 0,
    sourceUrl: publicSourceUrl(slug),
    title: showcase.galleryTitle,
    isFavorite: false,
    extraNotes: showcase.galleryNotes,
  };
  const galleryRelations = [
    {
      ...base(id('gallery-relation-public-source'), storyId),
      galleryId: gallery.id,
      ownerId: locations[0].id,
      ownerType: 'Location',
    },
  ];
  return {
    storyCalendars,
    chapterAnchors,
    storyBoards,
    storyLocationMaps,
    gallery,
    galleryRelations,
  };
}
