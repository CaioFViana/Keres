import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('story-analysis', 'en');
if (!page) throw new Error('Missing help content for story-analysis/en.');
export default page as HelpPage;
