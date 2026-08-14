import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('account-limits', 'pt');
if (!page) throw new Error('Missing help content for account-limits/pt.');
export default page as HelpPage;
