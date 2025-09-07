import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { ulid } from 'ulid'

import * as schema from './schema.ts'

async function main() {
  const client = postgres('postgres://user:password@localhost:5432/keres_db')

  const db = drizzle(client, { schema })

  // Clear existing data (optional, but good for seeding)
  console.log('Clearing existing data...')
  await db.delete(schema.characterMoments)
  await db.delete(schema.characterRelations)
  await db.delete(schema.choices)
  await db.delete(schema.worldRules)
  await db.delete(schema.notes)
  await db.delete(schema.characterTags)
  await db.delete(schema.locationTags)
  await db.delete(schema.chapterTags)
  await db.delete(schema.sceneTags)
  await db.delete(schema.tags)
  await db.delete(schema.suggestions)
  await db.delete(schema.gallery)
  await db.delete(schema.moments)
  await db.delete(schema.scenes)
  await db.delete(schema.chapters)
  await db.delete(schema.characters)
  await db.delete(schema.locations)
  await db.delete(schema.story)
  await db.delete(schema.users)
  console.log('Data cleared.')

  // --- Little Red Riding Hood Story (Linear) ---

  // Create a user for Red Riding Hood
  const redUser = ulid()
  await db.insert(schema.users).values({
    id: redUser,
    username: 'red_riding_hood_fan',
    // hash com 10 saltos de test_password.
    passwordHash: '$2a$10$E0Ci7q4ourXu5BighmDlsu9kAY9m3WMNj4at09WQB/RKNRV8y609C', // In a real app, this would be a proper hash
    passwordSalt: 'some_salt', // In a real app, this would be a proper salt
  })
  console.log('Red Riding Hood user created.')

  // Create the Little Red Riding Hood story
  const redStoryId = ulid()
  await db.insert(schema.story).values({
    id: redStoryId,
    userId: redUser,
    type: 'linear',
    title: 'Little Red Riding Hood',
    summary: 'A classic fairy tale about a girl, a wolf, and a grandmother.',
    genre: 'Fairy Tale',
    language: 'English',
    isFavorite: true,
    extraNotes: 'This is a test story for seeding purposes.',
  })
  console.log('Little Red Riding Hood story created.')

  // Create characters for Red Riding Hood
  const redId = ulid()
  const wolfId = ulid()
  const grandmaId = ulid()
  const hunterId = ulid()

  await db.insert(schema.characters).values([
    {
      id: redId,
      storyId: redStoryId,
      name: 'Little Red Riding Hood',
      gender: 'Female',
      description: 'A young girl known for her red hooded cloak.',
      personality: 'Innocent, trusting',
      motivation: 'To deliver food to her sick grandmother.',
      qualities: 'Kind, obedient (initially)',
      weaknesses: 'Naive, easily tricked',
      biography: 'Lives with her mother near a forest.',
      plannedTimeline: 'Meets wolf, goes to grandmother, gets rescued.',
      extraNotes: 'Iconic red cloak.',
    },
    {
      id: wolfId,
      storyId: redStoryId,
      name: 'Big Bad Wolf',
      gender: 'Male',
      race: 'Wolf',
      description: 'A cunning and hungry wolf.',
      personality: 'Deceptive, predatory',
      motivation: 'To eat Red Riding Hood and her grandmother.',
      qualities: 'Cunning, persuasive',
      weaknesses: 'Overconfident, easily outsmarted',
      biography: 'Roams the forest, looking for prey.',
      plannedTimeline: 'Tricks Red, eats grandma, tries to eat Red, gets defeated.',
      extraNotes: 'Can impersonate others.',
    },
    {
      id: grandmaId,
      storyId: redStoryId,
      name: 'Grandmother',
      gender: 'Female',
      description: "Red Riding Hood's frail grandmother.",
      personality: 'Kind, vulnerable',
      motivation: 'To recover from illness.',
      qualities: 'Loving, gentle',
      weaknesses: 'Frail, easily deceived',
      biography: 'Lives in a cottage deep in the forest.',
      plannedTimeline: 'Gets eaten by wolf, rescued by hunter.',
      extraNotes: 'Needs care.',
    },
    {
      id: hunterId,
      storyId: redStoryId,
      name: 'Hunter',
      gender: 'Male',
      description: 'A brave hunter who saves Red and her grandmother.',
      personality: 'Brave, decisive',
      motivation: 'To protect the forest and its inhabitants.',
      qualities: 'Strong, observant',
      weaknesses: 'None apparent',
      biography: 'Patrols the forest, protecting its inhabitants.',
      plannedTimeline: 'Saves Red and Grandma, fills wolf with stones.',
      extraNotes: 'Carries an axe.',
    },
  ])
  console.log('Red Riding Hood characters created.')

  // Create locations for Red Riding Hood
  const redHouseId = ulid()
  const forestId = ulid()
  const grandmaCottageId = ulid()

  await db.insert(schema.locations).values([
    {
      id: redHouseId,
      storyId: redStoryId,
      name: "Red Riding Hood's House",
      description: 'A cozy house at the edge of the forest.',
      culture: 'Rural',
      politics: 'None',
      isFavorite: true,
      extraNotes: 'Starting point of the adventure.',
    },
    {
      id: forestId,
      storyId: redStoryId,
      name: 'The Dark Forest',
      description: 'A dense and sometimes dangerous forest.',
      climate: 'Temperate',
      culture: 'Wilderness',
      politics: 'None',
      isFavorite: false,
      extraNotes: 'Home to various creatures.',
    },
    {
      id: grandmaCottageId,
      storyId: redStoryId,
      name: "Grandmother's Cottage",
      description: 'A small, secluded cottage deep within the forest.',
      climate: 'Temperate',
      culture: 'Rural',
      politics: 'None',
      isFavorite: true,
      extraNotes: 'Target destination.',
    },
  ])
  console.log('Red Riding Hood locations created.')

  // Create chapters for Red Riding Hood
  const redChapter1Id = ulid()
  const redChapter2Id = ulid()
  const redChapter3Id = ulid()

  await db.insert(schema.chapters).values([
    {
      id: redChapter1Id,
      storyId: redStoryId,
      name: 'The Journey Begins',
      index: 1,
      summary: 'Red Riding Hood sets off to visit her grandmother.',
      isFavorite: false,
      extraNotes: 'Introduction to the story.',
    },
    {
      id: redChapter2Id,
      storyId: redStoryId,
      name: 'Encounter in the Forest',
      index: 2,
      summary: 'Red meets the wolf and is tricked.',
      isFavorite: false,
      extraNotes: 'Key turning point.',
    },
    {
      id: redChapter3Id,
      storyId: redStoryId,
      name: 'The Rescue',
      index: 3,
      summary: 'The hunter saves Red and her grandmother.',
      isFavorite: true,
      extraNotes: 'Climax of the story.',
    },
  ])
  console.log('Red Riding Hood chapters created.')

  // Create scenes for Red Riding Hood
  const redScene1_1Id = ulid() // Red leaves home
  const redScene1_2Id = ulid() // Red meets wolf
  const redScene2_1Id = ulid() // Wolf goes to grandma's
  const redScene2_2Id = ulid() // Red arrives at grandma's
  const redScene3_1Id = ulid() // Hunter arrives

  await db.insert(schema.scenes).values([
    {
      id: redScene1_1Id,
      chapterId: redChapter1Id,
      locationId: redHouseId,
      name: 'Departure from Home',
      index: 1,
      summary: "Red's mother gives her instructions.",
      gap: '1 hour',
      duration: '15 minutes',
      isFavorite: false,
      extraNotes: 'Sets the stage.',
    },
    {
      id: redScene1_2Id,
      chapterId: redChapter1Id,
      locationId: forestId,
      name: "The Wolf's Deception",
      index: 2,
      summary: 'The wolf convinces Red to pick flowers.',
      gap: '30 minutes',
      duration: '20 minutes',
      isFavorite: false,
      extraNotes: 'The inciting incident.',
    },
    {
      id: redScene2_1Id,
      chapterId: redChapter2Id,
      locationId: grandmaCottageId,
      name: 'Wolf at the Cottage',
      index: 1,
      summary: 'The wolf impersonates Red and devours the grandmother.',
      gap: '1 hour',
      duration: '10 minutes',
      isFavorite: false,
      extraNotes: "The wolf's cunning.",
    },
    {
      id: redScene2_2Id,
      chapterId: redChapter2Id,
      locationId: grandmaCottageId,
      name: "Red's Arrival",
      index: 2,
      summary: "Red arrives and notices her grandmother's strange appearance.",
      gap: '5 minutes',
      duration: '10 minutes',
      isFavorite: false,
      extraNotes: 'The reveal.',
    },
    {
      id: redScene3_1Id,
      chapterId: redChapter3Id,
      locationId: grandmaCottageId,
      name: "The Hunter's Intervention",
      index: 1,
      summary: 'The hunter hears the commotion and saves them.',
      gap: '0 minutes',
      duration: '15 minutes',
      isFavorite: true,
      extraNotes: 'The resolution.',
    },
  ])
  console.log('Red Riding Hood scenes created.')

  // Create moments for Red Riding Hood
  const redMoment1_1_1Id = ulid()
  const redMoment1_2_1Id = ulid()
  const redMoment1_2_2Id = ulid()
  const redMoment2_1_1Id = ulid()
  const redMoment2_1_2Id = ulid()
  const redMoment2_2_1Id = ulid()
  const redMoment2_2_2Id = ulid()
  const redMoment3_1_1Id = ulid()
  const redMoment3_1_2Id = ulid()

  await db.insert(schema.moments).values([
    {
      id: redMoment1_1_1Id,
      sceneId: redScene1_1Id,
      name: "Mother's Warning",
      location: "Red Riding Hood's House",
      index: 1,
      summary: 'Red is told not to stray from the path.',
      isFavorite: false,
      extraNotes: 'The initial warning.',
    },
    {
      id: redMoment1_2_1Id,
      sceneId: redScene1_2Id,
      name: 'A Friendly Chat',
      location: 'The Dark Forest',
      index: 1,
      summary: 'The wolf greets Red and asks about her destination.',
      isFavorite: false,
      extraNotes: "The wolf's first move.",
    },
    {
      id: redMoment1_2_2Id,
      sceneId: redScene1_2Id,
      name: 'Picking Flowers',
      location: 'The Dark Forest',
      index: 2,
      summary: "Red starts gathering flowers, unaware of the wolf's plan.",
      isFavorite: false,
      extraNotes: "Red's distraction.",
    },
    {
      id: redMoment2_1_1Id,
      sceneId: redScene2_1Id,
      name: 'Knock, Knock',
      location: "Grandmother's Cottage",
      index: 1,
      summary: "The wolf knocks on the grandmother's door.",
      isFavorite: false,
      extraNotes: "The wolf's deception begins.",
    },
    {
      id: redMoment2_1_2Id,
      sceneId: redScene2_1Id,
      name: 'Grandmother Devoured',
      location: "Grandmother's Cottage",
      index: 2,
      summary: 'The wolf tricks and eats the grandmother.',
      isFavorite: false,
      extraNotes: "The wolf's brutality.",
    },
    {
      id: redMoment2_2_1Id,
      sceneId: redScene2_2Id,
      name: 'Strange Appearance',
      location: "Grandmother's Cottage",
      index: 1,
      summary: "Red comments on her grandmother's big ears, eyes, and hands.",
      isFavorite: false,
      extraNotes: "Red's growing suspicion.",
    },
    {
      id: redMoment2_2_2Id,
      sceneId: redScene2_2Id,
      name: 'The Big Mouth',
      location: "Grandmother's Cottage",
      index: 2,
      summary: 'The wolf reveals himself and tries to eat Red.',
      isFavorite: false,
      extraNotes: 'The climax of the deception.',
    },
    {
      id: redMoment3_1_1Id,
      sceneId: redScene3_1Id,
      name: 'Hunter Arrives',
      location: "Grandmother's Cottage",
      index: 1,
      summary: 'The hunter hears the wolf and enters the cottage.',
      isFavorite: true,
      extraNotes: 'The timely intervention.',
    },
    {
      id: redMoment3_1_2Id,
      sceneId: redScene3_1Id,
      name: 'Wolf Defeated',
      location: "Grandmother's Cottage",
      index: 2,
      summary: 'The hunter kills the wolf and frees Red and grandmother.',
      isFavorite: true,
      extraNotes: 'The resolution.',
    },
  ])
  console.log('Red Riding Hood moments created.')

  // Character Moments for Red Riding Hood
  await db.insert(schema.characterMoments).values([
    { characterId: redId, momentId: redMoment1_1_1Id },
    { characterId: redId, momentId: redMoment1_2_1Id },
    { characterId: wolfId, momentId: redMoment1_2_1Id },
    { characterId: redId, momentId: redMoment1_2_2Id },
    { characterId: wolfId, momentId: redMoment2_1_1Id },
    { characterId: grandmaId, momentId: redMoment2_1_1Id },
    { characterId: wolfId, momentId: redMoment2_1_2Id },
    { characterId: grandmaId, momentId: redMoment2_1_2Id },
    { characterId: redId, momentId: redMoment2_2_1Id },
    { characterId: wolfId, momentId: redMoment2_2_1Id },
    { characterId: redId, momentId: redMoment2_2_2Id },
    { characterId: wolfId, momentId: redMoment2_2_2Id },
    { characterId: hunterId, momentId: redMoment3_1_1Id },
    { characterId: wolfId, momentId: redMoment3_1_2Id },
    { characterId: redId, momentId: redMoment3_1_2Id },
    { characterId: grandmaId, momentId: redMoment3_1_2Id },
    { characterId: hunterId, momentId: redMoment3_1_2Id },
  ])
  console.log('Red Riding Hood character moments created.')

  // Character Relations for Red Riding Hood
  await db.insert(schema.characterRelations).values([
    { id: ulid(), charId1: redId, charId2: grandmaId, relationType: 'Granddaughter-Grandmother' },
    { id: ulid(), charId1: wolfId, charId2: redId, relationType: 'Predator-Prey' },
    { id: ulid(), charId1: wolfId, charId2: grandmaId, relationType: 'Predator-Prey' },
    { id: ulid(), charId1: hunterId, charId2: redId, relationType: 'Protector' },
    { id: ulid(), charId1: hunterId, charId2: grandmaId, relationType: 'Protector' },
  ])
  console.log('Red Riding Hood character relations created.')

  // Tags for Red Riding Hood story
  const redTagFairyTaleId = ulid()
  const redTagAdventureId = ulid()
  await db.insert(schema.tags).values([
    {
      id: redTagFairyTaleId,
      storyId: redStoryId,
      name: 'Fairy Tale',
      color: '#FFD700',
      isFavorite: true,
      extraNotes: 'Classic genre.',
    },
    {
      id: redTagAdventureId,
      storyId: redStoryId,
      name: 'Adventure',
      color: '#32CD32',
      isFavorite: true,
      extraNotes: 'Exciting journey.',
    },
  ])
  console.log('Red Riding Hood tags created.')

  // Relational Tags for Red Riding Hood story
  await db.insert(schema.characterTags).values([
    { characterId: redId, tagId: redTagFairyTaleId },
    { characterId: redId, tagId: redTagAdventureId },
  ])
  await db.insert(schema.locationTags).values([{ locationId: forestId, tagId: redTagAdventureId }])
  await db
    .insert(schema.chapterTags)
    .values([{ chapterId: redChapter1Id, tagId: redTagAdventureId }])
  await db.insert(schema.sceneTags).values([{ sceneId: redScene1_2Id, tagId: redTagAdventureId }])
  console.log('Red Riding Hood relational tags created.')

  // Notes for Red Riding Hood story
  await db
    .insert(schema.notes)
    .values([
      {
        id: ulid(),
        storyId: redStoryId,
        title: 'Moral of the Story',
        body: 'Always listen to your mother and do not talk to strangers.',
        galleryId: null,
        isFavorite: true,
      },
    ])
  console.log('Red Riding Hood notes created.')

  // World Rules for Red Riding Hood story
  await db
    .insert(schema.worldRules)
    .values([
      {
        id: ulid(),
        storyId: redStoryId,
        title: 'Forest Dangers',
        description: 'The forest is home to wild animals and should be traversed with caution.',
        isFavorite: false,
        extraNotes: 'A warning for travelers.',
      },
    ])
  console.log('Red Riding Hood world rules created.')

  // Suggestions for Red Riding Hood story
  await db.insert(schema.suggestions).values([
    {
      id: ulid(),
      userId: redUser,
      scope: 'global',
      type: 'Genre',
      value: 'Fantasy',
      isDefault: true,
    },
    {
      id: ulid(),
      userId: redUser,
      scope: 'story',
      storyId: redStoryId,
      type: 'Character Trait',
      value: 'Brave',
      isDefault: false,
    },
  ])
  console.log('Red Riding Hood suggestions created.')

  // --- Hansel and Gretel Story (Branching) ---

  // Create a user for Hansel and Gretel
  const hanselUser = ulid()
  await db.insert(schema.users).values({
    id: hanselUser,
    username: 'hansel_gretel_fan',
    // Hash de test_password2
    passwordHash: '$2a$10$xEe/ZUCzaAz/0vdnd6wj.ODTYWNja/6nZO92yj/AAA8ACwByI.m8a', // Placeholder: In a real app, this would be a proper bcrypt hash generated by the password hasher service.
    passwordSalt: 'some_salt', // Placeholder: In a real app, this would be a proper bcrypt salt generated by the password hasher service.
  })
  console.log('Hansel and Gretel user created.')

  // Create the Hansel and Gretel story
  const hanselStoryId = ulid()
  await db.insert(schema.story).values({
    id: hanselStoryId,
    userId: hanselUser,
    type: 'branching',
    title: 'Hansel and Gretel',
    summary:
      'A classic fairy tale about two children abandoned in the forest who find a gingerbread house and encounter a witch.',
    genre: 'Fairy Tale',
    language: 'English',
    isFavorite: true,
    extraNotes: 'This is a test branching story for seeding purposes.',
  })
  console.log('Hansel and Gretel story created.')

  // Create characters for Hansel and Gretel
  const hanselId = ulid()
  const gretelId = ulid()
  const stepmotherId = ulid()
  const fatherId = ulid()
  const witchId = ulid()

  await db.insert(schema.characters).values([
    {
      id: hanselId,
      storyId: hanselStoryId,
      name: 'Hansel',
      gender: 'Male',
      description: 'A clever and resourceful boy.',
      personality: 'Clever, resourceful',
      motivation: 'To protect his sister and find food.',
      qualities: 'Quick-witted, brave',
      weaknesses: 'Impulsive',
      biography: 'Abandoned in the forest with his sister.',
      plannedTimeline: 'Leaves breadcrumbs, caged by witch, escapes.',
      extraNotes: 'Always thinking.',
    },
    {
      id: gretelId,
      storyId: hanselStoryId,
      name: 'Gretel',
      gender: 'Female',
      description: 'A brave and quick-thinking girl.',
      personality: 'Brave, quick-thinking',
      motivation: 'To escape the witch and save her brother.',
      qualities: 'Decisive, observant',
      weaknesses: 'Fearful (initially)',
      biography: 'Abandoned in the forest with her brother.',
      plannedTimeline: 'Tricks witch, escapes, finds way home.',
      extraNotes: 'The one who outsmarts the witch.',
    },
    {
      id: stepmotherId,
      storyId: hanselStoryId,
      name: 'Stepmother',
      gender: 'Female',
      description: 'Cruel and convinces the father to abandon the children.',
      personality: 'Cruel, selfish',
      motivation: 'To save food for herself and her husband.',
      qualities: 'Persuasive',
      weaknesses: 'Greedy, heartless',
      biography: "Hansel and Gretel's stepmother.",
      plannedTimeline: 'Convinces father to abandon children.',
      extraNotes: 'Driven by poverty.',
    },
    {
      id: fatherId,
      storyId: hanselStoryId,
      name: 'Father',
      gender: 'Male',
      description: 'Weak-willed, reluctantly abandons his children.',
      personality: 'Weak-willed, remorseful',
      motivation: 'To survive poverty, but regrets his actions.',
      qualities: 'None (initially)',
      weaknesses: 'Easily swayed, lacks courage',
      biography: 'A poor woodcutter.',
      plannedTimeline: 'Abandons children, later reunited.',
      extraNotes: 'Regrets his decision.',
    },
    {
      id: witchId,
      storyId: hanselStoryId,
      name: 'Witch',
      gender: 'Female',
      description: 'An evil old woman who lives in a gingerbread house and preys on children.',
      personality: 'Evil, deceptive, greedy',
      motivation: 'To fatten and eat children.',
      qualities: 'Cunning, patient',
      weaknesses: 'Blind, easily tricked',
      biography: 'Lives in a gingerbread house in the forest.',
      plannedTimeline: 'Captures children, gets tricked and pushed into oven.',
      extraNotes: 'Appears frail but is powerful.',
    },
  ])
  console.log('Hansel and Gretel characters created.')

  // Create locations for Hansel and Gretel
  const poorCottageId = ulid()
  const darkForestId = ulid()
  const gingerbreadHouseId = ulid()
  const witchCageId = ulid()

  await db.insert(schema.locations).values([
    {
      id: poorCottageId,
      storyId: hanselStoryId,
      name: 'Poor Cottage',
      description: 'The humble home of Hansel, Gretel, their father, and stepmother.',
      climate: 'Temperate',
      culture: 'Rural',
      politics: 'None',
      isFavorite: false,
      extraNotes: 'A place of hardship.',
    },
    {
      id: darkForestId,
      storyId: hanselStoryId,
      name: 'Dark Forest',
      description: 'A dense and dangerous forest where the children are abandoned.',
      climate: 'Temperate',
      culture: 'Wilderness',
      politics: 'None',
      isFavorite: false,
      extraNotes: 'A place of peril.',
    },
    {
      id: gingerbreadHouseId,
      storyId: hanselStoryId,
      name: 'Gingerbread House',
      description: 'An enticing house made of sweets, home to the witch.',
      climate: 'Temperate',
      culture: 'Magical',
      politics: 'None',
      isFavorite: true,
      extraNotes: 'A deceptive trap.',
    },
    {
      id: witchCageId,
      storyId: hanselStoryId,
      name: "Witch's Cage",
      description: 'A small, dark cage inside the gingerbread house.',
      climate: 'Indoor',
      culture: 'Captivity',
      politics: 'Oppression',
      isFavorite: false,
      extraNotes: 'Where Hansel was kept.',
    },
  ])
  console.log('Hansel and Gretel locations created.')

  // Create chapters for Hansel and Gretel
  const hgChapter1Id = ulid()
  const hgChapter2Id = ulid()
  const hgChapter3Id = ulid()
  const hgChapter4Id = ulid()

  await db.insert(schema.chapters).values([
    {
      id: hgChapter1Id,
      storyId: hanselStoryId,
      name: 'Abandonment',
      index: 1,
      summary: 'Hansel and Gretel are led into the forest and left behind.',
      isFavorite: false,
      extraNotes: 'The beginning of their ordeal.',
    },
    {
      id: hgChapter2Id,
      storyId: hanselStoryId,
      name: 'The Sweet Trap',
      index: 2,
      summary: 'The children discover a magical gingerbread house.',
      isFavorite: true,
      extraNotes: 'A deceptive allure.',
    },
    {
      id: hgChapter3Id,
      storyId: hanselStoryId,
      name: 'Captivity and Cunning',
      index: 3,
      summary: 'Hansel and Gretel are imprisoned by the witch and plan their escape.',
      isFavorite: false,
      extraNotes: 'The struggle for freedom.',
    },
    {
      id: hgChapter4Id,
      storyId: hanselStoryId,
      name: 'The Return Home',
      index: 4,
      summary: 'The children escape the witch and find their way back to their father.',
      isFavorite: true,
      extraNotes: 'A happy ending.',
    },
  ])
  console.log('Hansel and Gretel chapters created.')

  // Create scenes for Hansel and Gretel
  const hgScene1_1Id = ulid() // Left in Forest
  const hgScene1_2Id = ulid() // Breadcrumbs Eaten
  const hgScene1_3Id = ulid() // Deeper into the Forest
  const hgScene2_1Id = ulid() // Finding Gingerbread House
  const hgScene2_2Id = ulid() // Eating the House
  const hgScene2_3Id = ulid() // Knocking on the Door
  const hgScene3_1Id = ulid() // Witch Appears
  const hgScene3_2Id = ulid() // Captivity
  const hgScene3_3Id = ulid() // Failed Escape Attempt
  const hgScene3_4Id = ulid() // The Oven Trick
  const hgScene4_1Id = ulid() // Escape and Riches
  const hgScene4_2Id = ulid() // Finding the Way Home
  const hgScene4_3Id = ulid() // Reunion

  await db.insert(schema.scenes).values([
    {
      id: hgScene1_1Id,
      chapterId: hgChapter1Id,
      locationId: darkForestId,
      name: 'Left in the Forest',
      index: 1,
      summary: 'Hansel and Gretel realize they are alone.',
      gap: '0 minutes',
      duration: '30 minutes',
      isFavorite: false,
      extraNotes: 'The initial abandonment.',
    },
    {
      id: hgScene1_2Id,
      chapterId: hgChapter1Id,
      locationId: darkForestId,
      name: 'Breadcrumbs Eaten',
      index: 2,
      summary: 'Birds have eaten the breadcrumbs, leaving them lost.',
      gap: '1 hour',
      duration: '10 minutes',
      isFavorite: false,
      extraNotes: 'Their hope is lost.',
    },
    {
      id: hgScene1_3Id,
      chapterId: hgChapter1Id,
      locationId: darkForestId,
      name: 'Deeper into the Forest',
      index: 3,
      summary: 'The children wander further, becoming more disoriented.',
      gap: '2 hours',
      duration: '45 minutes',
      isFavorite: false,
      extraNotes: 'Increasing despair.',
    },
    {
      id: hgScene2_1Id,
      chapterId: hgChapter2Id,
      locationId: gingerbreadHouseId,
      name: 'Finding the Gingerbread House',
      index: 1,
      summary: 'Hansel and Gretel stumble upon a house made of sweets.',
      gap: '30 minutes',
      duration: '10 minutes',
      isFavorite: true,
      extraNotes: 'A beacon of hope.',
    },
    {
      id: hgScene2_2Id,
      chapterId: hgChapter2Id,
      locationId: gingerbreadHouseId,
      name: 'Eating the House',
      index: 2,
      summary: 'The children eagerly munch on the delicious walls.',
      gap: '5 minutes',
      duration: '15 minutes',
      isFavorite: false,
      extraNotes: 'Indulgence.',
    },
    {
      id: hgScene2_3Id,
      chapterId: hgChapter2Id,
      locationId: gingerbreadHouseId,
      name: 'Knocking on the Door',
      index: 3,
      summary: 'A frail voice invites them inside.',
      gap: '0 minutes',
      duration: '5 minutes',
      isFavorite: false,
      extraNotes: 'The trap is set.',
    },
    {
      id: hgScene3_1Id,
      chapterId: hgChapter3Id,
      locationId: gingerbreadHouseId,
      name: 'Witch Appears',
      index: 1,
      summary: 'An old woman emerges, seemingly kind but with sinister intentions.',
      gap: '0 minutes',
      duration: '10 minutes',
      isFavorite: false,
      extraNotes: 'The true nature revealed.',
    },
    {
      id: hgScene3_2Id,
      chapterId: hgChapter3Id,
      locationId: witchCageId,
      name: 'Captivity',
      index: 2,
      summary: 'Hansel is locked in a cage, and Gretel is forced to work.',
      gap: '1 day',
      duration: '30 minutes',
      isFavorite: false,
      extraNotes: "The children's plight.",
    },
    {
      id: hgScene3_3Id,
      chapterId: hgChapter3Id,
      locationId: witchCageId,
      name: 'Failed Escape Attempt',
      index: 3,
      summary: "Hansel's attempt fails, leading to harsher treatment.",
      gap: '1 day',
      duration: '10 minutes',
      isFavorite: false,
      extraNotes: 'A setback.',
    },
    {
      id: hgScene3_4Id,
      chapterId: hgChapter3Id,
      locationId: gingerbreadHouseId,
      name: 'The Oven Trick',
      index: 4,
      summary: 'Gretel tricks the witch into looking in the oven, then pushes her in.',
      gap: '0 minutes',
      duration: '15 minutes',
      isFavorite: true,
      extraNotes: "Gretel's cleverness.",
    },
    {
      id: hgScene4_1Id,
      chapterId: hgChapter4Id,
      locationId: gingerbreadHouseId,
      name: 'Escape and Riches',
      index: 1,
      summary: "The children escape, taking the witch's treasures.",
      gap: '0 minutes',
      duration: '20 minutes',
      isFavorite: true,
      extraNotes: 'The reward.',
    },
    {
      id: hgScene4_2Id,
      chapterId: hgChapter4Id,
      locationId: darkForestId,
      name: 'Finding the Way Home',
      index: 2,
      summary: 'With the witch gone, the forest seems less threatening, and they find their way.',
      gap: '1 day',
      duration: '2 hours',
      isFavorite: false,
      extraNotes: 'The journey back.',
    },
    {
      id: hgScene4_3Id,
      chapterId: hgChapter4Id,
      locationId: poorCottageId,
      name: 'Reunion',
      index: 3,
      summary: 'Hansel and Gretel return home to their repentant father.',
      gap: '0 minutes',
      duration: '10 minutes',
      isFavorite: true,
      extraNotes: 'A bittersweet ending.',
    },
  ])
  console.log('Hansel and Gretel scenes created.')

  // Create choices for Hansel and Gretel (Branching Logic)
  await db.insert(schema.choices).values([
    {
      id: ulid(),
      sceneId: hgScene1_1Id,
      nextSceneId: hgScene1_2Id,
      text: 'Follow the trail of breadcrumbs Hansel left.',
      isImplicit: false,
    },
    {
      id: ulid(),
      sceneId: hgScene1_1Id,
      nextSceneId: hgScene1_3Id,
      text: 'Explore deeper into the unknown forest.',
      isImplicit: false,
    },
    {
      id: ulid(),
      sceneId: hgScene2_1Id,
      nextSceneId: hgScene2_2Id,
      text: 'Start eating pieces of the house.',
      isImplicit: false,
    },
    {
      id: ulid(),
      sceneId: hgScene2_1Id,
      nextSceneId: hgScene2_3Id,
      text: 'Knock on the door to see who lives there.',
      isImplicit: false,
    },
    {
      id: ulid(),
      sceneId: hgScene3_2Id,
      nextSceneId: hgScene3_3Id,
      text: 'Hansel tries to escape the cage immediately.',
      isImplicit: false,
    },
    {
      id: ulid(),
      sceneId: hgScene3_2Id,
      nextSceneId: hgScene3_4Id,
      text: 'Gretel pretends to be naive about the oven.',
      isImplicit: false,
    },
  ])
  console.log('Hansel and Gretel choices created.')

  // Create moments for Hansel and Gretel
  await db.insert(schema.moments).values([
    {
      id: ulid(),
      sceneId: hgScene1_1Id,
      name: 'Abandoned',
      location: 'Dark Forest',
      index: 1,
      summary: 'The children are left alone in the dark forest.',
      isFavorite: false,
      extraNotes: 'The beginning of their ordeal.',
    },
    {
      id: ulid(),
      sceneId: hgScene1_2Id,
      name: 'Breadcrumbs Gone',
      location: 'Dark Forest',
      index: 1,
      summary: 'The breadcrumbs are gone, leaving them truly lost.',
      isFavorite: false,
      extraNotes: 'Their hope is lost.',
    },
    {
      id: ulid(),
      sceneId: hgScene1_3Id,
      name: 'Lost Deeper',
      location: 'Dark Forest',
      index: 1,
      summary: 'They wander deeper, the forest growing darker.',
      isFavorite: false,
      extraNotes: 'Increasing despair.',
    },
    {
      id: ulid(),
      sceneId: hgScene2_1Id,
      name: 'Sweet Scent',
      location: 'Dark Forest',
      index: 1,
      summary: 'A delicious scent leads them to a house made of candy.',
      isFavorite: false,
      extraNotes: 'A beacon of hope.',
    },
    {
      id: ulid(),
      sceneId: hgScene2_2Id,
      name: 'Feasting',
      location: 'Gingerbread House',
      index: 1,
      summary: 'They eagerly eat from the gingerbread house.',
      isFavorite: false,
      extraNotes: 'Indulgence.',
    },
    {
      id: ulid(),
      sceneId: hgScene2_3Id,
      name: 'Invitation',
      location: 'Gingerbread House',
      index: 1,
      summary: 'An old woman invites them inside.',
      isFavorite: false,
      extraNotes: 'The trap is set.',
    },
    {
      id: ulid(),
      sceneId: hgScene3_1Id,
      name: "Witch's Welcome",
      location: 'Gingerbread House',
      index: 1,
      summary: 'The seemingly kind old woman reveals her true nature.',
      isFavorite: false,
      extraNotes: 'The true nature revealed.',
    },
    {
      id: ulid(),
      sceneId: hgScene3_2Id,
      name: 'Imprisoned',
      location: "Witch's Cage",
      index: 1,
      summary: 'Hansel is caged, Gretel is forced to be a servant.',
      isFavorite: false,
      extraNotes: "The children's plight.",
    },
    {
      id: ulid(),
      sceneId: hgScene3_3Id,
      name: 'Failed Attempt',
      location: "Witch's Cage",
      index: 1,
      summary: "Hansel's escape attempt is thwarted.",
      isFavorite: false,
      extraNotes: 'A setback.',
    },
    {
      id: ulid(),
      sceneId: hgScene3_4Id,
      name: 'Witch in Oven',
      location: 'Gingerbread House',
      index: 1,
      summary: 'Gretel tricks the witch and pushes her into the oven.',
      isFavorite: true,
      extraNotes: "Gretel's cleverness.",
    },
    {
      id: ulid(),
      sceneId: hgScene4_1Id,
      name: 'Treasures',
      location: 'Gingerbread House',
      index: 1,
      summary: "They find jewels and gold in the witch's house.",
      isFavorite: true,
      extraNotes: 'The reward.',
    },
    {
      id: ulid(),
      sceneId: hgScene4_2Id,
      name: 'Path Home',
      location: 'Dark Forest',
      index: 1,
      summary: 'The forest seems less daunting as they find their way.',
      isFavorite: false,
      extraNotes: 'The journey back.',
    },
    {
      id: ulid(),
      sceneId: hgScene4_3Id,
      name: 'Happy Reunion',
      location: 'Poor Cottage',
      index: 1,
      summary: 'They are reunited with their father, who regrets his actions.',
      isFavorite: true,
      extraNotes: 'A bittersweet ending.',
    },
  ])
  console.log('Hansel and Gretel moments created.')

  // Character Moments for Hansel and Gretel
  await db.insert(schema.characterMoments).values([
    {
      characterId: hanselId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Abandoned'), eq(moments.location, 'Dark Forest')),
      }))!.id,
    },
    {
      characterId: gretelId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Abandoned'), eq(moments.location, 'Dark Forest')),
      }))!.id,
    },
    {
      characterId: hanselId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Breadcrumbs Gone'), eq(moments.location, 'Dark Forest')),
      }))!.id,
    },
    {
      characterId: gretelId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Breadcrumbs Gone'), eq(moments.location, 'Dark Forest')),
      }))!.id,
    },
    {
      characterId: hanselId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Lost Deeper'), eq(moments.location, 'Dark Forest')),
      }))!.id,
    },
    {
      characterId: gretelId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Lost Deeper'), eq(moments.location, 'Dark Forest')),
      }))!.id,
    },
    {
      characterId: hanselId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Sweet Scent'), eq(moments.location, 'Dark Forest')),
      }))!.id,
    },
    {
      characterId: gretelId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Sweet Scent'), eq(moments.location, 'Dark Forest')),
      }))!.id,
    },
    {
      characterId: hanselId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Feasting'), eq(moments.location, 'Gingerbread House')),
      }))!.id,
    },
    {
      characterId: gretelId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Feasting'), eq(moments.location, 'Gingerbread House')),
      }))!.id,
    },
    {
      characterId: hanselId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Invitation'), eq(moments.location, 'Gingerbread House')),
      }))!.id,
    },
    {
      characterId: gretelId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Invitation'), eq(moments.location, 'Gingerbread House')),
      }))!.id,
    },
    {
      characterId: witchId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Invitation'), eq(moments.location, 'Gingerbread House')),
      }))!.id,
    },
    {
      characterId: witchId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, "Witch's Welcome"), eq(moments.location, 'Gingerbread House')),
      }))!.id,
    },
    {
      characterId: hanselId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Imprisoned'), eq(moments.location, "Witch's Cage")),
      }))!.id,
    },
    {
      characterId: gretelId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Imprisoned'), eq(moments.location, "Witch's Cage")),
      }))!.id,
    },
    {
      characterId: witchId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Imprisoned'), eq(moments.location, "Witch's Cage")),
      }))!.id,
    },
    {
      characterId: hanselId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Failed Attempt'), eq(moments.location, "Witch's Cage")),
      }))!.id,
    },
    {
      characterId: witchId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Failed Attempt'), eq(moments.location, "Witch's Cage")),
      }))!.id,
    },
    {
      characterId: gretelId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Witch in Oven'), eq(moments.location, 'Gingerbread House')),
      }))!.id,
    },
    {
      characterId: witchId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Witch in Oven'), eq(moments.location, 'Gingerbread House')),
      }))!.id,
    },
    {
      characterId: hanselId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Treasures'), eq(moments.location, 'Gingerbread House')),
      }))!.id,
    },
    {
      characterId: gretelId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Treasures'), eq(moments.location, 'Gingerbread House')),
      }))!.id,
    },
    {
      characterId: hanselId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Path Home'), eq(moments.location, 'Dark Forest')),
      }))!.id,
    },
    {
      characterId: gretelId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Path Home'), eq(moments.location, 'Dark Forest')),
      }))!.id,
    },
    {
      characterId: hanselId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Happy Reunion'), eq(moments.location, 'Poor Cottage')),
      }))!.id,
    },
    {
      characterId: gretelId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Happy Reunion'), eq(moments.location, 'Poor Cottage')),
      }))!.id,
    },
    {
      characterId: fatherId,
      momentId: (await db.query.moments.findFirst({
        where: (moments, { and, eq }) =>
          and(eq(moments.name, 'Happy Reunion'), eq(moments.location, 'Poor Cottage')),
      }))!.id,
    },
  ])
  console.log('Hansel and Gretel character moments created.')

  // Character Relations for Hansel and Gretel
  await db.insert(schema.characterRelations).values([
    { id: ulid(), charId1: hanselId, charId2: gretelId, relationType: 'Sibling' },
    { id: ulid(), charId1: hanselId, charId2: stepmotherId, relationType: 'Stepson-Stepmother' },
    {
      id: ulid(),
      charId1: gretelId,
      charId2: stepmotherId,
      relationType: 'Stepdaughter-Stepmother',
    },
    { id: ulid(), charId1: hanselId, charId2: fatherId, relationType: 'Son-Father' },
    { id: ulid(), charId1: gretelId, charId2: fatherId, relationType: 'Daughter-Father' },
    { id: ulid(), charId1: witchId, charId2: hanselId, relationType: 'Captor-Captive' },
    { id: ulid(), charId1: witchId, charId2: gretelId, relationType: 'Captor-Captive' },
  ])
  console.log('Hansel and Gretel character relations created.')

  // Tags for Hansel and Gretel story
  const hgTagFairyTaleId = ulid()
  const hgTagSurvivalId = ulid()
  await db.insert(schema.tags).values([
    {
      id: hgTagFairyTaleId,
      storyId: hanselStoryId,
      name: 'Fairy Tale',
      color: '#FFD700',
      isFavorite: true,
      extraNotes: 'Classic genre.',
    },
    {
      id: hgTagSurvivalId,
      storyId: hanselStoryId,
      name: 'Survival',
      color: '#8B4513',
      isFavorite: true,
      extraNotes: 'Struggle for existence.',
    },
  ])
  console.log('Hansel and Gretel tags created.')

  // Relational Tags for Hansel and Gretel story
  await db.insert(schema.characterTags).values([
    { characterId: hanselId, tagId: hgTagFairyTaleId },
    { characterId: gretelId, tagId: hgTagFairyTaleId },
    { characterId: hanselId, tagId: hgTagSurvivalId },
    { characterId: gretelId, tagId: hgTagSurvivalId },
  ])
  await db.insert(schema.locationTags).values([
    { locationId: darkForestId, tagId: hgTagSurvivalId },
    { locationId: gingerbreadHouseId, tagId: hgTagFairyTaleId },
  ])
  await db.insert(schema.chapterTags).values([
    { chapterId: hgChapter1Id, tagId: hgTagSurvivalId },
    { chapterId: hgChapter2Id, tagId: hgTagFairyTaleId },
  ])
  await db.insert(schema.sceneTags).values([
    { sceneId: hgScene1_1Id, tagId: hgTagSurvivalId },
    { sceneId: hgScene2_1Id, tagId: hgTagFairyTaleId },
  ])
  console.log('Hansel and Gretel relational tags created.')

  // Notes for Hansel and Gretel story
  await db
    .insert(schema.notes)
    .values([
      {
        id: ulid(),
        storyId: hanselStoryId,
        title: "The Witch's Weakness",
        body: "The witch is blind and relies on touch to check Hansel's fatness.",
        galleryId: null,
        isFavorite: false,
      },
    ])
  console.log('Hansel and Gretel notes created.')

  // World Rules for Hansel and Gretel story
  await db
    .insert(schema.worldRules)
    .values([
      {
        id: ulid(),
        storyId: hanselStoryId,
        title: 'Magic in the Forest',
        description:
          'The forest contains magical elements, including talking animals and enchanted houses.',
        isFavorite: true,
        extraNotes: 'Explains the fantastical elements.',
      },
    ])
  console.log('Hansel and Gretel world rules created.')

  // Suggestions for Hansel and Gretel story
  await db.insert(schema.suggestions).values([
    {
      id: ulid(),
      userId: hanselUser,
      scope: 'global',
      type: 'Setting',
      value: 'Medieval Village',
      isDefault: true,
    },
    {
      id: ulid(),
      userId: hanselUser,
      scope: 'story',
      storyId: hanselStoryId,
      type: 'Plot Twist',
      value: 'Hidden Magic',
      isDefault: false,
    },
  ])
  console.log('Hansel and Gretel suggestions created.')

  console.log('Seeding complete!')
  await client.end()
}

main().catch((err) => {
  console.error('Seeding failed:', err)
  process.exit(1)
})
