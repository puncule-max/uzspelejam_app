export type GameStatus = 'open' | 'fully_booked' | 'completed' | 'cancelled';
export type UserGameState = 'guest' | 'viewer' | 'follower' | 'pending' | 'waiting_list' | 'accepted' | 'organizer';
export type ActionPriority = 'primary' | 'secondary' | 'tertiary' | 'destructive';
export type ActionType =
  | 'sign_in'
  | 'join'
  | 'join_waiting_list'
  | 'follow'
  | 'unfollow'
  | 'edit_follow_preferences'
  | 'message_organizer'
  | 'withdraw_application'
  | 'leave_waiting_list'
  | 'open_group_chat'
  | 'leave_game'
  | 'share'
  | 'manage_game'
  | 'edit_game'
  | 'review_applications'
  | 'cancel_game'
  | 'add_more_spots'
  | 'rate_players'
  | 'report_game';

export interface GameFacts {
  creatorId: string;
  endsAt: Date;
  cancelledAt: Date | null;
  additionalPlayersRequired: number;
  acceptedPlayersCount: number;
  visibility: 'public' | 'private';
  supportsTeams: boolean;
  supportsPositions: boolean;
  isPremiumOrganizer: boolean;
}

export interface DomainContext {
  now: Date;
  game: GameFacts;
  userId: string | null;
  participantStatus: 'accepted' | 'left' | 'removed' | null;
  applicationStatus: 'pending' | 'accepted' | 'declined' | 'withdrawn' | null;
  waitingStatus: 'active' | 'promoted' | 'left' | null;
  waitingListPosition: number | null;
  isFollowing: boolean;
  canAccessPrivateGame: boolean;
  isBlockedByOrganizer: boolean;
  hasBlockedOrganizer: boolean;
  ratingAlreadySubmitted: boolean;
  assignedTeamId: string | null;
  assignedPositionId: string | null;
}

export interface Permissions {
  canViewGame: boolean;
  canViewConfirmedParticipants: boolean;
  canViewPendingApplications: boolean;
  canViewWaitingList: boolean;
  canViewOnlineAccessDetails: boolean;
  canShareGame: boolean;
  canSharePrivateGame: boolean;
  canManageTeams: boolean;
  canManagePositions: boolean;
  canMessageOrganizer: boolean;
  canAccessGroupChat: boolean;
}

export interface ActionDescriptor {
  type: ActionType;
  enabled: boolean;
  priority: ActionPriority;
  requiresConfirmation?: boolean;
}

export interface GameAccessContext {
  gameStatus: GameStatus;
  userGameState: UserGameState;
  remainingPlayers: number;
  permissions: Permissions;
  actions: ActionDescriptor[];
  waitingListPosition: number | null;
  assignedTeamId: string | null;
  assignedPositionId: string | null;
  isFollowing: boolean;
}

export function remainingPlayers(game: GameFacts): number {
  return Math.max(0, game.additionalPlayersRequired - game.acceptedPlayersCount);
}

export function resolveGameStatus(game: GameFacts, now: Date): GameStatus {
  if (game.cancelledAt) return 'cancelled';
  if (game.endsAt.getTime() <= now.getTime()) return 'completed';
  if (remainingPlayers(game) === 0) return 'fully_booked';
  return 'open';
}

export function resolveUserGameState(ctx: DomainContext): UserGameState {
  if (!ctx.userId) return 'guest';
  if (ctx.game.creatorId === ctx.userId) return 'organizer';
  if (ctx.participantStatus === 'accepted') return 'accepted';
  if (ctx.waitingStatus === 'active') return 'waiting_list';
  if (ctx.applicationStatus === 'pending') return 'pending';
  if (ctx.isFollowing) return 'follower';
  return 'viewer';
}

export function resolvePermissions(ctx: DomainContext, state: UserGameState): Permissions {
  const blocked = ctx.isBlockedByOrganizer || ctx.hasBlockedOrganizer;
  const privateAllowed =
    ctx.game.visibility === 'public' ||
    ctx.canAccessPrivateGame ||
    state === 'organizer' ||
    state === 'accepted';
  const canViewGame = privateAllowed && !blocked;

  return {
    canViewGame,
    canViewConfirmedParticipants: canViewGame && state !== 'guest',
    canViewPendingApplications: state === 'organizer',
    canViewWaitingList: state === 'organizer',
    canViewOnlineAccessDetails: state === 'accepted' || state === 'organizer',
    canShareGame: canViewGame && ctx.game.visibility === 'public',
    canSharePrivateGame: state === 'organizer' && ctx.game.visibility === 'private',
    canManageTeams: state === 'organizer' && ctx.game.supportsTeams,
    canManagePositions: state === 'organizer' && ctx.game.supportsPositions,
    canMessageOrganizer:
      !blocked && ['viewer', 'follower', 'pending', 'waiting_list'].includes(state),
    canAccessGroupChat: state === 'accepted' || state === 'organizer',
  };
}

