import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

const arabicMessages: Record<string, string> = {
  'A linked item could not be found.': 'تعذر العثور على أحد العناصر المرتبطة.',
  'A request could not be sent to this address.': 'تعذر إرسال الطلب إلى هذا العنوان.',
  'A returned reward cannot be rated.': 'لا يمكن تقييم مكافأة تمت إعادتها.',
  'An account with this email already exists.': 'يوجد حساب بهذا البريد الإلكتروني بالفعل.',
  'Challenge not found.': 'تعذر العثور على التحدي.',
  'Challenges can only include accepted friends.': 'يمكن أن تضم التحديات الأصدقاء المقبولين فقط.',
  'Choose a PNG or JPEG image up to 2 MB.': 'اختر صورة PNG أو JPEG بحجم لا يتجاوز ٢ ميغابايت.',
  'Choose a future challenge lasting up to 90 days.':
    'اختر تحدياً مستقبلياً لا تتجاوز مدته ٩٠ يوماً.',
  'Choose a habit for this challenge.': 'اختر عادة لهذا التحدي.',
  'Choose a life area.': 'اختر مجالاً من مجالات الحياة.',
  'Choose distinct friends.': 'اختر أصدقاء مختلفين.',
  'Choose one parent for the milestone.': 'اختر هدفاً أو مشروعاً واحداً لهذه المرحلة.',
  'Choose the current month or an earlier chapter.': 'اختر الشهر الحالي أو فصلاً سابقاً.',
  'Choose the habit you want to bring to this challenge.':
    'اختر العادة التي تريد إضافتها إلى هذا التحدي.',
  'Choose valid life areas.': 'اختر مجالات حياة صالحة.',
  'Deleted accounts cannot be reactivated.': 'لا يمكن إعادة تنشيط الحسابات المحذوفة.',
  'Email could not be delivered. Please try again later.':
    'تعذر إرسال البريد الإلكتروني. حاول مرة أخرى لاحقاً.',
  'Email delivery is not configured.': 'خدمة البريد الإلكتروني غير مهيأة.',
  'Email or password is incorrect.': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'Email provider is not configured.': 'مزود البريد الإلكتروني غير مهيأ.',
  'Email verification and password recovery are currently unavailable.':
    'تأكيد البريد الإلكتروني واستعادة كلمة المرور غير متاحين حالياً.',
  'Keep this unit until your active challenge ends so recorded values stay comparable.':
    'احتفظ بهذه الوحدة حتى ينتهي التحدي النشط لتبقى القيم المسجلة قابلة للمقارنة.',
  'Only a super administrator can assign roles.': 'يمكن للمدير العام وحده تعيين الأدوار.',
  'Only a super administrator can manage staff access.':
    'يمكن للمدير العام وحده إدارة صلاحيات فريق العمل.',
  'Only pending invitations can be declined.': 'يمكن رفض الدعوات المعلقة فقط.',
  'Please sign in again to renew your session.': 'سجّل الدخول مجدداً لتجديد جلستك.',
  'Please sign in to continue.': 'سجّل الدخول للمتابعة.',
  'Rewards can be undone within five minutes.': 'يمكن التراجع عن استبدال المكافأة خلال خمس دقائق.',
  'Some tasks are linked to another goal. Update their goal links before moving this project.':
    'بعض المهام مرتبطة بهدف آخر. حدّث ارتباطها بالهدف قبل نقل هذا المشروع.',
  'The end date must be on or after the start date.':
    'يجب أن يكون تاريخ الانتهاء في يوم البداية أو بعده.',
  'The project belongs to a different goal.': 'ينتمي المشروع إلى هدف مختلف.',
  'The savings target must cover the current reward cost.':
    'يجب أن يغطي هدف الادخار تكلفة المكافأة الحالية.',
  'This attachment is no longer available.': 'هذا المرفق لم يعد متاحاً.',
  'This challenge has already ended.': 'انتهى هذا التحدي بالفعل.',
  'This challenge has ended.': 'انتهى هذا التحدي.',
  'This connection is no longer available.': 'هذه الصداقة لم تعد متاحة.',
  'This invitation is no longer active.': 'هذه الدعوة لم تعد نشطة.',
  'This link has already been used.': 'استُخدم هذا الرابط بالفعل.',
  'This link has expired or has already been used.': 'انتهت صلاحية هذا الرابط أو استُخدم بالفعل.',
  'This request key was already used for another reward.':
    'استُخدم مفتاح هذا الطلب لمكافأة أخرى بالفعل.',
  'This reward will be ready again after its waiting period.':
    'ستتاح هذه المكافأة مجدداً بعد انتهاء فترة الانتظار.',
  'This value is above the recording limit.': 'تتجاوز هذه القيمة الحد المسموح بتسجيله.',
  'You are getting closer. Earn a little more XP for this reward.':
    'أنت تقترب. اجمع مزيداً من نقاط الخبرة للحصول على هذه المكافأة.',
  'You can attach up to three images to a conversation.':
    'يمكنك إرفاق ثلاث صور كحد أقصى بالمحادثة.',
  'You cannot change your own access.': 'لا يمكنك تغيير صلاحيات حسابك.',
  'You do not have permission to perform this action.': 'ليس لديك صلاحية تنفيذ هذا الإجراء.',
  'You have reached the redemption limit for this reward.':
    'بلغت الحد المسموح لاستبدال هذه المكافأة.',
  'Your account is no longer active.': 'حسابك لم يعد نشطاً.',
  'Your password changed. Please sign in again.': 'تغيّرت كلمة مرورك. سجّل الدخول مجدداً.',
  'Your password is incorrect.': 'كلمة المرور غير صحيحة.',
  'Your permissions have changed.': 'تغيّرت صلاحيات حسابك.',
  'Your session has expired. Please sign in again.': 'انتهت صلاحية جلستك. سجّل الدخول مجدداً.',
  'Please check the highlighted fields.': 'راجع الحقول الموضحة وأكمل البيانات المطلوبة.',
  'Invalid email or password.': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'Not enough XP for this reward.': 'رصيد نقاطك لا يكفي لهذه المكافأة بعد.',
  'Insufficient XP.': 'رصيد نقاطك لا يكفي لهذه المكافأة بعد.',
  'Resume this habit before recording an action.': 'استأنف هذه العادة قبل تسجيل خطوة جديدة.',
  'This habit is not scheduled for today.': 'هذه العادة غير مجدولة لليوم.',
  'Use the minimum action option for a smaller step.':
    'اختر الخطوة الصغيرة لتسجيل إنجاز أقل من الهدف.',
  'Choose at least one day for a custom schedule.': 'اختر يوماً واحداً على الأقل للجدول المخصص.',
  'Schedule days must be unique.': 'اختر كل يوم مرة واحدة في الجدول.',
  'Numeric goals need a positive target.': 'أدخل قيمة موجبة للهدف الرقمي.',
  'Target date must be after the start date.': 'يجب أن يكون موعد الهدف بعد تاريخ البداية.',
  'Choose a deadline within the next month.': 'اختر موعداً نهائياً خلال الشهر القادم.',
  'This quest has ended. Start a fresh quest with what you learned.':
    'انتهت هذه المهمة. ابدأ مهمة جديدة مستفيداً مما تعلمته.',
  'A task cannot be its own ancestor.': 'لا يمكن ربط المهمة بنفسها أو بإحدى مهامها الفرعية كأصل.',
  'This action has already been recorded.': 'تم تسجيل هذا الإجراء بالفعل.',
  'We could not find that item.': 'لم نتمكن من العثور على هذا العنصر.',
  'A linked item is no longer available.': 'أحد العناصر المرتبطة لم يعد متاحاً.',
};

