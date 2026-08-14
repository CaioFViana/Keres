import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('how-keres-organizes', 'pt');
if (!page) throw new Error('Missing help content for how-keres-organizes/pt.');
export default page as HelpPage;
