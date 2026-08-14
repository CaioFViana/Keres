import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('glossary', 'pt');
if (!page) throw new Error('Missing help content for glossary/pt.');
export default page as HelpPage;
