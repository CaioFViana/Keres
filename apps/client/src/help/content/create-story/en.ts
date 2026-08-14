import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('create-story', 'en');
if (!page) throw new Error('Missing help content for create-story/en.');
export default page as HelpPage;
