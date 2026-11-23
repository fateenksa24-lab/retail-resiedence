#!/usr/bin/env node
// Company profile v1: an A4-landscape publication composed from the website's own content, copy,
// tokens, fonts and photography, rendered to PDF in English and Arabic (RTL).
//   npm run profile:v1 [-- --locales=en,ar] [-- --shots=<dir>]
// Writes profile/v1/retal-residence-profile.<locale>.html and profile/v1/Retal-Residence-Profile-<LOCALE>.pdf.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { AUDIENCE, audienceProof } from './shared.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'profile/v1');
// Photos are re-exported at 2000px for the PDF (sharp enough for screen and office print, a third of the weight).
const CACHE = path.join(ROOT, '.cache/profile');
const PHOTO_MAX = 2000;
const used = new Set();
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const LOCALES = arg('locales', 'en,ar').split(',');
const SHOTS = arg('shots', '');

const load = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const json = async (p) => JSON.parse(await readFile(path.join(ROOT, p), 'utf8'));

const { residences } = await load('src/content/residences.ts');
const { amenityCategories } = await load('src/content/amenities.ts');
const { MARK, WORD } = await load('src/components/brand/logo-paths.ts');
const { contact, social, SITE_URL } = await load('src/content/contact.ts');
const manifest = await json('src/content/image-manifest.json');
const markers = await json('src/content/map-markers.json');
const neighborhoodSrc = await readFile(path.join(ROOT, 'src/content/neighborhood.ts'), 'utf8');
const tourSrc = await readFile(path.join(ROOT, 'src/content/clubhouse-tour.ts'), 'utf8');
const destinations = [...neighborhoodSrc.matchAll(/\{ key: '(\w+)', minutes: (\d+)(?:, point: '(\w+)')? \}/g)].map(
  ([, key, minutes, point]) => ({ key, minutes: Number(minutes), point }),
);
const scenes = [...tourSrc.matchAll(/\{ slug: '([\w-]+)', group: '(\w+)' \}/g)].map(([, slug, group]) => ({ slug, group }));

