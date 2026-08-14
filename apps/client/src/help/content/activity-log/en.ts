import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('activity-log', 'en');
if (!page) throw new Error('Missing help content for activity-log/en.');
export default page as HelpPage;
