import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'your-profile',
  title: 'Your profile',
  summary: 'Choose how your account appears on each server.',
  keywords: ['profile', 'avatar', 'bio', 'tag'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'The profile belongs to your account on one server and includes avatar color, icon, and bio. Your @tag is how other people find you.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You choose a gold star and write “fantasy reviewer” so collaborators recognize your account on the server.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Servers from the main menu.',
        'On the wanted server, tap the profile icon.',
        'Choose Avatar color, Avatar icon, and write a Bio of up to 200 characters.',
        'Save. To change your @tag, tap it in the server list and confirm the edit.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'Your avatar and name appear in friendships, collaborators, comments, and public favorites on that server. The profile does not change the app’s local user.',
    },
    { type: 'seeAlso', pages: ['friends', 'collaborators', 'app-settings'] },
  ],
};
export default page;
