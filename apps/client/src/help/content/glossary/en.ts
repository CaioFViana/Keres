import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('glossary', 'en');
if (!page) throw new Error('Missing help content for glossary/en.');
export default page as HelpPage;
