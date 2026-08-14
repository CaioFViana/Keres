import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('example-stories', 'pt');
if (!page) throw new Error('Missing help content for example-stories/pt.');
export default page as HelpPage;
