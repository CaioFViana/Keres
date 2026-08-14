import { getHelpPage } from '../../content';
import { HelpPage } from '../../types';

const page = getHelpPage('choice-conditions', 'en');
if (!page) throw new Error('Missing help content for choice-conditions/en.');
export default page as HelpPage;
