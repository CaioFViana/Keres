import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('choices', 'en');
if (!page) throw new Error('Missing help content for choices/en.');
export default page as HelpPage;
