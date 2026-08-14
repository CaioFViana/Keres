import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('effects', 'pt');
if (!page) throw new Error('Missing help content for effects/pt.');
export default page as HelpPage;
