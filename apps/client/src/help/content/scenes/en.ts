import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('scenes', 'en');
if (!page) throw new Error('Missing help content for scenes/en.');
export default page as HelpPage;
