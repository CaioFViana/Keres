import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('getting-around', 'pt');
if (!page) throw new Error('Missing help content for getting-around/pt.');
export default page as HelpPage;
