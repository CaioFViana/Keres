import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('location-map', 'pt');
if (!page) throw new Error('Missing help content for location-map/pt.');
export default page as HelpPage;
