import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('branching-basics', 'en');
if (!page) throw new Error('Missing help content for branching-basics/en.');
export default page as HelpPage;
