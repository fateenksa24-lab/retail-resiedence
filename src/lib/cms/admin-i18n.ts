// Wording of the admin dashboard itself, in English and Arabic. Website copy lives in messages/.

export type AdminLang = 'en' | 'ar';
export const ADMIN_LANG_COOKIE = 'retal_admin_lang';
export const isAdminLang = (v: unknown): v is AdminLang => v === 'en' || v === 'ar';

const enPlural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Arabic counted nouns: 1 تغيير واحد، 2 تغييران، 3–10 تغييرات، 11+ تغييرًا. */
const arPlural = (n: number, forms: { one: string; two: string; few: string; many: string }) => {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const mod = n % 100;
  if (mod >= 3 && mod <= 10) return `${n} ${forms.few}`;
  return `${n} ${forms.many}`;
};

const en = {
  lang: 'en' as AdminLang,
  dir: 'ltr' as 'ltr' | 'rtl',
  formatDate: (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  appName: 'Website content',
  pageTitle: 'Content · Retal Residence',
  switchLang: 'العربية',
  switchLangLabel: 'عرض لوحة التحكم بالعربية',

  setup: {
    title: 'Admin is not set up yet',
    body: 'In Vercel, open the project’s Settings → Environment Variables, add ADMIN_PASSWORD (at least 8 characters), then redeploy.',
  },

  login: {
    intro: 'Sign in to edit the Retal Residence website.',
    password: 'Password',
    show: 'Show',
    hide: 'Hide',
    submit: 'Sign in',
    submitting: 'Signing in…',
    wrong: 'That password is not correct.',
  },

  tabs: {
    text: 'Text',
    photos: 'Photos',
    contact: 'Contact details',
    residences: 'Residences & drive times',
    logo: 'Logo',
    history: 'History',
    bookings: 'Bookings',
  },
  sectionsLabel: 'Sections',

  header: {
    save: 'Save changes',
    saving: 'Saving…',
    saveShortcut: 'Ctrl + S',
    discard: 'Discard',
    viewSite: 'View site ↗',
    signOut: 'Sign out',
    uploading: 'Uploading photos…',
    noChanges: 'No changes yet',
    savedAt: (date: string) => `Saved · ${date}`,
    unsaved: (n: number) => `${enPlural(n, 'unsaved change', 'unsaved changes')}`,
  },

  welcome: {
    label: 'How it works',
    steps: [
      ['Edit anything', 'Text in any language, photos, phone numbers, residence details.'],
      ['Click Save changes', 'Or press Ctrl + S. Your edits are kept in this browser until you save.'],
      ['It’s live', 'The website updates within seconds. Every save is kept in History, so you can always go back.'],
    ] as [string, string][],
    gotIt: 'Got it',
  },

  recovered: {
    text: 'You have unsaved changes from your last visit.',
    restore: 'Bring them back',
    discard: 'Throw them away',
  },

  closeMessage: 'Close message',
  showMe: 'Show me',
  toast: 'Saved. Your changes are live on the website now.',

  confirm: {
    discard: (n: number) => `Throw away ${enPlural(n, 'unsaved change', 'unsaved changes')}? The website stays as it is now.`,
    openVersion: 'Opening another version replaces your unsaved changes. Continue?',
    startOver: 'Load the original website into the editor? Nothing changes on the website until you click Save changes.',
  },

  notices: {
    versionOpen: (date: string) =>
      `The version from ${date} is open in the editor. Look through it, then click Save changes to put it on the website, or Discard to go back.`,
    originalOpen: 'The original website is open in the editor. Click Save changes to publish it, or Discard to go back.',
    textProblem: (language: string, problem: string) => `One text needs fixing before saving (${language}): ${problem}`,
    contactProblem: 'A contact detail needs fixing before saving.',
    socialProblem: 'A social media link needs fixing before saving.',
    saveOffline: 'Saving failed: the connection dropped. Check your internet and try again.',
    uploadOffline: 'The upload stopped: check your internet and try again.',
    uploadSignIn: 'Sign in to upload photos.',
    uploadFailed: 'Upload failed. Try again.',
  },

  storage: {
    notConnected:
      'Saving is switched off because this website has no storage yet. In Vercel, open Storage → Create → Blob (choose Private), connect it to this project, then redeploy.',
    publicStore: 'The connected Blob store is Public. Create a new Blob store with access set to Private, connect it to this project instead, then redeploy.',
    unavailable: (detail: string) => `The storage is not responding (${detail}). Try again in a minute; if it keeps happening, check the Blob store in Vercel.`,
  },

  imageErrors: {
    heic: 'This iPhone photo format (HEIC) can’t be opened in this browser. Open the admin in Safari, or save the photo as JPG first.',
    unreadable: 'This file could not be read as a photo. Use a JPG, PNG or WebP image.',
    logoTooBig: 'Use a logo file under 1 MB (SVG or PNG work best).',
  },

  relogin: {
    title: 'Please sign in again',
    body: 'You were signed out after a while for safety. Your changes are safe: enter the password to carry on.',
    password: 'Password',
    submit: 'Sign in and continue',
    submitting: 'Signing in…',
    cancel: 'Cancel',
    wrong: 'That password is not correct.',
  },

  common: {
    edited: '● Edited',
    restoreOriginal: 'Restore original',
    restore: 'Restore',
    seeOnSite: 'See it on the site ↗',
    seePage: 'See page ↗',
    minutes: 'min',
    replace: 'Replace',
  },

  text: {
    title: 'Text',
    intro: 'Every headline, sentence, button and label on the website, in all seven languages. Pick a language and a page, change the text, then click Save changes.',
    language: 'Language',
    search: 'Search',
    searchPlaceholder: 'Type any words you see on the site…',
    onlyEdited: 'Show only what I changed',
    pagesLabel: 'Pages',
    editedCount: (n: number) => `${n} edited`,
    noneChanged: (language: string) => `Nothing changed in ${language} yet.`,
    noMatch: 'No text matches. Try fewer words, or another language.',
    first120: 'Showing the first 120 matches.',
    matches: (n: number) => enPlural(n, 'match', 'matches'),
    english: 'English:',
    empty: 'This can’t be empty. Write some text, or click “Restore original”.',
    tokens: (tokens: string, count: number) =>
      `Keep ${tokens} exactly as written: the website fills ${count === 1 ? 'it' : 'them'} in automatically (a number or a name).`,
    tooLong: 'Much longer than the original. Check on the site that it still looks good.',
    groups: {
      home: 'Home page',
      nav: 'Menu',
      footer: 'Footer',
      residences: 'Residences',
      clubhouse: 'Clubhouse',
      living: 'Living',
      neighborhood: 'Neighborhood',
      contact: 'Contact page',
      common: 'Common labels',
      meta: 'Google titles & descriptions',
      notFound: '“Page not found”',
      images: 'Photo descriptions',
      rooms: 'Room names',
    } as Record<string, string>,
    /** Sub-section names; English falls back to the key itself. */
    sections: {} as Record<string, string>,
    roles: {
      title: 'Headline',
      eyebrow: 'Small label above the headline',
      subtitle: 'Subheading',
      description: 'Description',
      body: 'Paragraph',
      lead: 'Intro paragraph',
      intro: 'Intro paragraph',
      primary: 'Main button',
      secondary: 'Second button',
      cta: 'Button',
      summary: 'Short summary',
      name: 'Name',
      caption: 'Caption',
      hint: 'Hint',
      label: 'Label',
      statement: 'Statement',
    } as Record<string, string>,
  },

  contact: {
    title: 'Contact details',
    intro:
      'Shown in the footer, the menu, the contact page, the WhatsApp button and Google results. Write phone numbers the way visitors should read them; the call and WhatsApp links update by themselves.',
    fields: {
      phone: { label: 'Main phone' },
      whatsapp: { label: 'WhatsApp number', hint: 'Used by the WhatsApp button and visit bookings.' },
      reservations1: { label: 'Reservations phone 1' },
      reservations2: { label: 'Reservations phone 2', hint: 'Leave empty to show only one reservations number.' },
      email: { label: 'General email' },
      salesEmail: { label: 'Sales email' },
      company: { label: 'Company name' },
      street: { label: 'Street address' },
      city: { label: 'City' },
      postalCode: { label: 'Postal code' },
    } as Record<string, { label: string; hint?: string }>,
    socialTitle: 'Social media links',
    social: { instagram: 'Instagram', x: 'X (Twitter)', linkedin: 'LinkedIn', facebook: 'Facebook' } as Record<string, string>,
    problems: {
      empty: 'This can’t be empty.',
      email: 'This doesn’t look like an email address.',
      phone: 'Write the full number with the country code, for example +966 13 825 9600.',
      url: 'Paste the full link, starting with https://',
    },
  },

  residences: {
    title: 'Residences',
    intro: 'Sizes and room counts appear on the cards, the table and each residence page. For videos and tours you can paste the whole link; only the ID is kept.',
    residence: 'Residence',
    columns: {
      size: { label: 'Size (m²)' },
      bedrooms: { label: 'Bedrooms' },
      bathrooms: { label: 'Bathrooms' },
      youtube: { label: 'YouTube video', hint: 'Paste a YouTube link or its ID' },
      vrTour: { label: 'VR tour ID', hint: 'Empty hides the tour' },
    } as Record<string, { label: string; hint?: string }>,
    noTour: 'No tour',
    driveTitle: 'Drive times',
    driveIntro: 'Minutes by car from the compound. Shown on the map, the home page and the neighborhood page.',
    minutesOf: (name: string) => `${name}: minutes`,
  },

  photos: {
    title: 'Photos',
    intro:
      'Replace any photo, and add, remove or reorder the photos in each residence’s gallery. Photos straight from a phone or camera are fine: they are resized and compressed for the web automatically.',
    groupsLabel: 'Photo groups',
    groups: { site: 'Site & grounds', clubhouse: 'Clubhouse', living: 'Living' } as Record<string, string>,
    gallery: 'Gallery',
    galleryCount: (n: number) => `${enPlural(n, 'photo', 'photos')}, shown in this order`,
    restoreGallery: 'Restore original gallery',
    galleryHint: 'The first photo is the one people see first. Drag photos, or use the arrows, to change the order.',
    room: 'Room',
    description: 'Short description (for screen readers)',
    descriptionPlaceholder: 'e.g. Living room with sofa and garden view',
    earlier: '← Earlier',
    later: 'Later →',
    moveEarlier: (n: number) => `Move photo ${n} earlier`,
    moveLater: (n: number) => `Move photo ${n} later`,
    remove: 'Remove',
    add: 'Add photos',
    addHint: 'Click, or drop photos here',
    uploadingN: (n: number) => `Uploading ${n}…`,
    uploading: 'Uploading…',
    floorPlan: 'Floor plan',
    badgeNew: 'New',
    badgeReplaced: 'Replaced',
    orientation: { portrait: 'portrait', landscape: 'landscape', square: 'square' },
    mismatch: (original: string, current: string) => `The original was ${original}; this photo is ${current}, so the site will crop it to fit.`,
  },

  logo: {
    title: 'Logo',
    intro:
      'Upload an SVG (best) or a PNG with a transparent background. If you upload only one, it is used everywhere. Until you upload one, the website uses its built-in logo, which changes colour to suit each background.',
    onDark: { title: 'Logo on dark backgrounds', where: 'Used in the header and footer on most pages. Choose a light-coloured logo.' },
    onLight: { title: 'Logo on light backgrounds', where: 'Used in the header over light page tops. Choose a dark-coloured logo.' },
    upload: 'Upload logo',
    useBuiltIn: 'Use built-in logo',
    uploading: 'Uploading…',
  },

  history: {
    title: 'History',
    intro:
      'Every time you save, a copy of the whole website’s content is kept here (the last 40 saves). If something went wrong, open an earlier version, check it, then click Save changes to put it back on the website.',
    empty: 'No saved versions yet. Your first save will appear here.',
    current: 'On the website now',
    open: 'Open this version',
    opening: 'Opening…',
    startOverTitle: 'Start over',
    startOverBody:
      'Brings back the website exactly as it was delivered: all original text, photos and details. Nothing changes on the website until you click Save changes.',
    startOverButton: 'Load the original website',
  },

  bookings: {
    title: 'Visit bookings',
    intro:
      'A time is booked as soon as a visitor sends their request to WhatsApp, and other visitors then see it greyed out. If a visit is cancelled or the request never arrived, free the time so it can be booked again.',
    empty: 'No upcoming bookings.',
    refresh: 'Refresh',
    loading: 'Loading…',
    free: 'Free this time',
    freeing: 'Freeing…',
    confirmFree: (when: string) => `Free ${when}? Visitors will be able to book this time again.`,
    booked: (when: string) => `Booked ${when}`,
    whatsapp: 'WhatsApp',
    interests: { apartment: 'Apartments', 'town-villa': 'Town villas', 'executive-villa': 'Executive villas', clubhouse: 'The Clubhouse' } as Record<string, string>,
    notDecided: 'Not decided yet',
  },

  server: {
    notConnected: 'Storage is not connected. Add a Vercel Blob store to the project.',
    invalidField: (path: string, message: string) => `Please check “${path}”: ${message}.`,
    conflict:
      'These changes were not saved: someone saved a newer version (maybe in another tab) after you opened this page. Reload the page to see the latest version, then make your edits again.',
    emptyText: (key: string, locale: string) => `“${key}” (${locale}) cannot be empty.`,
    tokens: (key: string, locale: string, tokens: string) => `“${key}” (${locale}) must keep these placeholders exactly as they are: ${tokens}`,
    galleryEmpty: 'Each residence needs at least one photo in its gallery.',
    saveFailed: 'Saving failed. Try again.',
    noFile: 'No file received.',
    fileType: 'Use a JPG, PNG, WebP or SVG file.',
    fileSize: 'The file is larger than 4 MB.',
    uploadFailed: 'Upload failed. Try again.',
    versionMissing: 'That version could not be opened.',
    bookingsFailed: 'Bookings could not be loaded. Try again.',
  },
};

export type AdminDict = typeof en;

const ar: AdminDict = {
  lang: 'ar',
  dir: 'rtl',
  formatDate: (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  appName: 'محتوى الموقع',
  pageTitle: 'إدارة المحتوى · ريتال ريزيدنس',
  switchLang: 'English',
  switchLangLabel: 'Show the dashboard in English',

  setup: {
    title: 'لوحة التحكم غير مفعّلة بعد',
    body: 'من إعدادات المشروع في Vercel افتح Settings ثم Environment Variables، وأضف ADMIN_PASSWORD (ثمانية أحرف على الأقل)، ثم أعد النشر.',
  },

  login: {
    intro: 'سجّل الدخول لتعديل موقع ريتال ريزيدنس.',
    password: 'كلمة المرور',
    show: 'إظهار',
    hide: 'إخفاء',
    submit: 'تسجيل الدخول',
    submitting: 'جارٍ تسجيل الدخول…',
    wrong: 'كلمة المرور غير صحيحة.',
  },

  tabs: {
    text: 'النصوص',
    photos: 'الصور',
    contact: 'بيانات التواصل',
    residences: 'الوحدات ومسافات القيادة',
    logo: 'الشعار',
    history: 'السجل',
    bookings: 'الحجوزات',
  },
  sectionsLabel: 'الأقسام',

  header: {
    save: 'حفظ التغييرات',
    saving: 'جارٍ الحفظ…',
    saveShortcut: 'Ctrl + S',
    discard: 'تجاهل',
    viewSite: 'عرض الموقع ↗',
    signOut: 'تسجيل الخروج',
    uploading: 'جارٍ رفع الصور…',
    noChanges: 'لا توجد تغييرات بعد',
    savedAt: (date: string) => `آخر حفظ: ${date}`,
    unsaved: (n: number) =>
      arPlural(n, { one: 'تغيير واحد غير محفوظ', two: 'تغييران غير محفوظين', few: 'تغييرات غير محفوظة', many: 'تغييرًا غير محفوظ' }),
  },

  welcome: {
    label: 'طريقة الاستخدام',
    steps: [
      ['عدّل ما تشاء', 'النصوص بأي لغة، والصور، وأرقام الهاتف، وتفاصيل الوحدات.'],
      ['اضغط «حفظ التغييرات»', 'أو اضغط Ctrl + S. تبقى تعديلاتك محفوظة في هذا المتصفح حتى تحفظها.'],
      ['تظهر فورًا', 'يتحدّث الموقع خلال ثوانٍ، وتُحفظ نسخة من كل حفظ في «السجل» لتعود إليها متى شئت.'],
    ],
    gotIt: 'فهمت',
  },

  recovered: {
    text: 'لديك تغييرات لم تُحفظ من زيارتك السابقة.',
    restore: 'استرجاعها',
    discard: 'تجاهلها',
  },

  closeMessage: 'إغلاق الرسالة',
  showMe: 'أرني أين',
  toast: 'تم الحفظ. تغييراتك ظاهرة على الموقع الآن.',

  confirm: {
    discard: (n: number) =>
      `هل تريد تجاهل ${arPlural(n, { one: 'التغيير غير المحفوظ', two: 'التغييرين غير المحفوظين', few: 'تغييرات غير محفوظة', many: 'تغييرًا غير محفوظ' })}؟ سيبقى الموقع كما هو الآن.`,
    openVersion: 'فتح نسخة أخرى سيستبدل تغييراتك غير المحفوظة. هل تريد المتابعة؟',
    startOver: 'هل تريد تحميل الموقع الأصلي في المحرر؟ لن يتغير شيء على الموقع حتى تضغط «حفظ التغييرات».',
  },

  notices: {
    versionOpen: (date: string) => `نسخة ${date} مفتوحة الآن في المحرر. راجعها، ثم اضغط «حفظ التغييرات» لنشرها على الموقع، أو «تجاهل» للرجوع.`,
    originalOpen: 'الموقع الأصلي مفتوح الآن في المحرر. اضغط «حفظ التغييرات» لنشره، أو «تجاهل» للرجوع.',
    textProblem: (language: string, problem: string) => `أحد النصوص يحتاج إلى تصحيح قبل الحفظ (${language}): ${problem}`,
    contactProblem: 'إحدى بيانات التواصل تحتاج إلى تصحيح قبل الحفظ.',
    socialProblem: 'أحد روابط التواصل الاجتماعي يحتاج إلى تصحيح قبل الحفظ.',
    saveOffline: 'تعذّر الحفظ لانقطاع الاتصال. تحقّق من الإنترنت ثم حاول مرة أخرى.',
    uploadOffline: 'توقّف الرفع لانقطاع الاتصال. تحقّق من الإنترنت ثم حاول مرة أخرى.',
    uploadSignIn: 'سجّل الدخول لرفع الصور.',
    uploadFailed: 'تعذّر الرفع. حاول مرة أخرى.',
  },

  storage: {
    notConnected:
      'الحفظ متوقف لأن الموقع لم يُربط بمساحة تخزين بعد. من Vercel افتح Storage ثم Create ثم Blob (واختر Private)، واربطه بهذا المشروع، ثم أعد النشر.',
    publicStore: 'مساحة التخزين المربوطة عامة (Public). أنشئ مساحة Blob جديدة بخيار Private واربطها بالمشروع بدلًا منها، ثم أعد النشر.',
    unavailable: (detail: string) => `مساحة التخزين لا تستجيب (${detail}). حاول بعد دقيقة، وإن تكرر الأمر فراجع مساحة Blob في Vercel.`,
  },

  imageErrors: {
    heic: 'هذه صيغة صور الآيفون (HEIC) ولا يمكن فتحها في هذا المتصفح. افتح لوحة التحكم من Safari، أو احفظ الصورة بصيغة JPG أولًا.',
    unreadable: 'تعذّرت قراءة هذا الملف كصورة. استخدم صورة بصيغة JPG أو PNG أو WebP.',
    logoTooBig: 'استخدم ملف شعار أصغر من 1 ميغابايت (يُفضّل SVG أو PNG).',
  },

  relogin: {
    title: 'يرجى تسجيل الدخول مجددًا',
    body: 'سُجّل خروجك تلقائيًا بعد مدة حفاظًا على الأمان. تغييراتك محفوظة؛ أدخل كلمة المرور للمتابعة.',
    password: 'كلمة المرور',
    submit: 'الدخول والمتابعة',
    submitting: 'جارٍ تسجيل الدخول…',
    cancel: 'إلغاء',
    wrong: 'كلمة المرور غير صحيحة.',
  },

  common: {
    edited: '● معدَّل',
    restoreOriginal: 'استعادة الأصل',
    restore: 'استعادة',
    seeOnSite: 'عرضه في الموقع ↗',
    seePage: 'عرض الصفحة ↗',
    minutes: 'دقيقة',
    replace: 'استبدال',
  },

  text: {
    title: 'النصوص',
    intro: 'كل العناوين والجمل والأزرار والتسميات في الموقع، باللغات السبع. اختر اللغة والصفحة، وعدّل النص، ثم اضغط «حفظ التغييرات».',
    language: 'اللغة',
    search: 'بحث',
    searchPlaceholder: 'اكتب أي كلمات تراها في الموقع…',
    onlyEdited: 'اعرض ما عدّلته فقط',
    pagesLabel: 'الصفحات',
    editedCount: (n: number) => `${n} معدَّل`,
    noneChanged: (language: string) => `لم يُعدَّل شيء في ${language} بعد.`,
    noMatch: 'لا توجد نصوص مطابقة. جرّب كلمات أقل أو لغة أخرى.',
    first120: 'تُعرض أول 120 نتيجة.',
    matches: (n: number) => arPlural(n, { one: 'نتيجة واحدة', two: 'نتيجتان', few: 'نتائج', many: 'نتيجة' }),
    english: 'بالإنجليزية:',
    empty: 'لا يمكن ترك هذا الحقل فارغًا. اكتب نصًا، أو اضغط «استعادة الأصل».',
    tokens: (tokens: string, count: number) =>
      `أبقِ ${tokens} كما ${count === 1 ? 'هو' : 'هي'} تمامًا؛ فالموقع ${count === 1 ? 'يملؤه' : 'يملؤها'} تلقائيًا (برقم أو اسم).`,
    tooLong: 'النص أطول بكثير من الأصل. تأكّد من مظهره في الموقع.',
    groups: {
      home: 'الصفحة الرئيسية',
      nav: 'القائمة',
      footer: 'تذييل الموقع',
      residences: 'الوحدات السكنية',
      clubhouse: 'النادي',
      living: 'الحياة في ريتال',
      neighborhood: 'الحي',
      contact: 'صفحة التواصل',
      common: 'تسميات عامة',
      meta: 'عناوين وأوصاف Google',
      notFound: 'صفحة «غير موجودة»',
      images: 'أوصاف الصور',
      rooms: 'أسماء الغرف',
    },
    sections: {
      hero: 'الواجهة',
      statement: 'البيان',
      stats: 'الأرقام',
      residences: 'الوحدات السكنية',
      clubhouse: 'النادي',
      living: 'الحياة في ريتال',
      security: 'الأمن والخدمات',
      neighborhood: 'الحي',
      gallery: 'معرض الصور',
      visit: 'دعوة للزيارة',
      tour: 'الجولة الافتراضية',
      booking: 'حجز زيارة',
      index: 'صفحة الوحدات',
      types: 'أنواع الوحدات',
      typesPlural: 'أنواع الوحدات (جمع)',
      table: 'الجدول',
      features: 'المزايا',
      extras: 'الإضافات',
      detail: 'صفحة الوحدة',
      tours: 'الجولات',
      intro: 'المقدمة',
      categories: 'الفئات',
      amenities: 'المرافق',
      figures: 'الأرقام',
      arrival: 'الوصول',
      themes: 'محاور الحياة اليومية',
      outdoors: 'المساحات الخارجية',
      services: 'الخدمات',
      areas: 'المناطق',
      destinations: 'الوجهات',
      short: 'الأسماء المختصرة',
      aerial: 'الصور الجوية',
      form: 'نموذج التواصل',
      social: 'التواصل الاجتماعي',
      home: 'الصفحة الرئيسية',
      contact: 'التواصل',
      book: 'صفحة الحجز',
      residence: 'صفحة الوحدة',
      notFound: 'الصفحة غير موجودة',
    },
    roles: {
      title: 'العنوان',
      eyebrow: 'التسمية الصغيرة فوق العنوان',
      subtitle: 'العنوان الفرعي',
      description: 'الوصف',
      body: 'الفقرة',
      lead: 'الفقرة التمهيدية',
      intro: 'الفقرة التمهيدية',
      primary: 'الزر الرئيسي',
      secondary: 'الزر الثاني',
      cta: 'الزر',
      summary: 'ملخص قصير',
      name: 'الاسم',
      caption: 'التعليق',
      hint: 'تلميح',
      label: 'التسمية',
      statement: 'البيان',
    },
  },

  contact: {
    title: 'بيانات التواصل',
    intro:
      'تظهر في التذييل والقائمة وصفحة التواصل وزر واتساب ونتائج Google. اكتب أرقام الهاتف كما تريد أن يقرأها الزوار؛ روابط الاتصال وواتساب تتحدّث تلقائيًا.',
    fields: {
      phone: { label: 'الهاتف الرئيسي' },
      whatsapp: { label: 'رقم واتساب', hint: 'يُستخدم لزر واتساب ولحجوزات الزيارة.' },
      reservations1: { label: 'هاتف الحجوزات 1' },
      reservations2: { label: 'هاتف الحجوزات 2', hint: 'اتركه فارغًا لعرض رقم حجوزات واحد فقط.' },
      email: { label: 'البريد الإلكتروني العام' },
      salesEmail: { label: 'بريد المبيعات' },
      company: { label: 'اسم الشركة' },
      street: { label: 'عنوان الشارع' },
      city: { label: 'المدينة' },
      postalCode: { label: 'الرمز البريدي' },
    },
    socialTitle: 'روابط التواصل الاجتماعي',
    social: { instagram: 'إنستغرام', x: 'إكس (تويتر)', linkedin: 'لينكدإن', facebook: 'فيسبوك' },
    problems: {
      empty: 'لا يمكن ترك هذا الحقل فارغًا.',
      email: 'هذا لا يبدو عنوان بريد إلكتروني صحيحًا.',
      phone: 'اكتب الرقم كاملًا مع رمز الدولة، مثل ‎+966 13 825 9600.',
      url: 'الصق الرابط كاملًا بدءًا من https://',
    },
  },

  residences: {
    title: 'الوحدات السكنية',
    intro: 'تظهر المساحات وعدد الغرف في البطاقات والجدول وصفحة كل وحدة. يمكنك لصق رابط الفيديو أو الجولة كاملًا، وسيُحفظ المعرّف فقط.',
    residence: 'الوحدة',
    columns: {
      size: { label: 'المساحة (م²)' },
      bedrooms: { label: 'غرف النوم' },
      bathrooms: { label: 'دورات المياه' },
      youtube: { label: 'فيديو يوتيوب', hint: 'الصق رابط يوتيوب أو معرّفه' },
      vrTour: { label: 'معرّف الجولة الافتراضية', hint: 'اتركه فارغًا لإخفاء الجولة' },
    },
    noTour: 'لا توجد جولة',
    driveTitle: 'مسافات القيادة',
    driveIntro: 'المدة بالدقائق بالسيارة من المجمع. تظهر على الخريطة وفي الصفحة الرئيسية وصفحة الحي.',
    minutesOf: (name: string) => `${name}: بالدقائق`,
  },

  photos: {
    title: 'الصور',
    intro:
      'استبدل أي صورة، وأضف صور معرض كل وحدة أو احذفها أو غيّر ترتيبها. يمكنك رفع الصور مباشرة من الجوال أو الكاميرا؛ فهي تُصغَّر وتُضغط للويب تلقائيًا.',
    groupsLabel: 'مجموعات الصور',
    groups: { site: 'المجمع والمساحات الخارجية', clubhouse: 'النادي', living: 'الحياة في ريتال' },
    gallery: 'المعرض',
    galleryCount: (n: number) => `${arPlural(n, { one: 'صورة واحدة', two: 'صورتان', few: 'صور', many: 'صورة' })}، بهذا الترتيب`,
    restoreGallery: 'استعادة المعرض الأصلي',
    galleryHint: 'الصورة الأولى هي أول ما يراه الزائر. اسحب الصور أو استخدم الأسهم لتغيير الترتيب.',
    room: 'الغرفة',
    description: 'وصف قصير (لقارئات الشاشة)',
    descriptionPlaceholder: 'مثال: غرفة معيشة بأريكة وإطلالة على الحديقة',
    earlier: '→ تقديم',
    later: 'تأخير ←',
    moveEarlier: (n: number) => `تقديم الصورة ${n}`,
    moveLater: (n: number) => `تأخير الصورة ${n}`,
    remove: 'حذف',
    add: 'إضافة صور',
    addHint: 'اضغط هنا، أو اسحب الصور وأفلتها',
    uploadingN: (n: number) => `جارٍ رفع ${n}…`,
    uploading: 'جارٍ الرفع…',
    floorPlan: 'المخطط',
    badgeNew: 'جديدة',
    badgeReplaced: 'مستبدلة',
    orientation: { portrait: 'طولية', landscape: 'عرضية', square: 'مربعة' },
    mismatch: (original: string, current: string) => `الصورة الأصلية كانت ${original} وهذه الصورة ${current}، لذا سيقصّها الموقع لتناسب المساحة.`,
  },

  logo: {
    title: 'الشعار',
    intro:
      'ارفع ملف SVG (الأفضل) أو PNG بخلفية شفافة. إن رفعت شعارًا واحدًا فسيُستخدم في كل مكان. وإلى أن ترفع شعارًا، يستخدم الموقع شعاره المدمج الذي يتلوّن بما يناسب كل خلفية.',
    onDark: { title: 'الشعار على الخلفيات الداكنة', where: 'يظهر في رأس الصفحة والتذييل في معظم الصفحات. اختر شعارًا بلون فاتح.' },
    onLight: { title: 'الشعار على الخلفيات الفاتحة', where: 'يظهر في رأس الصفحة فوق الأجزاء الفاتحة. اختر شعارًا بلون داكن.' },
    upload: 'رفع شعار',
    useBuiltIn: 'استخدام الشعار المدمج',
    uploading: 'جارٍ الرفع…',
  },

  history: {
    title: 'السجل',
    intro:
      'مع كل حفظ تُحفظ هنا نسخة كاملة من محتوى الموقع (آخر 40 حفظًا). إن حدث خطأ، افتح نسخة سابقة وراجعها، ثم اضغط «حفظ التغييرات» لإعادتها إلى الموقع.',
    empty: 'لا توجد نسخ محفوظة بعد. سيظهر هنا أول حفظ تقوم به.',
    current: 'المعروضة على الموقع الآن',
    open: 'فتح هذه النسخة',
    opening: 'جارٍ الفتح…',
    startOverTitle: 'البدء من جديد',
    startOverBody: 'يعيد الموقع كما سُلِّم تمامًا: كل النصوص والصور والبيانات الأصلية. لن يتغير شيء على الموقع حتى تضغط «حفظ التغييرات».',
    startOverButton: 'تحميل الموقع الأصلي',
  },

  bookings: {
    title: 'حجوزات الزيارات',
    intro:
      'يُحجز الوقت بمجرد أن يرسل الزائر طلبه إلى واتساب، ويظهر بعدها رماديًا لبقية الزوار. إن أُلغيت الزيارة أو لم يصل الطلب، حرّر الوقت ليُحجز من جديد.',
    empty: 'لا توجد حجوزات قادمة.',
    refresh: 'تحديث',
    loading: 'جارٍ التحميل…',
    free: 'تحرير هذا الوقت',
    freeing: 'جارٍ التحرير…',
    confirmFree: (when: string) => `تحرير موعد ${when}؟ سيتمكن الزوار من حجز هذا الوقت مجددًا.`,
    booked: (when: string) => `حُجز في ${when}`,
    whatsapp: 'واتساب',
    interests: { apartment: 'الشقق', 'town-villa': 'فلل تاون هاوس', 'executive-villa': 'الفلل التنفيذية', clubhouse: 'النادي' } as Record<string, string>,
    notDecided: 'لم يحدد بعد',
  },

  server: {
    notConnected: 'مساحة التخزين غير مربوطة. أضف مساحة Vercel Blob إلى المشروع.',
    invalidField: (path: string, message: string) => `يرجى مراجعة «${path}»: ${message}.`,
    conflict:
      'لم تُحفظ هذه التغييرات: حفظ شخص آخر نسخة أحدث (ربما من تبويب آخر) بعد أن فتحت هذه الصفحة. أعد تحميل الصفحة لرؤية أحدث نسخة، ثم أعد تعديلاتك.',
    emptyText: (key: string, locale: string) => `لا يمكن ترك «${key}» (${locale}) فارغًا.`,
    tokens: (key: string, locale: string, tokens: string) => `يجب أن يبقى في «${key}» (${locale}) هذا كما هو تمامًا: ${tokens}`,
    galleryEmpty: 'يجب أن يحتوي معرض كل وحدة على صورة واحدة على الأقل.',
    saveFailed: 'تعذّر الحفظ. حاول مرة أخرى.',
    noFile: 'لم يصل أي ملف.',
    fileType: 'استخدم ملفًا بصيغة JPG أو PNG أو WebP أو SVG.',
    fileSize: 'حجم الملف أكبر من 4 ميغابايت.',
    uploadFailed: 'تعذّر الرفع. حاول مرة أخرى.',
    versionMissing: 'تعذّر فتح هذه النسخة.',
    bookingsFailed: 'تعذّر تحميل الحجوزات. حاول مرة أخرى.',
  },
};

export const adminDict: Record<AdminLang, AdminDict> = { en, ar };
