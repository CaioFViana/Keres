import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('friends', 'en');
if (!page) throw new Error('Missing help content for friends/en.');
export default page as HelpPage;
