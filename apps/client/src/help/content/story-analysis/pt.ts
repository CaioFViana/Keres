import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('story-analysis', 'pt');
if (!page) throw new Error('Missing help content for story-analysis/pt.');
export default page as HelpPage;
