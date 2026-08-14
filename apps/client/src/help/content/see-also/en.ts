import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('see-also', 'en');
if (!page) throw new Error('Missing help content for see-also/en.');
export default page as HelpPage;
