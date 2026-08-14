import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('locations', 'pt');
if (!page) throw new Error('Missing help content for locations/pt.');
export default page as HelpPage;
