import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('lists-and-search', 'pt');
if (!page) throw new Error('Missing help content for lists-and-search/pt.');
export default page as HelpPage;
