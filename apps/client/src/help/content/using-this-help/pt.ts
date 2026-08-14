import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('using-this-help', 'pt');
if (!page) throw new Error('Missing help content for using-this-help/pt.');
export default page as HelpPage;
