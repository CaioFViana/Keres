import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('change-password', 'pt');
if (!page) throw new Error('Missing help content for change-password/pt.');
export default page as HelpPage;
