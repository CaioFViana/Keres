import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('chapters', 'en');
if (!page) throw new Error('Missing help content for chapters/en.');
export default page as HelpPage;
