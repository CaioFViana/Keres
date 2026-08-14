import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('collaborators', 'pt');
if (!page) throw new Error('Missing help content for collaborators/pt.');
export default page as HelpPage;
