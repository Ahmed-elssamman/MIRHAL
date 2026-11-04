export interface CatalogOption {
  value: string;
  labelKey: string;
}

export interface CatalogField {
  key: string;
  labelKey: string;
  kind: 'text' | 'textarea' | 'number' | 'checkbox' | 'select';
  value: string | number | boolean;
  required?: boolean;
  options?: CatalogOption[];
}

export interface CatalogDefinition {
  titleKey: string;
  descriptionKey: string;
  icon: string;
  fields: CatalogField[];
}

const title: CatalogField = {
  key: 'title',
  labelKey: 'admin.features.content.fields.title',
  kind: 'text',
  value: '',
  required: true,
};

const description: CatalogField = {
  key: 'description',
  labelKey: 'admin.features.content.fields.description',
  kind: 'textarea',
  value: '',
};

const active: CatalogField = {
  key: 'active',
  labelKey: 'admin.features.content.fields.active',
  kind: 'checkbox',
  value: true,
};

export const catalogs: Record<string, CatalogDefinition> = {
  rewards: {
    titleKey: 'admin.features.content.catalogs.rewardsTitle',
    descriptionKey: 'admin.features.content.catalogs.rewardsDescription',
    icon: 'gift',
    fields: [
      title,
      {
        key: 'titleAr',
        labelKey: 'admin.features.content.fields.arabicTitle',
        kind: 'text',
        value: '',
        required: true,
      },
      description,
      {
        key: 'descriptionAr',
        labelKey: 'admin.features.content.fields.arabicDescription',
        kind: 'textarea',
        value: '',
        required: true,
      },
      {
        key: 'cost',
        labelKey: 'admin.features.content.fields.xpCost',
        kind: 'number',
        value: 150,
        required: true,
      },
      {
        key: 'icon',
        labelKey: 'admin.features.content.fields.icon',
        kind: 'select',
        value: 'gift',
        options: [
          { value: 'gift', labelKey: 'admin.features.content.options.gift' },
          { value: 'coffee', labelKey: 'admin.features.content.options.coffee' },
          { value: 'book-open', labelKey: 'admin.features.content.options.book' },
          { value: 'clapperboard', labelKey: 'admin.features.content.options.film' },
          { value: 'sun', labelKey: 'admin.features.content.options.sun' },
          { value: 'heart', labelKey: 'admin.features.content.options.heart' },
        ],
      },
      {
        key: 'category',
        labelKey: 'admin.features.content.fields.category',
        kind: 'text',
        value: 'personal',
      },
      {
        key: 'categoryAr',
        labelKey: 'admin.features.content.fields.arabicCategory',
        kind: 'text',
        value: '',
        required: true,
      },
    ],
  },
  achievements: {
    titleKey: 'admin.features.content.catalogs.achievementsTitle',
    descriptionKey: 'admin.features.content.catalogs.achievementsDescription',
    icon: 'award',
    fields: [
      title,
      {
        key: 'titleAr',
        labelKey: 'admin.features.content.fields.arabicTitle',
        kind: 'text',
        value: '',
        required: true,
      },
      {
        key: 'slug',
        labelKey: 'admin.features.content.fields.uniqueIdentifier',
        kind: 'text',
        value: '',
        required: true,
      },
      description,
      {
        key: 'descriptionAr',
        labelKey: 'admin.features.content.fields.arabicDescription',
        kind: 'textarea',
        value: '',
        required: true,
      },
      {
        key: 'icon',
        labelKey: 'admin.features.content.fields.icon',
        kind: 'select',
        value: 'award',
        options: [
          { value: 'award', labelKey: 'admin.features.content.options.award' },
          { value: 'flame', labelKey: 'admin.features.content.options.flame' },
          { value: 'sprout', labelKey: 'admin.features.content.options.sprout' },
          { value: 'sun', labelKey: 'admin.features.content.options.sun' },
          { value: 'users', labelKey: 'admin.features.content.options.people' },
          { value: 'flag', labelKey: 'admin.features.content.options.flag' },
        ],
      },
      {
        key: 'condition',
        labelKey: 'admin.features.content.fields.unlockCondition',
        kind: 'select',
        value: 'HABIT_COUNT',
        options: [
          { value: 'HABIT_COUNT', labelKey: 'admin.features.content.options.completedHabits' },
          { value: 'CHECK_IN_COUNT', labelKey: 'admin.features.content.options.recordedCheckIns' },
          { value: 'QUEST_COUNT', labelKey: 'admin.features.content.options.completedQuests' },
          {
            value: 'CHALLENGE_COUNT',
            labelKey: 'admin.features.content.options.completedChallenges',
          },
        ],
      },
      {
        key: 'threshold',
        labelKey: 'admin.features.content.fields.requiredCount',
        kind: 'number',
        value: 10,
        required: true,
      },
      {
        key: 'xpReward',
        labelKey: 'admin.features.content.fields.xpReward',
        kind: 'number',
        value: 50,
        required: true,
      },
      {
        key: 'hidden',
        labelKey: 'admin.features.content.fields.hiddenUntilUnlocked',
        kind: 'checkbox',
        value: false,
      },
      active,
    ],
  },
  help: {
    titleKey: 'admin.features.content.catalogs.helpTitle',
    descriptionKey: 'admin.features.content.catalogs.helpDescription',
    icon: 'help',
    fields: [
      title,
      {
        key: 'titleAr',
        labelKey: 'admin.features.content.fields.arabicTitle',
        kind: 'text',
        value: '',
        required: true,
      },
      {
        key: 'slug',
        labelKey: 'admin.features.content.fields.articleIdentifier',
        kind: 'text',
        value: '',
        required: true,
      },
      {
        key: 'body',
        labelKey: 'admin.features.content.fields.englishContent',
        kind: 'textarea',
        value: '',
        required: true,
      },
      {
        key: 'bodyAr',
        labelKey: 'admin.features.content.fields.arabicContent',
        kind: 'textarea',
        value: '',
        required: true,
      },
      {
        key: 'published',
        labelKey: 'admin.features.content.fields.published',
        kind: 'checkbox',
        value: true,
      },
    ],
  },
  announcements: {
    titleKey: 'admin.features.content.catalogs.announcementsTitle',
    descriptionKey: 'admin.features.content.catalogs.announcementsDescription',
    icon: 'bell',
    fields: [
      title,
      {
        key: 'titleAr',
        labelKey: 'admin.features.content.fields.arabicTitle',
        kind: 'text',
        value: '',
        required: true,
      },
      {
        key: 'body',
        labelKey: 'admin.features.content.fields.announcement',
        kind: 'textarea',
        value: '',
        required: true,
      },
      {
        key: 'bodyAr',
        labelKey: 'admin.features.content.fields.arabicAnnouncement',
        kind: 'textarea',
        value: '',
        required: true,
      },
      active,
    ],
  },
};
