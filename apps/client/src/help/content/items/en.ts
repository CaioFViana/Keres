import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('items', 'en');
if (!page) throw new Error('Missing help content for items/en.');
export default page as HelpPage;
