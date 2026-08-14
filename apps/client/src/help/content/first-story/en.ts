import { HelpPage } from '../../types';

const page: HelpPage = {
  id: 'first-story', title: 'Creating your first story', summary: 'Go from first launch to an open story in a few steps.', keywords: ['new story', 'first steps', 'example'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    { type: 'paragraph', text: 'Your first story is the space that gathers all the information about one narrative. It starts empty and can grow at your own pace.' },
    { type: 'heading', level: 2, text: 'What it is for' },
    { type: 'example', title: 'Example', text: 'To plan “The Glass City”, you can create the story and record the protagonist and first-scene location today; chapters, rules, and items can wait until they make sense.' },
    { type: 'heading', level: 2, text: 'How to do it' },
    { type: 'path', segments: ['First launch', 'Local username', 'Language', 'Proceed'] },
    { type: 'steps', items: ['Enter a local username with at least three characters and select a language.', 'In the story list, tap the + button.', 'Fill in Title; it is the only field needed to create a story.', 'Choose Linear for one reading sequence or Branching if readers can choose paths.', 'Tap Create story and open the newly created story card.', 'To explore first, open Menu › Example stories and install a copy in the language you want.'] },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    { type: 'paragraph', text: 'The title appears in the list and searches. The type determines whether the Choices menu is available. The story then contains its own characters, locations, chapters, scenes, and other elements.' },
    { type: 'seeAlso', pages: ['create-story', 'story-type', 'example-stories'] },
  ],
};
export default page;
