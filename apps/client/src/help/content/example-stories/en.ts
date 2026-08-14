import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('example-stories', 'en');
if (!page) throw new Error('Missing help content for example-stories/en.');
export default page as HelpPage;
