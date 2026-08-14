import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('chapters', 'pt');
if (!page) throw new Error('Missing help content for chapters/pt.');
export default page as HelpPage;
