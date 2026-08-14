import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('tags', 'pt');
if (!page) throw new Error('Missing help content for tags/pt.');
export default page as HelpPage;
