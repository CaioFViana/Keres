import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('character-relationships', 'pt');
if (!page) throw new Error('Missing help content for character-relationships/pt.');
export default page as HelpPage;
