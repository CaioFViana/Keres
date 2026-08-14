import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('tags', 'en');
if (!page) throw new Error('Missing help content for tags/en.');
export default page as HelpPage;
