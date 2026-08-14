import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('scene-timing', 'pt');
if (!page) throw new Error('Missing help content for scene-timing/pt.');
export default page as HelpPage;
