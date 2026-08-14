import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('suggestions', 'pt');
if (!page) throw new Error('Missing help content for suggestions/pt.');
export default page as HelpPage;
