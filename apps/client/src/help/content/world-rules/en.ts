import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('world-rules', 'en');
if (!page) throw new Error('Missing help content for world-rules/en.');
export default page as HelpPage;
