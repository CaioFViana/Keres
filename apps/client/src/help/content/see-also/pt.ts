import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('see-also', 'pt');
if (!page) throw new Error('Missing help content for see-also/pt.');
export default page as HelpPage;
