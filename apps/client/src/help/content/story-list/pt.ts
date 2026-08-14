import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('story-list', 'pt');
if (!page) throw new Error('Missing help content for story-list/pt.');
export default page as HelpPage;
