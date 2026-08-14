import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('create-story', 'pt');
if (!page) throw new Error('Missing help content for create-story/pt.');
export default page as HelpPage;
