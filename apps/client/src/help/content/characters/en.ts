import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('characters', 'en');
if (!page) throw new Error('Missing help content for characters/en.');
export default page as HelpPage;
