import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('scene-timing', 'en');
if (!page) throw new Error('Missing help content for scene-timing/en.');
export default page as HelpPage;
