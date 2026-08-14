import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('friends', 'pt');
if (!page) throw new Error('Missing help content for friends/pt.');
export default page as HelpPage;
