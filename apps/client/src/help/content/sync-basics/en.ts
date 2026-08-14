import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('sync-basics', 'en');
if (!page) throw new Error('Missing help content for sync-basics/en.');
export default page as HelpPage;
