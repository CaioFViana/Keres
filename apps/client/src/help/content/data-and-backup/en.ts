import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('data-and-backup', 'en');
if (!page) throw new Error('Missing help content for data-and-backup/en.');
export default page as HelpPage;
