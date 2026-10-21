import type { HelpPage } from '@/src/content/help/types';
const page: HelpPage = {
  id: 'your-profile',
  title: 'Your profile',
  summary: 'Choose how your account appears on each server.',
  keywords: ['profile', 'avatar', 'bio', 'tag', 'author page', 'biography', 'links', 'showcase'],
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
        'Open Manage Servers from the main menu.',
        'On the wanted server, tap the profile icon.',
        'Choose Avatar color, Avatar icon, and write a Bio of up to 200 characters.',
        'Save. To change your @tag, tap it in the server list and confirm the edit. A tag has 3 to 20 lowercase letters, numbers or underscores - anything else you type (capitals, spaces) is adjusted when it is saved, and the tag shown afterwards is the one that counts.',
      ],
    },
    { type: 'heading', level: 2, text: 'Your author page' },
    {
      type: 'paragraph',
      text: 'Once you publish a story on a server, it gets an author page in that server’s public showcase. Besides the short bio, you can write a longer Biography, add up to 8 Links (a site, a shop, a social profile) and choose a Theme - the palette the page wears. Nothing is shown until you write it, and every field can be cleared.',
    },
    {
      type: 'steps',
      items: [
        'Open Manage Servers, pick the server and tap Author page.',
        'Write your Biography, add your Links (an address typed without https:// is completed for you) and pick a Theme, or keep the site’s own look.',
        'Save, then tap See my page to check how visitors see it.',
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
