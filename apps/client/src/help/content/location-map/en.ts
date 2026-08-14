import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('location-map', 'en');
if (!page) throw new Error('Missing help content for location-map/en.');
export default page as HelpPage;
