import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('characters', 'pt');
if (!page) throw new Error('Missing help content for characters/pt.');
export default page as HelpPage;
