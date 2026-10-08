import type { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'messages',
  title: 'Messages',
  summary: 'Write to your friends and to the administrators of a server.',
  keywords: ['message', 'inbox', 'chat', 'administrator', 'friend', 'contact'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'Messages let you talk inside the app: with a friend on a server, or with the administrators of that server. Each conversation is with one person (or with the administrators) on one server.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You ask Joana, a friend, for her opinion on a scene. Another day, you write to the administrators of your server about your account limits, and they answer in the same conversation.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Manage Friendships in the main menu and tap the messages icon to see your conversations.',
        'To start one, tap new message and choose a friend or the administrators of a server. You can also tap the message icon on a friend, or open a friend and use the message icon at the top.',
        'Write your message and tap send. The counter shows how many characters are left, and the line below shows how many messages you can still send today.',
        'A small dot on Manage Friendships in the main menu (and on the Server group while it is folded away), and a mark on the inbox icon, tells you there is a message you have not opened yet; a dot on Manage Servers says the same of a server’s administrators. It disappears when you open that conversation, and it is kept only on this device.',
        'To remove a message only for you, tap its bin icon. To clear a whole conversation, use the bin at the top. The other side keeps their copy.',
      ],
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'You can only write to people who are your friends on that server: if the friendship ends, the conversation leaves your list, and returns if you become friends again. Messages need a connection to the server; they are not kept on the device. Servers limit how many messages you can send to other users per day, depending on your plan, and how many to the administrators. The administrators can see which account wrote to them, but a friend never learns whether you read their message.',
    },
    { type: 'seeAlso', pages: ['friends', 'account-limits', 'what-is-a-server'] },
  ],
};
export default page;