// Copy that exists only in the profile. Everything else comes from messages/<locale>.json.
const COPY = {
  en: {
    title: 'Retal Residence · Company Profile',
    profile: 'Company profile',
    edition: '2026 edition',
    contents: 'Contents',
    about:
      'Retal Residence is a gated compound of furnished apartments and villas in Al Khobar, planned around a Clubhouse at its centre and secured at the gate around the clock.',
    chapters: {
      compound: 'The compound',
      audience: AUDIENCE.en.chapter,
      residences: 'Residences',
      clubhouse: 'The Clubhouse',
      living: 'Life at Retal',
      security: 'Peace of mind',
      location: 'Location',
      visit: 'Visit',
    },
    tourRooms: 'rooms in the Clubhouse 360° tour',
    tourBody:
      'Every room of the Clubhouse, 26 in all, from the lobby to the squash courts. The full 360° tour is on retalresidence.com.',
    groups: { services: 'Services', wellness: 'Wellness', family: 'Family', sport: 'Sport' },
    facts: { schools: '3 min', shopping: 'On site', healthcare: '10 min', community: 'Steps away' },
    residenceOf: 'of',
    coordinates: 'Coordinates',
    website: 'Website',
    tourOpen: 'Take the tour',
    country: 'Kingdom of Saudi Arabia',
  },
  ar: {
    title: 'رتال ريزيدنس · الملف التعريفي',
    profile: 'الملف التعريفي',
    edition: 'إصدار 2026',
    contents: 'المحتويات',
    about:
      'رتال ريزيدنس مجمّع سكني مسوّر في الخبر، يضم شققًا وفللًا مفروشة تلتفّ حول نادٍ في قلبه، وحراسة على البوابة على مدار الساعة.',
    chapters: {
      compound: 'المجمّع',
      audience: AUDIENCE.ar.chapter,
      residences: 'الوحدات السكنية',
      clubhouse: 'النادي',
      living: 'الحياة في رتال',
      security: 'طمأنينة',
      location: 'الموقع',
      visit: 'زيارة',
    },
    tourRooms: 'مكانًا في جولة النادي بزاوية ⁦360°⁩',
    tourBody:
      'كل أماكن النادي، ستة وعشرون مكانًا من الردهة إلى ملاعب الإسكواش. والجولة الكاملة بزاوية ⁦360°⁩ على موقع ⁦retalresidence.com⁩.',
    groups: { services: 'الخدمات', wellness: 'العافية', family: 'العائلة', sport: 'الرياضة' },
    facts: { schools: '3 دقائق', shopping: 'داخل المجمّع', healthcare: '10 دقائق', community: 'على بُعد خطوات' },
    residenceOf: 'من',
    coordinates: 'الإحداثيات',
    website: 'الموقع الإلكتروني',
    tourOpen: 'ابدأ الجولة',
    country: 'المملكة العربية السعودية',
  },
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pad = (n) => String(n).padStart(2, '0');
const num = (v) => `<span class="num" dir="ltr">${esc(v)}</span>`;

/** Picks the ICU plural branch for n (enough for the `{n, plural, ...}` strings in messages). */
function plural(pattern, n, locale) {
  const body = pattern.slice(pattern.indexOf('plural,') + 7, pattern.lastIndexOf('}'));
  const branches = {};
  let i = 0;
  while (i < body.length) {
    const m = /\s*([\w=]+)\s*\{/y;
    m.lastIndex = i;
    const hit = m.exec(body);
    if (!hit) break;
    let depth = 1;
    let j = m.lastIndex;
    for (; depth && j < body.length; j++) {
      if (body[j] === '{') depth++;
      else if (body[j] === '}') depth--;
    }
    branches[hit[1]] = body.slice(m.lastIndex, j - 1);
    i = j;
  }
  const key = new Intl.PluralRules(locale).select(n);
  return (branches[key] ?? branches.other).replace(/\{num\}|#/g, String(n));
}

function logo(ink = 'currentColor') {
  return `<svg class="logo" viewBox="0 0 300 119" role="img" aria-label="Retal Residence" direction="ltr">
    <path d="${MARK}" fill="var(--copper)"/>
    <g transform="translate(83 30) scale(1.4)"><path d="${WORD}" fill="${ink}"/></g>
    <text x="84" y="100" fill="${ink}" font-size="15" letter-spacing="11.6" font-family="General Sans, Arial, sans-serif" font-weight="500" opacity="0.72">RESIDENCE</text>
  </svg>`;
}

function render(locale) {
  const m = JSON.parse(MESSAGES[locale]);
  const c = COPY[locale];
  const rtl = locale === 'ar';
  const alt = (id) => m.images?.[id] ?? '';
  const src = (id) => {
    const entry = manifest[id];
    if (!entry) throw new Error(`Unknown image ${id}`);
    if (!entry.src.endsWith('.jpg')) return `../../public${entry.src}`;
    used.add(entry.src);
    return `../../.cache/profile${entry.src}`;
  };
  /** An image filling its (positioned) parent. `pos` sets object-position. */
  const img = (id, pos = 'center') => `<img src="${src(id)}" alt="${esc(alt(id))}" style="object-position:${pos}">`;
  const ph = (cls, id, pos) => `<figure class="ph ${cls}">${img(id, pos)}</figure>`;
  const minUnit = (n) => (rtl ? plural(m.common.minUnit, n, locale) : m.common.minUnit);
  const sqm = m.common.sqmUnit;
  const name = (r) => m.residences.items[r.slug].name;
  const url = (p = '') => `${SITE_URL}/${locale}${p}`;
  const show = (u) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const pages = [];
  const chapterStart = {};
  /** `folio`: false, or [start, end] insets in mm that keep it clear of edge-bleeding photos. */
  const page = (html, { cls = '', chapter, folio = [14, 14] } = {}) => {
    if (chapter && !(chapter in chapterStart)) chapterStart[chapter] = pages.length + 1;
    pages.push({ html, cls, chapter, folio });
  };

  // 01 Cover ----------------------------------------------------------------
  page(
    `${ph('cover__img', 'site/aerial-clubhouse-dusk', '50% 50%')}
    <div class="cover__logo">${logo()}</div>
    <div class="cover__title stack" style="--s:6mm">
      <p class="eyebrow">${esc(c.profile)}</p>
      <h1 class="display br">${esc(m.home.hero.title)}</h1>
      <p class="lead">${esc(m.home.hero.subtitle)}</p>
    </div>
    <div class="cover__meta micro"><span>${esc(m.home.hero.location)}</span><span>${esc(c.edition)}</span></div>`,
    { folio: false },
  );

  // 02 Contents (page numbers filled in once every page exists) --------------
  const contentsIndex = pages.length;
  page('', { folio: [120, 14] });

  // 03 Statement ------------------------------------------------------------
  page(
    `${ph('statement__img', 'clubhouse/marble-bench')}
    <div class="grid" style="grid-template-rows:auto 1fr">
      <p class="eyebrow" style="grid-column:1 / span 6">${esc(m.home.statement.eyebrow)}</p>
      <p class="statement__text">${esc(m.home.statement.text)}</p>
    </div>
    <div class="principles">
      ${['design', 'stroll', 'security']
        .map(
          (k, i) => `<div>
            <p class="n">${pad(i + 1)}</p>
            <h3 class="h4">${esc(m.home.statement.principles[k].title)}</h3>
            <p class="small" style="margin-top:2.5mm">${esc(m.home.statement.principles[k].body)}</p>
          </div>`,
        )
        .join('')}
    </div>`,
    { chapter: 'compound' },
  );

  // 04 From above -------------------------------------------------------------
  page(
    `${ph('bleed', 'site/aerial-compound', '50% 40%')}
    <div class="caption-panel stack" style="--s:3.5mm">
      <p class="eyebrow">${esc(m.neighborhood.aerial.eyebrow)}</p>
      <h2 class="h3">${esc(m.neighborhood.aerial.title)}</h2>
      <p class="small">${esc(m.neighborhood.aerial.body)}</p>
    </div>`,
    { chapter: 'compound', folio: false },
  );

  // 05 In numbers -------------------------------------------------------------
  const s = m.home.stats;
  const f = m.clubhouse.figures;
  const stats = [
    [s.types.value, '', s.types.label],
    [s.size.value, s.size.unit, s.size.label],
    [s.security.value, '', s.security.label],
    [s.school.value, s.school.unit, s.school.label],
    [f.amenities.value, '', f.amenities.label],
    [f.cinema.value, '', f.cinema.label],
    [f.bowling.value, '', f.bowling.label],
    [String(scenes.length), '', c.tourRooms],
  ];
  page(
    `<div class="numbers__head">
      <p class="eyebrow" style="grid-column:1 / span 4">${esc(c.chapters.compound)}</p>
      <h2 class="h1" style="grid-column:1 / span 7;margin-top:6mm">${esc(s.label)}</h2>
      <p class="lead" style="grid-column:9 / span 4;margin-top:6mm;align-self:end">${esc(m.home.hero.description)}</p>
    </div>
    <div class="numbers__grid">
      ${stats
        .map(
          ([v, u, l]) => `<div class="stat">
            <p class="stat__v">${num(v)}${u ? `<span class="u">${esc(u)}</span>` : ''}</p>
            <p class="stat__l">${esc(l)}</p>
          </div>`,
        )
        .join('')}
    </div>`,
    { cls: 'page--night', chapter: 'compound' },
  );

  // Who Retal is for ---------------------------------------------------------
  {
    const a = AUDIENCE[locale];
    const proof = audienceProof(m, a, { destinations, residences, minUnit });
    const looks = { families: 'living/playground-train', executives: 'residences/3br-town-villa/study', discerning: 'clubhouse/cinema-portrait' };
    page(
      `<div class="grid" style="bottom:auto">
        <div style="grid-column:1 / span 6" class="stack">
          <p class="eyebrow">${esc(a.eyebrow)}</p>
          <h2 class="h2">${a.words.map((w) => esc(w)).join('<br>')}</h2>
        </div>
        <p class="small" style="grid-column:8 / span 5;align-self:end">${esc(a.intro)}</p>
      </div>
      <div class="aud">
        ${Object.entries(a.groups)
          .map(
            ([k, g], i) => `<div>
              <div class="aud__img">${img(looks[k])}</div>
              <p class="aud__label"><span class="copper">${num(pad(i + 1))}</span><span class="micro">${esc(g.name)}</span></p>
              <h3 class="h4">${esc(g.title.replace(/\n/g, ' '))}</h3>
              <p class="small" style="margin-top:2mm">${esc(g.lead)}</p>
              <ul class="aud__figs">${proof[k].figures
                .slice(0, 2)
                .map(([v, u, l]) => `<li><b>${num(v)}${u ? ` <small>${esc(u)}</small>` : ''}</b><span>${esc(l)}</span></li>`)
                .join('')}</ul>
            </div>`,
          )
          .join('')}
      </div>`,
      { chapter: 'audience' },
    );
  }

  // 06 Residences opener ----------------------------------------------------
  const chapterNo = (k) => pad(Object.keys(c.chapters).indexOf(k) + 1);
  page(
    `${ph('opener__img', 'site/street-palms-portrait', '50% 50%')}
    <div class="opener__text">
      <p class="chapter-no">${chapterNo('residences')}</p>
      <p class="eyebrow" style="margin-top:3mm">${esc(c.chapters.residences)}</p>
      <h2 class="h1 br" style="margin-top:9mm">${esc(m.home.residences.title)}</h2>
      <p class="lead" style="margin-top:7mm;max-width:100mm">${esc(m.home.residences.intro)}</p>
      <div class="included">
        <p class="micro" style="grid-column:1 / -1;margin-bottom:2.5mm">${esc(m.residences.index.included)}</p>
        ${['furnished', 'appliances', 'garage', 'internet'].map((k) => `<li>${esc(m.residences.features[k])}</li>`).join('')}
      </div>
    </div>`,
    { chapter: 'residences', folio: [14, 162] },
  );

  // 07 The collection (table) -------------------------------------------------
  const tb = m.residences.table;
  page(
    `<div class="grid" style="bottom:auto">
      <div style="grid-column:1 / span 7" class="stack">
        <p class="eyebrow">${esc(m.residences.index.eyebrow)}</p>
        <h2 class="h2 br">${esc(m.residences.index.title)}</h2>
      </div>
      <p class="small" style="grid-column:9 / span 4;align-self:end">${esc(m.residences.index.intro)}</p>
    </div>
    <table class="table">
      <thead><tr>
        <th></th><th></th><th>${esc(tb.name)}</th><th>${esc(tb.type)}</th><th>${esc(tb.size)}</th>
        <th>${esc(tb.beds)}</th><th>${esc(tb.baths)}</th><th>${esc(m.residences.detail.floors)}</th>
        <th>${esc(m.home.residences.specs.extras)}</th>
      </tr></thead>
      <tbody>
        ${residences
          .map(
            (r, i) => `<tr>
              <td style="width:25mm"><div class="thumb">${img(r.cover)}</div></td>
              <td class="idx">${pad(i + 1)}</td>
              <td class="name">${esc(name(r))}</td>
              <td>${esc(m.residences.types[r.type])}</td>
              <td class="fig">${num(r.size)}<span class="unit">${esc(sqm)}</span></td>
              <td class="fig">${num(r.bedrooms)}</td>
              <td class="fig">${num(r.bathrooms)}</td>
              <td class="fig">${num(r.floors)}</td>
              <td style="width:52mm">${r.extras.length ? r.extras.map((e) => esc(m.residences.extras[e])).join(' · ') : '—'}</td>
            </tr>`,
          )
          .join('')}
      </tbody>
    </table>`,
    { chapter: 'residences' },
  );

  // 08–14 One page per residence -------------------------------------------
  const resPhotos = {
    '1br-apartment': ['living-kitchen', 'kitchen', 'bedroom'],
    '2br-apartment': ['living-dining', 'kitchen', 'bedroom'],
    '3br-apartment': ['living-room', 'kitchen', 'master-bedroom'],
    '2br-town-villa': ['living-room', 'dining', 'twin-bedroom'],
    '3br-town-villa': ['living-dining', 'entrance', 'master-bedroom'],
    '3br-executive-villa': ['living-room', 'dining', 'backyard'],
    '4br-executive-villa': ['living-dining', 'kitchen-garden', 'master-suite'],
  };
  const det = m.residences.detail;
  residences.forEach((r, i) => {
    const [main, a, b] = resPhotos[r.code].map((k) => `residences/${r.code}/${k}`);
    const links = [
      `<a href="https://www.youtube.com/watch?v=${r.youtube}">${esc(det.video)}</a>`,
      r.vrTour ? `<a href="https://tours.affinitypropertybh.com/show/?m=${r.vrTour}">${esc(det.tour)}</a>` : '',
    ].join('');
    page(
      `${ph('res__main', main)}${ph('res__a', a)}${ph('res__b', b)}
      <div class="res__text">
        <div class="res__top">
          <span class="micro">${num(pad(i + 1))} ${esc(c.residenceOf)} ${num(pad(residences.length))}</span>
          <span class="pill pill--copper">${esc(m.residences.types[r.type])}</span>
        </div>
        <h2 class="h2 res__name">${esc(name(r))}</h2>
        <p class="res__summary">${esc(m.residences.items[r.slug].summary)}</p>
        <div class="specs">
          <div><p class="v">${num(r.size)}<small>${esc(sqm)}</small></p><p class="k">${esc(det.size)}</p></div>
          <div><p class="v">${num(r.bedrooms)}</p><p class="k">${esc(det.bedrooms)}</p></div>
          <div><p class="v">${num(r.bathrooms)}</p><p class="k">${esc(det.bathrooms)}</p></div>
          <div><p class="v">${num(r.floors)}</p><p class="k">${esc(det.floors)}</p></div>
        </div>
        <p class="small res__desc">${esc(m.residences.items[r.slug].description)}</p>
        <div class="pills res__extras">
          ${[...r.extras.map((e) => m.residences.extras[e]), m.residences.features.garage]
            .map((t) => `<span class="pill">${esc(t)}</span>`)
            .join('')}
        </div>
        <div class="plan">
          <img src="${src(r.plan)}" alt="${esc(alt(r.plan))}">
          <span class="micro plan__label">${esc(det.plan)}</span>
          <span class="links micro">${links}</span>
        </div>
      </div>`,
      { cls: i % 2 ? 'res res--flip' : 'res', chapter: 'residences', folio: i % 2 ? [14, 171] : [171, 14] },
    );
  });

  // 15 Clubhouse opener -------------------------------------------------------
  page(
    `${ph('club__img', 'clubhouse/facade-night-wide', '50% 62%')}
    <div class="club__text">
      <div style="grid-column:1 / span 5">
        <p class="chapter-no">${chapterNo('clubhouse')}</p>
        <p class="eyebrow" style="margin-top:3mm">${esc(m.clubhouse.hero.eyebrow)}</p>
        <h2 class="h1 br" style="margin-top:6mm">${esc(m.clubhouse.hero.title)}</h2>
      </div>
      <p class="body" style="grid-column:6 / span 3">${esc(m.clubhouse.intro)}</p>
      <div class="figs" style="grid-column:10 / span 3;justify-content:flex-end">
        ${['cinema', 'bowling', 'amenities']
          .map((k) => `<div><p class="v">${num(f[k].value)}</p><p class="l">${esc(f[k].label)}</p></div>`)
          .join('')}
      </div>
    </div>`,
    { cls: 'page--night', chapter: 'clubhouse' },
  );

  // 16–18 Clubhouse categories --------------------------------------------
  const catPhotos = {
    dining: ['clubhouse/lobby', 'clubhouse/mini-market', 'tour/restaurant', 'clubhouse/laundry'],
    family: ['clubhouse/cinema', 'clubhouse/bowling-portrait', 'clubhouse/billiards-portrait', 'tour/library'],
    sport: ['clubhouse/pool-terrace', 'clubhouse/gym', 'tour/indoor-pool', 'clubhouse/tennis-night'],
  };
  amenityCategories.forEach((cat, i) => {
    const [lead, p1, p2, p3] = catPhotos[cat.key];
    const night = cat.key === 'family';
    page(
      `${ph('cat__lead', lead)}${ph('cat__row cat__row--3', p1)}${ph('cat__row cat__row--2', p2)}${ph('cat__row cat__row--1', p3)}
      <div class="cat__text">
        <p class="cat__big-n">${num(pad(i + 1))}</p>
        <p class="eyebrow" style="margin-top:7mm">${esc(m.clubhouse.hero.eyebrow)}</p>
        <h2 class="h2" style="margin-top:4mm">${esc(m.clubhouse.categories[cat.key].title)}</h2>
        <p class="body" style="margin-top:4mm">${esc(m.clubhouse.categories[cat.key].body)}</p>
        <ul class="hl cat__list">
          ${cat.amenities.map((a, j) => `<li><span class="n">${num(pad(j + 1))}</span><span class="small" style="color:inherit">${esc(m.clubhouse.amenities[a])}</span></li>`).join('')}
        </ul>
      </div>`,
      {
        cls: `cat ${i === 1 ? 'cat--flip' : ''} ${night ? 'page--night' : ''}`,
        chapter: 'clubhouse',
        folio: i === 1 ? [197, 14] : [14, 197],
      },
    );
  });

  // 19 Pools at night ---------------------------------------------------------
  page(
    `${ph('bleed', 'clubhouse/pool-night', '50% 55%')}
    <div class="caption-panel caption-panel--night caption-panel--end stack" style="--s:3.5mm">
      <p class="eyebrow">${esc(m.clubhouse.gallery.eyebrow)}</p>
      <h2 class="h3">${esc(m.home.clubhouse.items.pools.body)}</h2>
    </div>`,
    { chapter: 'clubhouse', folio: false },
  );

  // 20 360° tour ---------------------------------------------------------------
  const groups = ['services', 'wellness', 'family', 'sport'];
  let sceneNo = 0;
  page(
    `<div class="tour__head stack">
      <p class="eyebrow">${esc(m.clubhouse.tour.eyebrow)}</p>
      <h2 class="h2 br">${esc(m.clubhouse.tour.title)}</h2>
      <p class="body">${esc(c.tourBody)}</p>
      <p class="micro links"><a href="${url('/clubhouse')}">${esc(c.tourOpen)} · ${esc(show(url('/clubhouse')))}</a></p>
    </div>
    <div class="tour__rooms">
      ${groups
        .map(
          (g) => `<div>
            <p class="micro">${esc(c.groups[g])}</p>
            <ol>${scenes
              .filter((sc) => sc.group === g)
              .map((sc) => `<li><span>${num(pad(++sceneNo))}</span>${esc(m.clubhouse.tour.scenes[sc.slug])}</li>`)
              .join('')}</ol>
          </div>`,
        )
        .join('')}
    </div>
    <div class="tour__strip">
      ${['lobby', 'spa', 'moroccan-bath', 'jacuzzi', 'sports-hall', 'squash']
        .map((k) => `<figure>${img(`tour/${k}`)}<figcaption>${esc(m.clubhouse.tour.scenes[k])}</figcaption></figure>`)
        .join('')}
    </div>`,
    { chapter: 'clubhouse', folio: false },
  );

  // 21 Living ---------------------------------------------------------------
  const lv = m.living;
  const themePhotos = {
    schools: 'tour/early-learning',
    shopping: 'clubhouse/mini-market',
    healthcare: 'site/villa-corner',
    community: 'living/playground',
  };
  page(
    `<div class="living__head">
      <div style="grid-column:1 / span 7">
        <p class="chapter-no">${chapterNo('living')}</p>
        <p class="eyebrow" style="margin-top:3mm">${esc(m.home.living.eyebrow)}</p>
        <h2 class="h1 br" style="margin-top:6mm">${esc(m.home.living.title)}</h2>
      </div>
      <p class="body" style="grid-column:9 / span 4">${esc(lv.intro)}</p>
    </div>
    <div class="themes">
      ${Object.keys(themePhotos)
        .map(
          (k) => `<div class="theme">
            <div class="theme__img">${img(themePhotos[k])}</div>
            <p class="theme__label"><span class="micro">${esc(lv.themes[k].label)}</span><span class="theme__fact">${esc(c.facts[k])}</span></p>
            <h3 class="h4">${esc(lv.themes[k].title)}</h3>
            <p class="small" style="margin-top:2mm">${esc(lv.themes[k].body)}</p>
          </div>`,
        )
        .join('')}
    </div>`,
    { chapter: 'living' },
  );

  // 22 Outdoors -----------------------------------------------------------------
  page(
    `${ph('split-img', 'site/street-dusk', '42% 50%')}
    <div class="split-text">
      <p class="eyebrow">${esc(lv.outdoors.eyebrow)}</p>
      <h2 class="h2" style="margin-top:6mm">${esc(lv.outdoors.title)}</h2>
      <p class="body" style="margin-top:5mm">${esc(lv.outdoors.body)}</p>
      <div class="pair">
        <div>${img('living/kids-zone-dusk')}</div>
        <div>${img('living/garden-bench')}</div>
      </div>
    </div>`,
    { chapter: 'living', folio: [180, 14] },
  );

  // 23 Security & services --------------------------------------------------
  const sec = m.home.security;
  page(
    `${ph('sec__guard', 'site/gate-canopy-dusk', '50% 50%')}${ph('sec__check', 'site/gate-barrier-dusk', '50% 50%')}
    <div class="sec__head">
      <p class="chapter-no">${chapterNo('security')}</p>
      <p class="eyebrow" style="margin-top:3mm">${esc(sec.eyebrow)}</p>
      <h2 class="h1 br" style="margin-top:6mm">${esc(sec.title)}</h2>
      <p class="body" style="margin-top:6mm;max-width:105mm">${esc(sec.body)}</p>
    </div>
    <ul class="hl sec__list">
      ${Object.values(sec.services).map((t, j) => `<li><span class="n">${num(pad(j + 1))}</span>${esc(t)}</li>`).join('')}
    </ul>`,
    { cls: 'page--deep', chapter: 'security', folio: [108, 90] },
  );

  // 24 Location ---------------------------------------------------------------
  const mk = markers['neighborhood-portrait'];
  const inFrame = (p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  const pins = Object.entries(mk.points)
    .filter(([, p]) => inFrame(p))
    .map(([k, p]) => {
      const home = k === 'retal';
      const label = home ? m.neighborhood.you : m.neighborhood.short[k];
      // BISAK sits right beside Retal: its label goes to the other side.
      const left = k === 'bisak' || k === 'aramco';
      return `<div class="pin ${home ? 'pin--home' : ''} ${left ? 'pin--left' : ''}" style="left:${p.x * 100}%;top:${p.y * 100}%"><i></i><span>${esc(label)}</span></div>`;
    })
    .join('');
  const areas = Object.entries(mk.areas)
    .filter(([, p]) => inFrame(p))
    .map(([k, p]) => `<div class="area" style="left:${p.x * 100}%;top:${p.y * 100}%">${esc(m.neighborhood.areas[k])}</div>`)
    .join('');
  page(
    `<figure class="ph map">${img('map/neighborhood-portrait')}<div class="map__inner">${areas}${pins}</div></figure>
    <div class="split-text" style="--w:168mm">
      <p class="chapter-no">${chapterNo('location')}</p>
      <p class="eyebrow" style="margin-top:3mm">${esc(m.home.neighborhood.eyebrow)}</p>
      <h2 class="h2 br" style="margin-top:5mm">${esc(m.home.neighborhood.title)}</h2>
      <p class="small" style="margin-top:4mm">${esc(m.home.neighborhood.intro)}</p>
      <ul class="hl drive" style="margin-top:auto">
        ${destinations
          .map(
            (d) => `<li><span class="m">${num(d.minutes)}<small>${esc(minUnit(d.minutes))}</small></span><span class="small" style="color:inherit">${esc(m.neighborhood.destinations[d.key])}</span></li>`,
          )
          .join('')}
      </ul>
      <p class="micro" style="margin-top:4mm">${esc(c.coordinates)} · ${num('26.3771° N, 50.2195° E')} · ${esc(m.neighborhood.byCar)}</p>
    </div>`,
    { chapter: 'location', folio: [180, 14] },
  );

  // 25 Around the compound ----------------------------------------------------
  page(
    `<div class="gallery__head">
      <p class="eyebrow" style="grid-column:1 / span 4;margin-top:2mm">${esc(m.home.gallery.eyebrow)}</p>
      <h2 class="h2" style="grid-column:5 / span 8">${esc(m.living.hero.subtitle)}</h2>
    </div>
    <div class="mosaic">
      <div class="tall">${img('site/aerial-villas')}</div>
      <div>${img('clubhouse/pool-umbrellas')}</div>
      <div>${img('living/benches-evening')}</div>
      <div class="wide">${img('clubhouse/reception', '50% 55%')}</div>
    </div>`,
    { chapter: 'location', folio: false },
  );

  // 26 Visit --------------------------------------------------------------------
  const ft = m.footer;
  const ct = m.contact;
  page(
    `${ph('visit__img', 'clubhouse/corridor', '50% 50%')}
    <div class="visit__body">
      <p class="chapter-no">${chapterNo('visit')}</p>
      <p class="eyebrow" style="margin-top:3mm">${esc(m.home.visit.eyebrow)}</p>
      <h2 class="display br" style="margin-top:8mm">${esc(ft.statement)}</h2>
      <p class="lead" style="margin-top:7mm;max-width:120mm">${esc(m.home.visit.body)}</p>
      <div class="contacts">
        <div>
          <p class="micro">${esc(ft.visit)}</p>
          <p dir="ltr" style="text-align:start">${esc(contact.company)}<br>${esc(contact.address.street)}<br>${esc(contact.address.city)} ${esc(contact.address.postalCode)}</p>
          <p>${esc(c.country)}</p>
        </div>
        <div>
          <p class="micro">${esc(ct.main)}</p>
          <p><a href="${contact.phone.href}">${num(contact.phone.display)}</a></p>
          <p class="micro">${esc(ct.reservations)}</p>
          <p>${contact.reservations.map((r) => `<a href="${r.href}">${num(r.display)}</a>`).join('<br>')}</p>
        </div>
        <div>
          <p class="micro">${esc(ct.email)}</p>
          <p><a href="mailto:${contact.email}">${esc(contact.email)}</a></p>
          <p class="micro">${esc(ct.sales)}</p>
          <p><a href="mailto:${contact.salesEmail}">${esc(contact.salesEmail)}</a></p>
          <p class="micro">${esc(ct.whatsapp)}</p>
          <p><a href="${contact.whatsapp.href}">${num(contact.whatsapp.display)}</a></p>
        </div>
        <div>
          <p class="micro">${esc(ft.follow)}</p>
          <p>${social.map((x) => `<a href="${x.href}">${esc(ft.social[x.key])}</a>`).join('<br>')}</p>
          <p class="micro">${esc(c.website)}</p>
          <p><a href="${url()}">${esc(show(SITE_URL))}</a></p>
        </div>
      </div>
    </div>`,
    { cls: 'page--night', chapter: 'visit', folio: [14, 96] },
  );

  // 27 Back cover --------------------------------------------------------------
  page(
    `<svg class="back__mark" viewBox="0 0 51 119" aria-hidden="true"><path d="${MARK}" fill="var(--copper)"/></svg>
    <div class="back__foot">
      <div style="width:70mm;color:var(--bone)">${logo()}</div>
      <div style="text-align:end" class="stack" style="--s:2mm">
        <p class="h3"><a href="${url()}">${esc(show(SITE_URL))}</a></p>
        <p class="micro">${esc(m.home.hero.location)} · <span dir="ltr">${esc(contact.phone.display)}</span></p>
      </div>
    </div>`,
    { cls: 'page--night', folio: false },
  );

  // Contents, now that chapter start pages are known.
  pages[contentsIndex].html = `${ph('contents__img', 'site/gate-dusk-portrait', '50% 50%')}
    <div class="contents__body">
      <div class="stack" style="--s:5mm">
        <p class="eyebrow">${esc(c.contents)}</p>
        <p class="lead" style="max-width:120mm;color:var(--ink)">${esc(c.about)}</p>
      </div>
      <ol class="toc">
        ${Object.entries(c.chapters)
          .map(
            ([k, t], i) => `<li><span class="n">${num(pad(i + 1))}</span><span class="t">${esc(t)}</span><span class="p">${num(pad(chapterStart[k]))}</span></li>`,
          )
          .join('')}
      </ol>
    </div>`;

  const total = pages.length;
  const body = pages
    .map((p, i) => {
      const folio = p.folio
        ? `<footer class="folio" style="inset-inline:${p.folio[0]}mm ${p.folio[1]}mm"><span><b>${esc(m.home.statement.eyebrow)}</b>${p.chapter ? ` · ${esc(c.chapters[p.chapter])}` : ''}</span><span>${num(`${pad(i + 1)} / ${pad(total)}`)}</span></footer>`
        : '';
      return `<section class="page ${p.cls}">${p.html}${folio}</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="${locale}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)}</title>
<meta name="author" content="Retal Residence">
<link rel="stylesheet" href="profile.css">
</head>
<body>
${body}
<script>
  // On screen, scale the pages to the window; print and PDF always use the true A4 size.
  (function () {
    if (document.body.classList.contains('shot')) return;
    var fit = function () {
      var w = document.querySelector('.page').getBoundingClientRect().width / (parseFloat(getComputedStyle(document.body).zoom) || 1);
      document.body.style.setProperty('--fit', Math.min(1.25, (window.innerWidth - 24) / w));
    };
    fit();
    window.addEventListener('resize', fit);
  })();
</script>
</body>
</html>`;
}

async function exportPhotos() {
  for (const src of used) {
    const out = path.join(CACHE, src);
    if (await stat(out).catch(() => null)) continue;
    await mkdir(path.dirname(out), { recursive: true });
    await sharp(path.join(ROOT, 'public', src))
      .resize(PHOTO_MAX, PHOTO_MAX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true, progressive: true })
      .toFile(out);
  }
}

const MESSAGES = Object.fromEntries(
  await Promise.all(LOCALES.map(async (l) => [l, await readFile(path.join(ROOT, `messages/${l}.json`), 'utf8')])),
);

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const locale of LOCALES) {
    const htmlFile = path.join(OUT, `retal-residence-profile.${locale}.html`);
    await writeFile(htmlFile, render(locale));
    await exportPhotos();

    const page = await browser.newPage({ viewport: { width: 1123, height: 794 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    if (errors.length) throw new Error(errors.join('\n'));

    const pdfFile = path.join(OUT, `Retal-Residence-Profile-${locale.toUpperCase()}.pdf`);
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: pdfFile, preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
    console.log(path.relative(ROOT, pdfFile));

    if (SHOTS) {
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => document.body.classList.add('shot'));
      await page.evaluate(() => document.body.style.setProperty('--fit', '1'));
      await mkdir(SHOTS, { recursive: true });
      const sections = page.locator('section.page');
      const n = await sections.count();
      for (let i = 0; i < n; i++) {
        await sections.nth(i).screenshot({ path: path.join(SHOTS, `${locale}-${pad(i + 1)}.png`) });
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}