function dedupe(actions: ActionDescriptor[]): ActionDescriptor[] {
  return [...new Map(actions.map((a) => [a.type, a])).values()];
}

export function resolveActions(ctx: DomainContext, state: UserGameState, permissions: Permissions): ActionDescriptor[] {
  if (!permissions.canViewGame) return [];
  const status = resolveGameStatus(ctx.game, ctx.now);
  const actions: ActionDescriptor[] = [];

  if (status === 'cancelled') {
    if (permissions.canShareGame) actions.push({ type: 'share', enabled: true, priority: 'secondary' });
    if (ctx.userId) actions.push({ type: 'report_game', enabled: true, priority: 'tertiary' });
    return actions;
  }

  if (status === 'completed') {
    if ((state === 'accepted' || state === 'organizer') && !ctx.ratingAlreadySubmitted) {
      actions.push({ type: 'rate_players', enabled: true, priority: 'primary' });
    }
    return actions;
  }

  if (state === 'guest') {
    return [{ type: 'sign_in', enabled: true, priority: 'primary' }];
  }

  if (state === 'organizer') {
    actions.push(
      { type: 'manage_game', enabled: true, priority: 'primary' },
      { type: 'edit_game', enabled: true, priority: 'secondary' },
      { type: 'review_applications', enabled: true, priority: 'secondary' },
      { type: 'cancel_game', enabled: true, priority: 'destructive', requiresConfirmation: true },
    );
    if (status === 'fully_booked' && ctx.game.isPremiumOrganizer) {
      actions.push({ type: 'add_more_spots', enabled: true, priority: 'secondary' });
    }
    return dedupe(actions);
  }

  if (state === 'accepted') {
    return [
      { type: 'open_group_chat', enabled: true, priority: 'primary' },
      { type: 'leave_game', enabled: true, priority: 'destructive', requiresConfirmation: true },
    ];
  }

  if (state === 'waiting_list') {
    actions.push({ type: 'leave_waiting_list', enabled: true, priority: 'destructive', requiresConfirmation: true });
    actions.push(ctx.isFollowing
      ? { type: 'edit_follow_preferences', enabled: true, priority: 'secondary' }
      : { type: 'follow', enabled: true, priority: 'secondary' });
    return dedupe(actions);
  }

  if (state === 'pending') {
    if (permissions.canMessageOrganizer) actions.push({ type: 'message_organizer', enabled: true, priority: 'secondary' });
    actions.push({ type: 'withdraw_application', enabled: true, priority: 'destructive', requiresConfirmation: true });
    actions.push(ctx.isFollowing
      ? { type: 'edit_follow_preferences', enabled: true, priority: 'secondary' }
      : { type: 'follow', enabled: true, priority: 'secondary' });
    return dedupe(actions);
  }

  if (state === 'viewer' || state === 'follower') {
    if (status === 'open') actions.push({ type: 'join', enabled: true, priority: 'primary' });
    if (status === 'fully_booked') actions.push({ type: 'join_waiting_list', enabled: true, priority: 'primary' });
    if (permissions.canMessageOrganizer) actions.push({ type: 'message_organizer', enabled: true, priority: 'secondary' });
    if (state === 'follower') {
      actions.push({ type: 'edit_follow_preferences', enabled: true, priority: 'secondary' });
      actions.push({ type: 'unfollow', enabled: true, priority: 'tertiary' });
    } else {
      actions.push({ type: 'follow', enabled: true, priority: 'secondary' });
    }
    if (permissions.canShareGame) actions.push({ type: 'share', enabled: true, priority: 'tertiary' });
  }

  return dedupe(actions);
}

export function resolveGameAccessContext(ctx: DomainContext): GameAccessContext {
  const gameStatus = resolveGameStatus(ctx.game, ctx.now);
  const userGameState = resolveUserGameState(ctx);
  const permissions = resolvePermissions(ctx, userGameState);
  const actions = resolveActions(ctx, userGameState, permissions);

  return {
    gameStatus,
    userGameState,
    remainingPlayers: remainingPlayers(ctx.game),
    permissions,
    actions,
    waitingListPosition: ctx.waitingStatus === 'active' ? ctx.waitingListPosition : null,
    assignedTeamId: ctx.participantStatus === 'accepted' ? ctx.assignedTeamId : null,
    assignedPositionId: ctx.participantStatus === 'accepted' ? ctx.assignedPositionId : null,
    isFollowing: ctx.isFollowing,
  };
}
