import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('choice-conditions', 'pt');
if (!page) throw new Error('Missing help content for choice-conditions/pt.');
export default page as HelpPage;
