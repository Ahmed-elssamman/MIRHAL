export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
export interface Area {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  color: string;
  icon: string;
  adherence?: number;
  habits?: number;
  goals?: number;
}
export interface Profile {
  showAdditionalNavigation?: boolean | null;
  displayName: string;
  bio: string;
  timezone: string;
  language: 'en' | 'ar';
  theme: 'light' | 'dark' | 'system';
  profileVisibility: 'PRIVATE' | 'FRIENDS';
  shareChallengeScore: boolean;
  shareStreak: boolean;
  notificationsEnabled: boolean;
  reducedMotion: boolean;
  preferredRoutine: string;
  onboardingCompletedAt: string | null;
  avatarUrl: string | null;
}
export interface User {
  id: string;
  email: string;
  role: string;
  emailVerifiedAt: string | null;
  profile: Profile;
  createdAt: string;
}
export interface Goal {
  id: string;
  title: string;
  description: string;
  areaId: string;
  area: Area;
  status: string;
  priority: string;
  strategy: string;
  progress: number;
  manualProgress: number;
  numericValue: number;
  numericTarget: number | null;
  targetDate: string | null;
  startDate: string | null;
  unit: string | null;
  notes: string;
  milestones: Milestone[];
}
export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}
export interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  goalId: string | null;
  goal: { id: string; title: string; area: Area } | null;
  tasks: Pick<Task, 'id' | 'title' | 'status'>[];
  deadline: string | null;
  startDate: string | null;
  milestones: Milestone[];
  health: string;
  notes: string;
}
export interface Task {
  labels: string[];
  startDate: string | null;
  parentId: string | null;
  parent: { id: string; title: string } | null;
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  projectId: string | null;
  goalId: string | null;
  dueDate: string | null;
  estimatedMinutes: number | null;
  project: { id: string; title: string } | null;
}
export interface HabitLog {
  id: string;
  date: string;
  value: number;
  minimum: boolean;
}
export interface Experiment {
  id: string;
  reason: string;
  hypothesis: string;
  adjustment: string;
  createdAt: string;
}
export interface Habit {
  id: string;
  name: string;
  description: string;
  areaId: string;
  area: Area;
  goalId: string | null;
  frequency: string;
  weeklyTarget: number;
  scheduleDays: number[];
  target: number;
  unit: string;
  difficulty: string;
  preferredTime: string;
  minimumAction: string;
  commitment: string;
  startDate: string;
  notes: string;
  whyItMatters: string;
  status: string;
  adherence: number;
  streak: number;
  completedToday: boolean;
  scheduledToday: boolean;
  recoverySuggested: boolean;
  recoveryPattern: boolean;
  logs: HabitLog[];
  experiments: Experiment[];
  failureReason: string;
  nextExperiment: string;
  xpReward: number;
}
export type HabitSummary = Pick<
  Habit,
  | 'id'
  | 'name'
  | 'area'
  | 'target'
  | 'unit'
  | 'xpReward'
  | 'completedToday'
  | 'adherence'
  | 'streak'
  | 'scheduledToday'
>;
export interface Quest {
  id: string;
  title: string;
  description: string;
  area: Area;
  areaId: string;
  progress: number;
  xpReward: number;
  difficulty: string;
  deadline: string;
  encouragement: string;
  completedAt: string | null;
  items: { id: string; title: string; completedAt: string | null }[];
}
export interface XpSummary {
  balance: number;
  earned: number;
  level: {
    current: { number: number; title: string; titleAr: string; minXp: number };
    next?: { number: number; title: string; minXp: number };
    remaining: number;
    progress: number;
  };
  recent: { id: string; type: string; amount: number; direction: string; createdAt: string }[];
}
export interface Achievement {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  icon: string;
  threshold: number;
  progress: number;
  xpReward: number;
  unlockedAt: string | null;
}
export interface Dashboard {
  periodStart: string;
  periodEnd: string;
  historical: boolean;
  periodDays: number;
  periodXp: number;
  profile: Profile;
  date: string;
  xp: XpSummary;
  journey: {
    score: number;
    contributions: { key: string; value: number; weight: number; contribution: number }[];
  };
  areas: Area[];
  habits: HabitSummary[];
  habitCount: number;
  completedHabits: number;
  tasks: Task[];
  quests: Quest[];
  goals: Pick<Goal, 'id' | 'title' | 'area' | 'progress' | 'targetDate'>[];
  checkedIn: boolean;
  activity: { date: string; habits: number; checkIn: boolean }[];
  challengeCount: number;
  achievements: { achievement: Achievement; unlockedAt: string }[];
  checkInCount: number;
  recoveryCount: number;
  weakestHabit: string | null;
}
export interface Reward {
  id: string;
  userId: string | null;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  cost: number;
  icon: string;
  category: string;
  categoryAr: string;
  active: boolean;
  favorite?: boolean;
  cooldownDays: number;
  contexts: string[];
  redemptionLimit: number | null;
}
export interface Redemption {
  id: string;
  costSnapshot: number;
  createdAt: string;
  refundedAt: string | null;
  rating: number | null;
  reward: { title: string; titleAr: string; userId: string | null; icon: string };
}
export interface RewardSaving {
  rewardId: string;
  targetXp: number;
  currentXp: number;
  remainingXp: number;
  progressPercent: number;
  status: 'SAVING' | 'READY' | 'UNAVAILABLE';
  reward: Pick<
    Reward,
    'id' | 'userId' | 'title' | 'titleAr' | 'category' | 'categoryAr' | 'cost' | 'icon' | 'active'
  >;
}
export interface RewardRecommendation {
  reward: Pick<
    Reward,
    'id' | 'userId' | 'title' | 'titleAr' | 'category' | 'categoryAr' | 'cost' | 'contexts'
  >;
  score: number;
  reason:
    | 'favorite'
    | 'enjoyed_category'
    | 'time_match'
    | 'discover'
    | 'chosen_category'
    | 'another_option';
}
export interface Friend {
  id: string;
  status: string;
  incoming: boolean;
  friend: { id: string; profile: { displayName: string; avatarUrl: string | null } };
}
export interface Challenge {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  mode: string;
  scope: string;
  status: string;
  startDate: string;
  endDate: string;
  cooperativeProgress: number | null;
  rules: { target: number; dailyCap: number; lowerIsBetter: boolean; baselineDays: number };
  participants: {
    id: string;
    userId: string;
    displayName: string;
    status: string;
    own: boolean;
    score: number | null;
    progress: number | null;
    streak: number | null;
  }[];
}
export interface Feedback {
  attachments: { id: string; name: string; size: number; mimeType: string }[];
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  anonymous: boolean;
  createdAt: string;
  replies: { id: string; body: string; createdAt: string; internal: boolean }[];
  user?: { profile: { displayName: string } } | null;
}
export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}
export interface CheckIn {
  id: string;
  date: string;
  mood: number;
  energy: number;
  majorWin: string;
  reflection: string;
  recoveryIntention: string;
  difficulty: string;
}
export interface Journey {
  seasons: {
    id: string;
    title: string;
    year: number;
    phases: {
      id: string;
      title: string;
      titleAr: string;
      month: number;
      year: number;
      description: string;
      descriptionAr: string;
    }[];
  }[];
  reflections: {
    id: string;
    year: number;
    month: number;
    biggestWin: string;
    failureReason: string;
    adjustment: string;
    reward: string;
  }[];
  summary: Dashboard;
}

export interface QuestTemplate {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  areaId: string;
  area: Area;
  difficulty: string;
  active: boolean;
  items: { id: string; title: string; titleAr: string; sortOrder: number }[];
}
