import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('import-export', 'pt');
if (!page) throw new Error('Missing help content for import-export/pt.');
export default page as HelpPage;
