import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('sync-conflicts', 'en');
if (!page) throw new Error('Missing help content for sync-conflicts/en.');
export default page as HelpPage;
