import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('story-map', 'en');
if (!page) throw new Error('Missing help content for story-map/en.');
export default page as HelpPage;
