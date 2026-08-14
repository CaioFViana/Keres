import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('collaborators', 'en');
if (!page) throw new Error('Missing help content for collaborators/en.');
export default page as HelpPage;
