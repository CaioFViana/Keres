import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('gallery', 'pt');
if (!page) throw new Error('Missing help content for gallery/pt.');
export default page as HelpPage;
