import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('account-limits', 'en');
if (!page) throw new Error('Missing help content for account-limits/en.');
export default page as HelpPage;
