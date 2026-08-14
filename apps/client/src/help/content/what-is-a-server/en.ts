import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('what-is-a-server', 'en');
if (!page) throw new Error('Missing help content for what-is-a-server/en.');
export default page as HelpPage;
