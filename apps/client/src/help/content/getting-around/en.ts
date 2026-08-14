import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('getting-around', 'en');
if (!page) throw new Error('Missing help content for getting-around/en.');
export default page as HelpPage;
