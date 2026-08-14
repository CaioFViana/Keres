import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('story-dashboard', 'pt');
if (!page) throw new Error('Missing help content for story-dashboard/pt.');
export default page as HelpPage;
