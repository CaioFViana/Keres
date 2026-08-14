import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('app-settings', 'pt');
if (!page) throw new Error('Missing help content for app-settings/pt.');
export default page as HelpPage;
