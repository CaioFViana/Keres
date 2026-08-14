import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('scenes', 'pt');
if (!page) throw new Error('Missing help content for scenes/pt.');
export default page as HelpPage;
