import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('your-profile', 'pt');
if (!page) throw new Error('Missing help content for your-profile/pt.');
export default page as HelpPage;
