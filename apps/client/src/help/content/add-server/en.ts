import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('add-server', 'en');
if (!page) throw new Error('Missing help content for add-server/en.');
export default page as HelpPage;
