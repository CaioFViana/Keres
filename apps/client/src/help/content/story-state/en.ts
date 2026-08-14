import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('story-state', 'en');
if (!page) throw new Error('Missing help content for story-state/en.');
export default page as HelpPage;
