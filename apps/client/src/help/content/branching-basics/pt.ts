import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('branching-basics', 'pt');
if (!page) throw new Error('Missing help content for branching-basics/pt.');
export default page as HelpPage;
