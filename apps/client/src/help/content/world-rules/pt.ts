import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('world-rules', 'pt');
if (!page) throw new Error('Missing help content for world-rules/pt.');
export default page as HelpPage;
