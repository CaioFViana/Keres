import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('change-password', 'en');
if (!page) throw new Error('Missing help content for change-password/en.');
export default page as HelpPage;
