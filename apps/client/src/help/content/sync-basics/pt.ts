import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('sync-basics', 'pt');
if (!page) throw new Error('Missing help content for sync-basics/pt.');
export default page as HelpPage;
