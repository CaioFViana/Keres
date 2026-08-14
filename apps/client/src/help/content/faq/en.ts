import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('faq', 'en');
if (!page) throw new Error('Missing help content for faq/en.');
export default page as HelpPage;
