import { env } from '@/config/env';
import { accessRecordService } from '@/services/compliance/AccessRecordService';
import { ageVerificationService } from '@/services/age-verification/AgeVerificationService';
import { auditService } from '@/services/compliance/AuditService';
import { friendshipService } from './FriendshipService';
import { messageService } from '@/services/messages/MessageService';
import { storyPublicationService } from '@/services/publication/StoryPublicationService';
import { termsAcceptanceService } from '@/services/auth/TermsAcceptanceService';
import { userService } from './UserService';
import { paymentHistoryService } from '@/services/payments/PaymentHistoryService';

/**
 * Everything the server holds about one account, in one answer: the LGPD access and portability
 * right (Art. 18, II and V). Story content itself is not listed - it already lives on the
 * person's device, offline-first, and exports from the app to open formats. Message bodies ride
 * along in the conversation summaries the same way the inbox shows them.
 *
 * `accessRecords` are the account's own sign-in records (the address included) the server keeps by law; the
 * `ageVerification` list is what happened to each sending, never the document (the verification service
 * destroys it at the decision) nor the identity commitment.
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
      accessRecords,
      ageVerification,
      preferences,
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
      accessRecordService.listOwn(userId),
      ageVerificationService.historyFor(userId),
      userService.getPreferences(userId),
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
      accessRecords: { keptDays: env.ACCESS_RECORD_RETENTION_DAYS, items: accessRecords },
      ageVerification,
      // The owner's private preferences: the one flag they hold, not the public profile shape.
      preferences: preferences ? { showNsfw: preferences.showNsfw } : null,
    };
  }
}

export const userDataService = new UserDataService();
