import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('story-dashboard', 'en');
if (!page) throw new Error('Missing help content for story-dashboard/en.');
export default page as HelpPage;
