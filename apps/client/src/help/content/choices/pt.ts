import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('choices', 'pt');
if (!page) throw new Error('Missing help content for choices/pt.');
export default page as HelpPage;
