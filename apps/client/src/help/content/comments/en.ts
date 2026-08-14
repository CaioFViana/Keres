import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('comments', 'en');
if (!page) throw new Error('Missing help content for comments/en.');
export default page as HelpPage;
