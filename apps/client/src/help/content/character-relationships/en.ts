import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('character-relationships', 'en');
if (!page) throw new Error('Missing help content for character-relationships/en.');
export default page as HelpPage;
