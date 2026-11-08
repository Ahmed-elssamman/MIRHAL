import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TimeoutError } from 'rxjs';

const knownErrorKeys: Readonly<Record<string, string>> = {
  'A linked item could not be found.': 'errors.server.linkedItemNotFound',
  'A request could not be sent to this address.': 'errors.server.requestNotSentAddress',
  'A returned reward cannot be rated.': 'errors.server.returnedRewardCannotRated',
  'An account with this email already exists.': 'errors.server.accountEmailAlreadyExists',
  'Challenge not found.': 'errors.server.challengeNotFound',
  'Challenges can only include accepted friends.':
    'errors.server.challengesOnlyIncludeAcceptedFriends',
  'Choose a PNG or JPEG image up to 2 MB.': 'errors.server.choosePngJpegImage2Mb',
  'Choose a future challenge lasting up to 90 days.':
    'errors.server.chooseFutureChallengeLasting90Days',
  'Choose a habit for this challenge.': 'errors.server.chooseHabitChallenge',
  'Choose a life area.': 'errors.server.chooseLifeArea',
  'Choose distinct friends.': 'errors.server.chooseDistinctFriends',
  'Choose one parent for the milestone.': 'errors.server.chooseOneParentMilestone',
  'Choose the current month or an earlier chapter.':
    'errors.server.chooseCurrentMonthEarlierChapter',
  'Choose the habit you want to bring to this challenge.':
    'errors.server.chooseHabitWantBringChallenge',
  'Choose valid life areas.': 'errors.server.chooseValidLifeAreas',
  'Deleted accounts cannot be reactivated.': 'errors.server.deletedAccountsCannotReactivated',
  'Email could not be delivered. Please try again later.':
    'errors.server.emailNotDeliveredTryAgainLater',
  'Email delivery is not configured.': 'errors.server.emailDeliveryNotConfigured',
  'Email or password is incorrect.': 'errors.server.emailPasswordIncorrect',
  'Email provider is not configured.': 'errors.server.emailProviderNotConfigured',
  'Email verification and password recovery are currently unavailable.':
    'errors.server.emailVerificationPasswordRecoveryCurrentlyUnavailable',
  'Keep this unit until your active challenge ends so recorded values stay comparable.':
    'errors.server.keepUnitActiveChallengeEndsComparable',
  'Only a super administrator can assign roles.': 'errors.server.onlySuperAdministratorAssignRoles',
  'Only a super administrator can manage staff access.':
    'errors.server.onlySuperAdministratorManageStaffAccess',
  'Only pending invitations can be declined.': 'errors.server.onlyPendingInvitationsDeclined',
  'Please sign in again to renew your session.': 'errors.server.signInAgainRenewSession',
  'Please sign in to continue.': 'errors.server.signInContinue',
  'Rewards can be undone within five minutes.': 'errors.server.rewardsUndoneWithinFiveMinutes',
  'Some tasks are linked to another goal. Update their goal links before moving this project.':
    'errors.server.someTasksLinkedGoalUpdateTheirGoalLinksBeforeMovingProject',
  'The end date must be on or after the start date.': 'errors.server.endDateMustOnAfterStartDate',
  'The project belongs to a different goal.': 'errors.server.projectBelongsDifferentGoal',
  'The savings target must cover the current reward cost.':
    'errors.server.savingsTargetMustCoverCurrentRewardCost',
  'This attachment is no longer available.': 'errors.server.attachmentNoLongerAvailable',
  'This challenge has already ended.': 'errors.server.challengeAlreadyEnded',
  'This challenge has ended.': 'errors.server.challengeEnded',
  'This connection is no longer available.': 'errors.server.connectionNoLongerAvailable',
  'This invitation is no longer active.': 'errors.server.invitationNoLongerActive',
  'This link has already been used.': 'errors.server.linkAlreadyBeenUsed',
  'This link has expired or has already been used.': 'errors.server.linkExpiredAlreadyBeenUsed',
  'This request key was already used for another reward.':
    'errors.server.requestKeyWasAlreadyUsedReward',
  'This reward will be ready again after its waiting period.':
    'errors.server.rewardWillReadyAgainAfterWaitingPeriod',
  'This value is above the recording limit.': 'errors.server.valueAboveRecordingLimit',
  'You are getting closer. Earn a little more XP for this reward.':
    'errors.server.gettingCloserEarnLittleMoreXpReward',
  'You can attach up to three images to a conversation.':
    'errors.server.attachThreeImagesConversation',
  'You cannot change your own access.': 'errors.server.cannotChangeOwnAccess',
  'You do not have permission to perform this action.':
    'errors.server.doNotPermissionPerformAction',
  'You have reached the redemption limit for this reward.':
    'errors.server.reachedRedemptionLimitReward',
  'Your account is no longer active.': 'errors.server.accountNoLongerActive',
  'Your password changed. Please sign in again.': 'errors.server.passwordChangedSignInAgain',
  'Your password is incorrect.': 'errors.server.passwordIncorrect',
  'Your permissions have changed.': 'errors.server.permissionsChanged',
  'Your session has expired. Please sign in again.': 'errors.server.sessionExpiredSignInAgain',
  'Please check the highlighted fields.': 'errors.server.checkHighlightedFields',
  'Invalid email or password.': 'errors.server.invalidEmailPassword',
  'Not enough XP for this reward.': 'errors.server.notEnoughXpReward',
  'Insufficient XP.': 'errors.server.insufficientXp',
  'Resume this habit before recording an action.': 'errors.server.resumeHabitBeforeRecordingAction',
  'This habit is not scheduled for today.': 'errors.server.habitNotScheduledToday',
  'Use the minimum action option for a smaller step.':
    'errors.server.useMinimumActionOptionSmallerStep',
  'Choose at least one day for a custom schedule.':
    'errors.server.chooseAtLeastOneDayCustomSchedule',
  'Schedule days must be unique.': 'errors.server.scheduleDaysMustUnique',
  'Numeric goals need a positive target.': 'errors.server.numericGoalsNeedPositiveTarget',
  'Target date must be after the start date.': 'errors.server.targetDateMustAfterStartDate',
  'Choose a deadline within the next month.': 'errors.server.chooseDeadlineWithinNextMonth',
  'This quest has ended. Start a fresh quest with what you learned.':
    'errors.server.questEndedStartFreshQuestWhatLearned',
  'A task cannot be its own ancestor.': 'errors.server.taskCannotOwnAncestor',
  'This action has already been recorded.': 'errors.server.actionAlreadyBeen',
  'We could not find that item.': 'errors.server.weNotFindItem',
  'A linked item is no longer available.': 'errors.server.linkedItemNoLongerAvailable',
};

@Injectable({ providedIn: 'root' })
export class ApiErrors {
  private readonly translations = inject(TranslateService, { optional: true });

  private translate(key: string) {
    return this.translations?.instant(key) ?? key;
  }

  message(error: unknown): string {
    if (error instanceof TimeoutError) return this.translate('errors.connectionTimeout');
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) return this.translate('errors.offline');
      const body: unknown = error.error;
      const serverMessage =
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body.message === 'string'
          ? body.message
          : '';
      const knownKey = knownErrorKeys[serverMessage];
      if (knownKey) return this.translate(knownKey);
      if (this.translations?.currentLang() !== 'ar' && serverMessage) return serverMessage;
      const statusKeys: Readonly<Record<number, string>> = {
        400: 'errors.invalidRequest',
        401: 'errors.signInRequired',
        403: 'errors.accessDenied',
        404: 'errors.notFound',
        409: 'errors.conflict',
        429: 'errors.rateLimited',
      };
      const statusKey = statusKeys[error.status];
      if (statusKey) return this.translate(statusKey);
    }
    return this.translate('errors.generic');
  }
}
