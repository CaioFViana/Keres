import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('item-journeys', 'en');
if (!page) throw new Error('Missing help content for item-journeys/en.');
export default page as HelpPage;
