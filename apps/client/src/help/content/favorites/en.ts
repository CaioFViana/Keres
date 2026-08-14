import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('favorites', 'en');
if (!page) throw new Error('Missing help content for favorites/en.');
export default page as HelpPage;