export function errorMessage(error: unknown): string {
  const arabic = typeof document !== 'undefined' && document.documentElement.lang === 'ar';
  if (error instanceof TimeoutError)
    return arabic ? 'انتهت مهلة الاتصال. تحقق من النتيجة قبل إعادة المحاولة.' : 'The request timed out. Check the result before trying again.';
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0)
      return arabic
        ? 'يبدو أنك غير متصل. تحقق من اتصالك وحاول مجدداً.'
        : 'You seem to be offline. Check your connection and try again.';
    const body: unknown = error.error;
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : '';
    if (!arabic && message) return message;
    if (arabic) {
      if (arabicMessages[message]) return arabicMessages[message];
      if (error.status === 401) return 'تحقق من بيانات الدخول وسجّل الدخول للمتابعة.';
      if (error.status === 403) return 'هذا الإجراء غير متاح لحسابك حالياً.';
      if (error.status === 404) return 'لم نتمكن من العثور على هذا العنصر.';
      if (error.status === 409)
        return 'تم تسجيل الإجراء أو تغيّرت البيانات. حدّث الصفحة قبل المحاولة مجدداً.';
      if (error.status === 429) return 'محاولات كثيرة في وقت قصير. انتظر قليلاً وحاول مجدداً.';
      if (error.status === 400)
        return 'تعذر إتمام الإجراء بهذه البيانات. راجع القيم والخيارات ثم حاول مجدداً.';
    }
  }
  return arabic
    ? 'تعذر إتمام الإجراء الآن. حاول مرة أخرى.'
    : 'We could not complete that action. Please try again.';
}
