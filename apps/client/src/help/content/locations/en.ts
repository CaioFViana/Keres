import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('locations', 'en');
if (!page) throw new Error('Missing help content for locations/en.');
export default page as HelpPage;
