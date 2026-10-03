/**
 * @jest-environment node
 */
import {
  adminConversationKey,
  conversationKey,
  directConversationKey,
} from '../../src/utils/conversationKey';

describe('conversationKey', () => {
  it('names a conversation by its server and who it is with', () => {
    expect(conversationKey('srv-1', { kind: 'admin' })).toBe('srv-1|admin');
    expect(conversationKey('srv-1', { kind: 'direct', userId: 'u1' })).toBe('srv-1|u1');
  });

  it('has a shorthand for each kind that gives the same key', () => {
    expect(adminConversationKey('srv-1')).toBe(conversationKey('srv-1', { kind: 'admin' }));
    expect(directConversationKey('srv-1', 'u1')).toBe(
      conversationKey('srv-1', { kind: 'direct', userId: 'u1' }),
    );
  });

  it('tells the same friend apart on two servers', () => {
    expect(directConversationKey('srv-1', 'u1')).not.toBe(directConversationKey('srv-2', 'u1'));
  });
});
