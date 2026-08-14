import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('items', 'pt');
if (!page) throw new Error('Missing help content for items/pt.');
export default page as HelpPage;
