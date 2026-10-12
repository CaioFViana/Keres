import { auditService } from './AuditService';
import { friendshipService } from './FriendshipService';
import { messageService } from './MessageService';
import { storyPublicationService } from './StoryPublicationService';
import { termsAcceptanceService } from './TermsAcceptanceService';
import { userService } from './UserService';
import { paymentHistoryService } from './payments/PaymentHistoryService';

/**
 * Everything the server holds about one account, in one answer: the LGPD access and portability
 * right (Art. 18, II and V). Story content itself is not listed - it already lives on the
 * person's device, offline-first, and exports from the app to open formats. Message bodies ride
 * along in the conversation summaries the same way the inbox shows them.
 */
export class UserDataService {
  async exportForUser(userId: string) {
    const [
      profile,
      legalAcceptances,
      friendships,
      conversations,
      publications,
      payments,
      activity,
    ] = await Promise.all([
      userService.getUserById(userId),
      termsAcceptanceService.history(userId),
      friendshipService.getFriendships(userId),
      messageService.listConversations(userId),
      storyPublicationService.listVisibleTo(userId),
      paymentHistoryService.list(userId, { limit: 100 }),
      auditService.list({
        userId,
        category: 'all',
        outcome: 'all',
        order: 'desc',
        page: 1,
        pageSize: 200,
      }),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      profile: profile ?? null,
      legalAcceptances,
      friendships,
      conversations,
      publications,
      payments,
      activity,
    };
  }
}

export const userDataService = new UserDataService();
