import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('data-and-backup', 'pt');
if (!page) throw new Error('Missing help content for data-and-backup/pt.');
export default page as HelpPage;
