import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('activity-log', 'pt');
if (!page) throw new Error('Missing help content for activity-log/pt.');
export default page as HelpPage;
