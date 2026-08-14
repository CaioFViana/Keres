import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('how-keres-organizes', 'en');
if (!page) throw new Error('Missing help content for how-keres-organizes/en.');
export default page as HelpPage;
