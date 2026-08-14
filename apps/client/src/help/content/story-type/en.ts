import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('story-type', 'en');
if (!page) throw new Error('Missing help content for story-type/en.');
export default page as HelpPage;
