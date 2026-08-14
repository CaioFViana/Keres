import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('add-server', 'pt');
if (!page) throw new Error('Missing help content for add-server/pt.');
export default page as HelpPage;
