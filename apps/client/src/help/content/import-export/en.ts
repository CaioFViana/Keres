import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('import-export', 'en');
if (!page) throw new Error('Missing help content for import-export/en.');
export default page as HelpPage;
