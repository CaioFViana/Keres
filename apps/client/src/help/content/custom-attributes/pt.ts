import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('custom-attributes', 'pt');
if (!page) throw new Error('Missing help content for custom-attributes/pt.');
export default page as HelpPage;
