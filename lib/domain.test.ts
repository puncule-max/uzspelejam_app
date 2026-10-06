import { resolveGameAccessContext, type DomainContext } from './domain.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
function assertArrayEqual(actual: string[], expected: string[], message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const now = new Date('2026-10-06T12:00:00Z');

function base(overrides: Partial<DomainContext> = {}): DomainContext {
  return {
    now,
    game: {
      creatorId: 'org',
      endsAt: new Date('2026-10-10T12:00:00Z'),
      cancelledAt: null,
      additionalPlayersRequired: 4,
      acceptedPlayersCount: 2,
      visibility: 'public',
      supportsTeams: true,
      supportsPositions: true,
      isPremiumOrganizer: false,
    },
    userId: 'u1',
    participantStatus: null,
    applicationStatus: null,
    waitingStatus: null,
    waitingListPosition: null,
    isFollowing: false,
    canAccessPrivateGame: false,
    isBlockedByOrganizer: false,
    hasBlockedOrganizer: false,
    ratingAlreadySubmitted: false,
    assignedTeamId: null,
    assignedPositionId: null,
    ...overrides,
  };
}

function actionTypes(ctx: DomainContext) {
  return resolveGameAccessContext(ctx).actions.map((a) => a.type);
}

assertEqual(resolveGameAccessContext(base({ userId: null })).userGameState, 'guest', 'guest state');
assertArrayEqual(actionTypes(base({ userId: null })), ['sign_in'], 'guest actions');
assertEqual(resolveGameAccessContext(base()).userGameState, 'viewer', 'viewer state');
assert(actionTypes(base()).includes('join'), 'viewer should join');
assertEqual(resolveGameAccessContext(base({ isFollowing: true })).userGameState, 'follower', 'follower state');
assert(actionTypes(base({ isFollowing: true })).includes('join'), 'follower should join');
assert(actionTypes(base({ isFollowing: true })).includes('edit_follow_preferences'), 'follower preferences');
assertEqual(resolveGameAccessContext(base({ applicationStatus: 'pending' })).userGameState, 'pending', 'pending state');
assert(!actionTypes(base({ applicationStatus: 'pending' })).includes('join'), 'pending must not join twice');
assert(actionTypes(base({ applicationStatus: 'pending' })).includes('withdraw_application'), 'pending can withdraw');
assertEqual(resolveGameAccessContext(base({ waitingStatus: 'active', waitingListPosition: 2 })).userGameState, 'waiting_list', 'waiting state');
assertEqual(resolveGameAccessContext(base({ waitingStatus: 'active', waitingListPosition: 2 })).waitingListPosition, 2, 'waiting position');
assertEqual(resolveGameAccessContext(base({ participantStatus: 'accepted' })).userGameState, 'accepted', 'accepted state');
assertArrayEqual(actionTypes(base({ participantStatus: 'accepted' })), ['open_group_chat', 'leave_game'], 'accepted actions');
assertEqual(resolveGameAccessContext(base({ userId: 'org' })).userGameState, 'organizer', 'organizer state');
assert(actionTypes(base({ userId: 'org' })).includes('manage_game'), 'organizer can manage');

const full = base({ game: { ...base().game, acceptedPlayersCount: 4 } });
assertEqual(resolveGameAccessContext(full).gameStatus, 'fully_booked', 'full status');
assert(actionTypes(full).includes('join_waiting_list'), 'full viewer joins waiting list');

const completed = base({ game: { ...base().game, endsAt: new Date('2026-10-01T12:00:00Z') }, participantStatus: 'accepted' });
assertEqual(resolveGameAccessContext(completed).gameStatus, 'completed', 'completed status');
assertArrayEqual(actionTypes(completed), ['rate_players'], 'completed accepted actions');

const cancelled = base({ game: { ...base().game, cancelledAt: new Date('2026-10-05T12:00:00Z') } });
assertEqual(resolveGameAccessContext(cancelled).gameStatus, 'cancelled', 'cancelled status');
assert(!actionTypes(cancelled).includes('join'), 'cancelled cannot join');

const blocked = base({ isBlockedByOrganizer: true });
assertEqual(resolveGameAccessContext(blocked).permissions.canViewGame, false, 'blocked cannot view');
assertArrayEqual(actionTypes(blocked), [], 'blocked actions');

const priority = base({ participantStatus: 'accepted', applicationStatus: 'pending', waitingStatus: 'active', isFollowing: true });
assertEqual(resolveGameAccessContext(priority).userGameState, 'accepted', 'state priority');

const premiumFullOrganizer = base({
  userId: 'org',
  game: { ...base().game, acceptedPlayersCount: 4, isPremiumOrganizer: true },
});
assert(actionTypes(premiumFullOrganizer).includes('add_more_spots'), 'premium organizer can add spots');

console.log('All domain resolver tests passed');
