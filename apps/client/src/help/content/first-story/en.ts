import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('first-story', 'en');
if (!page) throw new Error('Missing help content for first-story/en.');
export default page as HelpPage;
