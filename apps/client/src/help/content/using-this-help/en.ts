import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('using-this-help', 'en');
if (!page) throw new Error('Missing help content for using-this-help/en.');
export default page as HelpPage;
