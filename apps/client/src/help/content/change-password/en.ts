import { HelpPage } from '../../types';
const page: HelpPage = {
  id: 'change-password',
  title: 'Changing your password',
  summary:
    'Change the password for your account on an added server, get new recovery codes, or recover access with a code.',
  keywords: ['password', 'account', 'server', 'recovery code', 'regenerate', 'forgot password'],
  blocks: [
    { type: 'heading', level: 2, text: 'What it is' },
    {
      type: 'paragraph',
      text: 'This screen changes the account password on the selected server, and can also replace your recovery codes; it does not change the app’s local name.',
    },
    { type: 'heading', level: 2, text: 'What it is for' },
    {
      type: 'example',
      title: 'Example',
      text: 'You want to replace an old password before using the account on another device.',
    },
    { type: 'heading', level: 2, text: 'How to do it' },
    {
      type: 'steps',
      items: [
        'Open Servers from the main menu.',
        'On the wanted server, tap the key icon.',
        'Enter Current password, New password, and Confirm new password.',
        'Save. The new password must meet the minimum length shown by the screen.',
      ],
    },
    { type: 'heading', level: 3, text: "Don't remember your current password?" },
    {
      type: 'paragraph',
      text: 'You can still change the password right here, using a recovery code instead of the current password.',
    },
    {
      type: 'steps',
      items: [
        'On this screen, tap Forgot your current password?.',
        'Enter one of the recovery codes you saved, and the new password you want to use.',
        'Confirm. You keep using the same account, now with the new password.',
      ],
    },
    { type: 'heading', level: 3, text: 'Getting new recovery codes' },
    {
      type: 'paragraph',
      text: 'Below the password form, this screen also lets you replace your recovery codes - useful if you lost the ones you saved when you created the account.',
    },
    {
      type: 'steps',
      items: [
        'Enter Current password (the same field used above).',
        'Tap Regenerate recovery codes and confirm.',
        'Save the new codes shown - like at account creation, they are shown this one time only.',
      ],
    },
    {
      type: 'callout',
      tone: 'warning',
      text: 'Regenerating replaces every previous recovery code. Any you saved before stop working, so only do this if you still know the current password and want a fresh set.',
    },
    { type: 'heading', level: 2, text: 'What it affects elsewhere' },
    {
      type: 'paragraph',
      text: 'The password change applies to the account on that server, whether you used the current password or a recovery code - the server stays added here either way. Regenerating codes replaces which ones can later be used to recover the account. Other devices may need to sign in again with the new password; none of this alters stories or profiles.',
    },
    { type: 'seeAlso', pages: ['add-server', 'your-profile', 'troubleshooting'] },
  ],
};
export default page;
