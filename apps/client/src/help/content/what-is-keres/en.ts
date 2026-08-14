import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('what-is-keres', 'en');
if (!page) throw new Error('Missing help content for what-is-keres/en.');
export default page as HelpPage;
