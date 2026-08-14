import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('story-settings', 'pt');
if (!page) throw new Error('Missing help content for story-settings/pt.');
export default page as HelpPage;
