import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('custom-attributes', 'en');
if (!page) throw new Error('Missing help content for custom-attributes/en.');
export default page as HelpPage;
