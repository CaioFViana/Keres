import { describe, expect, it } from 'vitest';
import { fountainFromBody } from '../../../manuscript/screenplay/fountain';
import { placeOfHeading, planFountainImport } from '../../../manuscript/screenplay/fountainImport';
import { parseFountain } from '../../../manuscript/screenplay/fountainParser';

const SCRIPT = `Title: The Last Kettle
Author: Ana Souza

# Act One

= Mom finds the note.

INT. KITCHEN - NIGHT

The kettle whistles. *Nobody* comes.

MOM
(whispering)
Is anyone there?

KID (V.O.)
It's me.

CUT TO:

EXT. GARDEN - DAWN #2#

A **long** shadow.

MOM
You came back.

# Act Two

.THE BASEMENT

Dark.

INT./EXT. CAR - DAY

Rain.
`;

describe('planFountainImport', () => {
  it('reads the title page, a chapter per section and a scene per heading', () => {
    const plan = planFountainImport(SCRIPT);

    expect(plan.title).toBe('The Last Kettle');
    expect(plan.author).toBe('Ana Souza');
    expect(plan.sections.map((section) => section.name)).toEqual(['Act One', 'Act Two']);
    expect(plan.sections[0].scenes.map((scene) => scene.heading)).toEqual([
      'INT. KITCHEN - NIGHT',
      'EXT. GARDEN - DAWN',
    ]);
    expect(plan.sections[1].scenes.map((scene) => scene.heading)).toEqual([
      '.THE BASEMENT',
      'INT./EXT. CAR - DAY',
    ]);
  });

  it('gives a scene the synopsis written above its heading, and who speaks in it', () => {
    const [kitchen, garden] = planFountainImport(SCRIPT).sections[0].scenes;

    expect(kitchen.synopsis).toBe('Mom finds the note.');
    expect(garden.synopsis).toBeNull();
    expect(kitchen.cast).toEqual(['MOM', 'KID']);
    expect(garden.cast).toEqual(['MOM']);
  });

  it('offers the places and the characters it names, counted, and creates nothing', () => {
    const plan = planFountainImport(SCRIPT);

    expect(plan.places).toEqual([
      { name: 'KITCHEN', intExt: 'interior', scenes: 1 },
      { name: 'GARDEN', intExt: 'exterior', scenes: 1 },
      { name: 'THE BASEMENT', intExt: null, scenes: 1 },
      { name: 'CAR', intExt: 'both', scenes: 1 },
    ]);
    expect(plan.characters).toEqual([
      { name: 'MOM', cues: 2 },
      { name: 'KID', cues: 1 },
    ]);
  });

  it('counts a place once however often it is visited, and takes indoors-or-out from the first heading that says', () => {
    const plan = planFountainImport(
      ['.CAFE', 'Quiet.', '', 'INT. CAFE - DAY', 'Busy.', '', 'EXT. CAFE - NIGHT', 'Closed.'].join(
        '\n',
      ),
    );

    expect(plan.places).toEqual([{ name: 'CAFE', intExt: 'interior', scenes: 3 }]);
  });

  it('keeps the heading and every element in the scene text, so it exports back as the same script', () => {
    const plan = planFountainImport(SCRIPT);
    const scenes = plan.sections.flatMap((section) => section.scenes);
    const kinds = (text: string) =>
      parseFountain(text)
        .elements.filter((element) => element.type !== 'section' && element.type !== 'synopsis')
        .map((element) => element.type);

    for (const scene of scenes) {
      const fountain = fountainFromBody(scene.body);
      expect(fountain.split('\n')[0]).toBe(scene.heading);
    }
    const kitchen = fountainFromBody(scenes[0].body);
    expect(kitchen).toContain('(whispering)');
    expect(kitchen).toContain('KID (V.O.)');
    expect(kitchen).toContain('CUT TO:');
    // The same elements in the same order as the source scene.
    const source = parseFountain(
      SCRIPT.slice(SCRIPT.indexOf('INT. KITCHEN'), SCRIPT.indexOf('EXT. GARDEN')),
    );
    expect(kinds(kitchen)).toEqual(
      source.elements.map((element) => element.type).filter((type) => type !== 'synopsis'),
    );
  });

  it('keeps emphasis as the editor holds it', () => {
    const [kitchen, garden] = planFountainImport(SCRIPT).sections[0].scenes;

    expect(kitchen.body).toContain('*Nobody*');
    expect(garden.body).toContain('**long**');
    expect(fountainFromBody(garden.body)).toContain('**long**');
  });

  it('puts what comes before the first heading in a scene of its own, with no heading', () => {
    const plan = planFountainImport('A black screen.\n\nINT. ROOM - DAY\n\nLight.');

    expect(plan.sections).toHaveLength(1);
    expect(plan.sections[0].name).toBeNull();
    expect(plan.sections[0].scenes.map((scene) => scene.heading)).toEqual([
      null,
      'INT. ROOM - DAY',
    ]);
    expect(plan.sections[0].scenes[0].place).toBeNull();
  });

  it('copes with nothing at all', () => {
    expect(planFountainImport('')).toEqual({
      title: null,
      author: null,
      sections: [],
      places: [],
      characters: [],
    });
  });

  it('ignores notes and boneyard like the reader does', () => {
    const plan = planFountainImport(
      'INT. ROOM - DAY\n\nLight. [[a note]]\n\n/* cut this */\n\nMORE LIGHT.',
    );

    const body = plan.sections[0].scenes[0].body;
    expect(body).not.toContain('a note');
    expect(body).not.toContain('cut this');
  });
});

describe('placeOfHeading', () => {
  it.each([
    ['INT. KITCHEN - NIGHT', { name: 'KITCHEN', intExt: 'interior' }],
    ['EXT. THE OLD MILL', { name: 'THE OLD MILL', intExt: 'exterior' }],
    ['INT/EXT CAR - DAY', { name: 'CAR', intExt: 'both' }],
    ['I/E. BOAT', { name: 'BOAT', intExt: 'both' }],
    ['EST. CITY SKYLINE - DAWN', { name: 'CITY SKYLINE', intExt: null }],
    ['.FOREST - LATER', { name: 'FOREST', intExt: null }],
    ["INT. DINER - MOM'S - NIGHT", { name: "DINER - MOM'S", intExt: 'interior' }],
    ['INT. KITCHEN #12#', { name: 'KITCHEN', intExt: 'interior' }],
  ])('%s', (heading, place) => {
    expect(placeOfHeading(heading)).toEqual(place);
  });

  it('has no place for a line that is not a heading', () => {
    expect(placeOfHeading('She walks away.')).toBeNull();
    expect(placeOfHeading('INT. ')).toBeNull();
  });
});
