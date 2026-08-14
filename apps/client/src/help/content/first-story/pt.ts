import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('first-story', 'pt');
if (!page) throw new Error('Missing help content for first-story/pt.');
export default page as HelpPage;
