import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('lists-and-search', 'en');
if (!page) throw new Error('Missing help content for lists-and-search/en.');
export default page as HelpPage;
