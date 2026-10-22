#!/usr/bin/env node
// Company profile v2: "the mark as a window". The Retal mark's five staggered columns frame the
// photography; the rest reads like an architect's monograph — annotated plates, plans drawn light
// on night, the seven residences to scale, drive times as rings. Same content sources as the site.
//   npm run profile [-- --locales=en,ar] [-- --shots=<dir>]
// Writes profile/v2/retal-residence-profile.<locale>.html and profile/v2/Retal-Residence-Profile-v2-<LOCALE>.pdf.
import path from 'node:path';
import { ROOT, arg, loadContent, esc, pad, num, plural, photoLibrary, build, fitScript, AUDIENCE, audienceProof } from './shared.mjs';

const OUT = path.join(ROOT, 'profile/v2');
const LOCALES = arg('locales', 'en,ar').split(',');
const SHOTS = arg('shots', '');

const data = await loadContent(LOCALES);
const { residences, amenityCategories, MARK, WORD, contact, social, SITE_URL, destinations, scenes, messages } = data;
const photos = photoLibrary(data.manifest, OUT);

const LRI = '⁦';
const PDI = '⁩';

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
      visit: 'Visit',
    },
    fig: 'Fig.',
    plate: 'Plate',
    legend: {
      gate: 'Entrance gate',
      clubhouse: 'Clubhouse',
      pool: 'Main pool',
      kidsPool: 'Children’s pool',
      tennis: 'Tennis court',
      play: 'Play area',
      villas: 'Residences',
    },
    tourRooms: 'rooms in the Clubhouse 360° tour',
    tourBody: 'Every room of the Clubhouse, 26 in all, from the lobby to the squash courts. The full 360° tour is on retalresidence.com.',
    tourOpen: 'Take the tour',
    rings: 'Drive times from the gate, by car',
    scaleTitle: 'Seven residences,\ndrawn to scale',
    scaleNote: 'Each square has the floor area of the residence it stands for, from 84 to 363 m².',
    times: { schools: 'Morning', shopping: 'Midday', community: 'Evening' },
    dayTitle: 'A day at Retal',
    residence: 'Residence',
    coordinates: 'Coordinates',
    website: 'Website',
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
      visit: 'زيارة',
    },
    fig: 'شكل',
    plate: 'لوحة',
    legend: {
      gate: 'بوابة المدخل',
      clubhouse: 'النادي',
      pool: 'المسبح الرئيسي',
      kidsPool: 'مسبح الأطفال',
      tennis: 'ملعب التنس',
      play: 'منطقة ألعاب',
      villas: 'المساكن',
    },
    tourRooms: `مكانًا في جولة النادي بزاوية ${LRI}360°${PDI}`,
    tourBody: `كل أماكن النادي، ستة وعشرون مكانًا من الردهة إلى ملاعب الإسكواش. والجولة الكاملة بزاوية ${LRI}360°${PDI} على موقع ${LRI}retalresidence.com${PDI}.`,
    tourOpen: 'ابدأ الجولة',
    rings: 'مدة القيادة من البوابة بالسيارة',
    scaleTitle: 'سبعة مساكن\nبمقياس واحد',
    scaleNote: 'مساحة كل مربع تعادل مساحة المسكن الذي يمثّله، من 84 إلى 363 مترًا مربعًا.',
    times: { schools: 'صباحًا', shopping: 'ظهرًا', community: 'مساءً' },
    dayTitle: 'يومٌ في رتال',
    residence: 'المسكن',
    coordinates: 'الإحداثيات',
    website: 'الموقع الإلكتروني',
    country: 'المملكة العربية السعودية',
  },
};

const COORDS = '26.3771° N · 50.2195° E · Al Khobar';

// The mark's five columns (x0, x1, y0, y1 in its 51 × 119 drawing), traced from logo-paths.ts.
const COLUMNS = [
  [0, 8.5, 50.1, 96],
  [10.9, 19, 13.5, 107.4],
  [21.8, 30.7, 0, 118.8],
  [32.5, 41.2, 36, 107.1],
  [42.7, 51, 50, 96.1],
];

// Points on the aerial photo (fractions of the full frame), for the site plan's numbered markers.
const SITE_POINTS = [
  ['gate', 0.507, 0.235],
  ['clubhouse', 0.5, 0.47],
  ['pool', 0.5125, 0.622],
  ['kidsPool', 0.405, 0.633],
  ['tennis', 0.5125, 0.76],
  ['play', 0.265, 0.44],
  ['villas', 0.15, 0.5],
];

// Bearings on the drive-time diagram (degrees, 0 = along the axis); radius follows the minutes.
const BEARINGS = { bisak: -60, expo: 50, mall: -22, corniche: 18, hospital: 58, aramco: -62, causeway: 36, airport: -38 };

let clipId = 0;

function render(locale) {
  const m = messages[locale];
  const c = COPY[locale];
  const rtl = locale === 'ar';
  const alt = (id) => m.images?.[id] ?? '';
  const img = (id, pos = 'center') => `<img src="${photos.src(id)}" alt="${esc(alt(id))}" style="object-position:${pos}">`;
  const ph = (cls, id, pos, style = '') => `<figure class="ph ${cls}" style="${style}">${img(id, pos)}</figure>`;
  const minUnit = (n) => (rtl ? plural(m.common.minUnit, n, locale) : m.common.minUnit);
  const sqm = m.common.sqmUnit;
  const name = (r) => m.residences.items[r.slug].name;
  const url = (p = '') => `${SITE_URL}/${locale}${p}`;
  const show = (u) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const chapterKeys = Object.keys(c.chapters);
  const chapterNo = (k) => pad(chapterKeys.indexOf(k) + 1);
  const edge = (side = 'start') => {
    const left = (side === 'start') !== rtl;
    return `<p class="edge ${left ? 'edge--left' : 'edge--right'}">${esc(COORDS)}</p>`;
  };

  /** A photo seen through the Retal mark. */
  const markWindow = (cls, id, align = 'xMidYMid') => {
    const cid = `mark-${++clipId}`;
    return `<svg class="${cls}" viewBox="0 0 51 119" role="img" aria-label="${esc(alt(id))}">
      <defs><clipPath id="${cid}"><path d="${MARK}"/></clipPath></defs>
      <image href="${photos.src(id)}" x="0" y="0" width="51" height="119" preserveAspectRatio="${align} slice" clip-path="url(#${cid})"/>
    </svg>`;
  };

  /** A photo seen through the mark's five columns, stretched to w × h mm. */
  const columnWindow = (id, w, h, style = '') => {
    const cid = `cols-${++clipId}`;
    const rects = COLUMNS.map(
      ([x0, x1, y0, y1]) =>
        `<rect x="${((x0 / 51) * w).toFixed(2)}" y="${((y0 / 119) * h).toFixed(2)}" width="${(((x1 - x0) / 51) * w).toFixed(2)}" height="${(((y1 - y0) / 119) * h).toFixed(2)}"/>`,
    ).join('');
    return `<svg class="columns" style="width:${w}mm;height:${h}mm;${style}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(alt(id))}">
      <defs><clipPath id="${cid}">${rects}</clipPath></defs>
      <image href="${photos.src(id)}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cid})"/>
    </svg>`;
  };

  const wordmark = (fill = 'currentColor') => `<svg viewBox="0 0 160 52" role="img" aria-label="Retal Residence" direction="ltr">
    <path d="${WORD}" fill="${fill}" transform="scale(1.03)"/>
    <text x="1" y="50" fill="${fill}" font-size="10.5" letter-spacing="8.3" font-family="General Sans, Arial, sans-serif" font-weight="500" opacity="0.72">RESIDENCE</text>
  </svg>`;

  const pages = [];
  const chapterStart = {};
  /** `folio`: 'start' | 'end' (which bottom corner) or false. */
  const page = (html, { cls = '', chapter, folio = 'end' } = {}) => {
    if (chapter && !(chapter in chapterStart)) chapterStart[chapter] = pages.length + 1;
    pages.push({ html, cls, chapter, folio });
  };

  // 01 Cover ----------------------------------------------------------------
  page(
    `${markWindow('cover__window', 'clubhouse/pool-night-portrait')}
    <div class="cover__word">${wordmark()}</div>
    <div class="cover__title stack" style="--s:6mm">
      <p class="eyebrow">${esc(c.profile)}</p>
      <h1 class="display br">${esc(m.home.hero.title)}</h1>
      <p class="lead">${esc(m.home.hero.subtitle)}</p>
    </div>
    <div class="cover__meta micro"><span>${esc(m.home.hero.location)}</span><span>${esc(c.edition)}</span></div>
    ${edge('end')}`,
    { cls: 'page--night', folio: false },
  );

  // 02 Contents (filled in once every page exists) ---------------------------
  const contentsIndex = pages.length;
  page('', { folio: 'end' });

  // 03 Prologue -------------------------------------------------------------
  page(
    `${ph('prologue__strip', 'clubhouse/marble-bench', '50% 60%')}
    ${edge('start')}
    <div class="prologue__text stack" style="--s:9mm">
      <p class="eyebrow">${esc(m.home.statement.eyebrow)}</p>
      <p class="prologue__statement">${esc(m.home.statement.text)}</p>
    </div>
    <div class="principles">
      ${['design', 'stroll', 'security']
        .map(
          (k, i) => `<div>
            <p class="outline">${pad(i + 1)}</p>
            <h3 class="h4">${esc(m.home.statement.principles[k].title)}</h3>
            <p class="small" style="margin-top:2.5mm">${esc(m.home.statement.principles[k].body)}</p>
          </div>`,
        )
        .join('')}
    </div>`,
    { chapter: 'compound', folio: 'start' },
  );

  // 04 Site plan: the aerial with numbered markers ---------------------------
  {
    const id = 'site/aerial-compound';
    const { width, height } = photos.size(id);
    const scale = Math.max(297 / width, 210 / height);
    const ox = (297 - width * scale) / 2;
    const oy = (210 - height * scale) / 2;
    const markers = SITE_POINTS.map(
      ([, fx, fy], i) =>
        `<div class="marker" style="left:${(fx * width * scale + ox).toFixed(1)}mm;top:${(fy * height * scale + oy).toFixed(1)}mm"><i>${i + 1}</i></div>`,
    ).join('');
    page(
      `${ph('bleed', id)}${markers}
      <div class="legend" style="left:auto;right:0">
        <p class="fig" style="margin:0"><b>${esc(c.fig)} 01</b><span>${esc(m.neighborhood.aerial.eyebrow)}</span></p>
        <h2 class="h3" style="margin-top:3mm">${esc(m.neighborhood.aerial.title)}</h2>
        <p class="small" style="margin-top:2.5mm">${esc(m.neighborhood.aerial.body)}</p>
        <ol>${SITE_POINTS.map(([k], i) => `<li><b>${num(i + 1)}</b>${esc(c.legend[k])}</li>`).join('')}</ol>
      </div>`,
      { chapter: 'compound', folio: false },
    );
  }

  // 05 In numbers -------------------------------------------------------------
  const s = m.home.stats;
  const f = m.clubhouse.figures;
  const ledger = [
    [s.size.value, s.size.unit, s.size.label],
    [s.security.value, '', s.security.label],
    [s.school.value, s.school.unit, s.school.label],
    [f.amenities.value, '', f.amenities.label],
    [f.cinema.value, '', f.cinema.label],
    [f.bowling.value, '', f.bowling.label],
    [String(scenes.length), '', c.tourRooms],
  ];
  page(
    `${edge('start')}
    <p class="eyebrow abs" style="top:var(--m);inset-inline-start:calc(var(--m) + 8mm)">${esc(c.chapters.compound)}</p>
    <h2 class="h1 abs" style="top:28mm;inset-inline-start:calc(var(--m) + 8mm);width:120mm">${esc(s.label)}</h2>
    <p class="mega">${num(s.types.value)}</p>
    <p class="mega-label h4">${esc(s.types.label)}</p>
    <ul class="ledger">
      ${ledger.map(([v, u, l]) => `<li><span class="v">${num(v)}${u ? `<small>${esc(u)}</small>` : ''}</span><span class="l">${esc(l)}</span></li>`).join('')}
    </ul>`,
    { cls: 'page--stone', chapter: 'compound' },
  );

  // 06 Minutes from the gate -------------------------------------------------
  {
    const W = 178;
    const cx = 34;
    const cy = 110;
    const R = (min) => 140 * Math.sqrt(min / 45);
    const X = (x) => (rtl ? W - x : x);
    const ringMinutes = [...new Set(destinations.map((d) => d.minutes))];
    const rings = ringMinutes
      .map((min) => `<circle cx="${X(cx)}" cy="${cy}" r="${R(min).toFixed(1)}" fill="none" stroke="var(--night-line)" stroke-width="0.25"/>`)
      .join('');
    const ticks = ringMinutes
      .map((min, i) => {
        const x = X(cx + R(min));
        const unit = i === ringMinutes.length - 1 ? ` ${minUnit(min)}` : '';
        return `<line x1="${x}" y1="${cy - 1.2}" x2="${x}" y2="${cy + 1.2}" stroke="var(--bone-soft)" stroke-width="0.25"/>
          <text class="lbl" x="${x}" y="${cy + 4.6}" font-size="2.3" fill="var(--bone-soft)" text-anchor="middle" direction="${rtl ? 'rtl' : 'ltr'}">${min}${esc(unit)}</text>`;
      })
      .join('');
    const points = destinations
      .map((d) => {
        const a = (BEARINGS[d.key] * Math.PI) / 180;
        const x = X(cx + R(d.minutes) * Math.cos(a));
        const y = cy + R(d.minutes) * Math.sin(a);
        const towardEnd = d.key !== 'airport';
        const anchor = towardEnd !== rtl ? 'start' : 'end';
        const dx = (towardEnd !== rtl ? 1 : -1) * 2.6;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1" fill="var(--bone)"/>
          <text class="lbl" x="${(x + dx).toFixed(1)}" y="${(y + 0.9).toFixed(1)}" font-size="2.6" fill="var(--bone)" text-anchor="${anchor}" direction="${rtl ? 'rtl' : 'ltr'}">${esc(m.neighborhood.short[d.key])}<tspan fill="var(--copper)"> ${d.minutes}</tspan></text>`;
      })
      .join('');
    page(
      `<svg class="rings" viewBox="0 0 ${W} 210" role="img" aria-label="${esc(c.rings)}">
        ${rings}
        <line x1="${X(cx)}" y1="${cy}" x2="${X(W)}" y2="${cy}" stroke="var(--night-line)" stroke-width="0.25"/>
        ${ticks}
        <circle cx="${X(cx)}" cy="${cy}" r="5" fill="var(--copper)" opacity="0.22"/>
        <circle cx="${X(cx)}" cy="${cy}" r="2.2" fill="var(--copper)"/>
        <text class="lbl" x="${X(cx)}" y="${cy - 7}" font-size="2.6" font-weight="500" fill="var(--bone)" text-anchor="middle" letter-spacing="${rtl ? 0 : 0.4}">${esc(m.neighborhood.you)}</text>
        ${points}
      </svg>
      <div class="side-text" style="--w:98mm">
        <p class="eyebrow">${esc(m.home.neighborhood.eyebrow)}</p>
        <h2 class="h2 br" style="margin-top:6mm">${esc(m.home.neighborhood.title)}</h2>
        <p class="small" style="margin-top:4mm">${esc(m.home.neighborhood.intro)}</p>
        <p class="fig" style="margin-top:auto"><b>${esc(c.fig)} 02</b><span>${esc(c.rings)}</span></p>
        <ul class="hl drive" style="margin-top:3mm">
          ${destinations
            .map(
              (d) =>
                `<li><span class="m">${num(d.minutes)}<small>${esc(minUnit(d.minutes))}</small></span><span class="small" style="color:inherit">${esc(m.neighborhood.destinations[d.key])}</span></li>`,
            )
            .join('')}
        </ul>
      </div>`,
      { cls: 'page--night', chapter: 'compound' },
    );
  }

  // Who Retal is for: an opener with the three audiences set large, then a page for each ----
  {
    const a = AUDIENCE[locale];
    const proof = audienceProof(m, a, { destinations, residences, minUnit });
    const keys = Object.keys(a.groups);
    const first = pages.length + 2;
    page(
      `${columnWindow('site/aerial-villas', 150, 210, 'inset-inline-end:0')}
      <div class="aud__text">
        <p class="outline chapter-no">${chapterNo('audience')}</p>
        <p class="eyebrow" style="margin-top:8mm">${esc(a.eyebrow)}</p>
        <div class="aud__words" style="margin-top:7mm">${a.words.map((w) => `<p>${esc(w)}</p>`).join('')}</div>
        <p class="body" style="margin-top:7mm">${esc(a.intro)}</p>
        <ol class="aud__index">
          ${keys.map((k, i) => `<li><span class="n">${num(pad(i + 1))}</span><span>${esc(a.groups[k].name)}</span><span class="micro">${num(pad(first + i))}</span></li>`).join('')}
        </ol>
      </div>`,
      { cls: 'page--night', chapter: 'audience', folio: 'start' },
    );
    const looks = {
      families: ['living/playground-train', '', '45% 50%'],
      executives: ['residences/3br-town-villa/study', 'page--stone', '50% 50%'],
      discerning: ['clubhouse/pool-terrace', 'page--night', '40% 50%'],
    };
    keys.forEach((k, i) => {
      const g = a.groups[k];
      const [photo, tone, pos] = looks[k];
      const flip = i % 2 === 1;
      page(
        `${ph('aud__photo', photo, pos)}
        <div class="aud__body">
          <div class="aud__head"><p class="outline">${pad(i + 1)}</p><p class="eyebrow">${esc(g.name)}</p></div>
          <h2 class="h1 br" style="margin-top:7mm">${esc(g.title)}</h2>
          <p class="body" style="margin-top:5mm">${esc(g.lead)}</p>
          <ul class="aud__figs">
            ${proof[k].figures.map(([v, u, l]) => `<li><span class="v">${num(v)}${u ? `<small>${esc(u)}</small>` : ''}</span><span class="l">${esc(l)}</span></li>`).join('')}
          </ul>
          <div class="pills" style="margin-top:5mm">${proof[k].amenities.map((t) => `<span class="pill">${esc(t)}</span>`).join('')}</div>
        </div>`,
        { cls: `aud ${flip ? 'aud--flip' : ''} ${tone}`, chapter: 'audience', folio: flip ? 'start' : 'end' },
      );
    });
  }

  // 07 Residences opener: a room seen through the mark's columns -------------
  page(
    `${columnWindow('residences/3br-town-villa/living-room', 168, 210, 'inset-inline-end:0')}
    ${edge('start')}
    <div class="opener__text">
      <p class="outline chapter-no">${chapterNo('residences')}</p>
      <p class="eyebrow" style="margin-top:8mm">${esc(c.chapters.residences)}</p>
      <h2 class="h1 br" style="margin-top:7mm">${esc(m.home.residences.title)}</h2>
      <p class="body" style="margin-top:6mm">${esc(m.home.residences.intro)}</p>
      <ul class="hl" style="margin-top:auto">
        ${['furnished', 'appliances', 'garage', 'internet'].map((k, i) => `<li><span class="n">${num(pad(i + 1))}</span><span class="small" style="color:inherit;font-weight:500">${esc(m.residences.features[k])}</span></li>`).join('')}
      </ul>
    </div>`,
    { chapter: 'residences', folio: 'start' },
  );

  // 08 To scale -------------------------------------------------------------
  {
    const maxSide = 48;
    const maxArea = Math.max(...residences.map((r) => r.size));
    const side = (r) => maxSide * Math.sqrt(r.size / maxArea);
    const gap = 3.5;
    const groupWidth = (type) => {
      const list = residences.filter((r) => r.type === type);
      return list.reduce((w, r) => w + side(r), 0) + gap * (list.length - 1);
    };
    const groupTypes = [...new Set(residences.map((r) => r.type))];
    page(
      `<div class="abs" style="top:var(--m);inset-inline:var(--m);display:grid;grid-template-columns:1fr 1fr;column-gap:12mm;align-items:end">
        <div class="stack"><p class="eyebrow">${esc(m.residences.index.eyebrow)}</p><h2 class="h1 br">${esc(c.scaleTitle)}</h2></div>
        <p class="small">${esc(c.scaleNote)} ${esc(m.residences.index.intro)}</p>
      </div>
      <div class="scale__groups" style="bottom:${30 + maxSide + 14}mm">
        ${groupTypes.map((t) => `<div style="width:${groupWidth(t).toFixed(1)}mm"><span class="micro">${esc(m.residences.typesPlural[t])}</span></div>`).join('')}
      </div>
      <div class="scale">
        ${residences
          .map((r, i) => {
            const sd = side(r).toFixed(1);
            return `<div class="scale__item" style="width:${sd}mm">
              <div class="scale__sq ${r.size === maxArea ? 'scale__sq--max' : ''}" style="width:${sd}mm;height:${sd}mm"><span>${num(r.size)} ${esc(sqm)}</span></div>
              <p class="scale__cap"><b>${esc(name(r))}</b>${num(pad(i + 1))} · ${esc(plural(m.common.beds, r.bedrooms, locale))}</p>
            </div>`;
          })
          .join('')}
      </div>
      <div class="included-line">
        <span class="micro">${esc(m.residences.index.included)}</span>
        ${['furnished', 'appliances', 'garage', 'internet'].map((k) => `<span class="small" style="color:var(--ink);font-weight:500">${esc(m.residences.features[k])}</span>`).join('')}
      </div>`,
      { chapter: 'residences', folio: 'end' },
    );
  }

  // 09–15 One plate per residence ---------------------------------------------
  const resPhotos = {
    '1br-apartment': ['living-room', 'bedroom'],
    '2br-apartment': ['living-dining', 'kitchen-window'],
    '3br-apartment': ['living-room', 'master-bedroom'],
    '2br-town-villa': ['living-room-2', 'dining'],
    '3br-town-villa': ['living-portrait', 'entrance'],
    '3br-executive-villa': ['dining-stair', 'backyard'],
    '4br-executive-villa': ['living-room', 'master-suite'],
  };
  const det = m.residences.detail;
  residences.forEach((r, i) => {
    const [main, second] = resPhotos[r.code].map((k) => `residences/${r.code}/${k}`);
    const links = [
      `<a href="https://www.youtube.com/watch?v=${r.youtube}">${esc(det.video)}</a>`,
      r.vrTour ? `<a href="https://tours.affinitypropertybh.com/show/?m=${r.vrTour}">${esc(det.tour)}</a>` : '',
    ].join('');
    page(
      `${ph('res__photo', main)}
      <div class="res__text">
        <div class="res__top">
          <span class="micro">${esc(c.residence)} ${num(pad(i + 1))} / ${num(pad(residences.length))}</span>
          <span class="pill pill--copper">${esc(m.residences.types[r.type])}</span>
        </div>
        <div class="res__size"><span class="outline">${r.size}</span><small>${esc(sqm)}</small></div>
        <h2 class="h3" style="margin-top:5mm">${esc(name(r))}</h2>
        <ul class="spec">
          <li><span>${esc(det.bedrooms)}</span><span>${num(r.bedrooms)}</span></li>
          <li><span>${esc(det.bathrooms)}</span><span>${num(r.bathrooms)}</span></li>
          <li><span>${esc(det.floors)}</span><span>${num(r.floors)}</span></li>
          <li><span>${esc(det.garage)}</span><span>${esc(det.garageValue)}</span></li>
        </ul>
        <p class="small" style="margin-top:4mm">${esc(m.residences.items[r.slug].description)}</p>
        ${r.extras.length ? `<div class="pills" style="margin-top:3mm">${r.extras.map((e) => `<span class="pill">${esc(m.residences.extras[e])}</span>`).join('')}</div>` : ''}
        <div class="res__second">${img(second)}</div>
        <div class="fig" style="justify-content:space-between"><span><b>${esc(c.fig)} ${num(pad(i + 3))}</b></span><span class="links">${links}</span></div>
      </div>`,
      { cls: i % 2 ? 'res res--flip' : 'res', chapter: 'residences', folio: i % 2 ? 'start' : 'end' },
    );
  });

  // 16–18 Plates: floor plans, light on night -------------------------------
  const plateTypes = [...new Set(residences.map((r) => r.type))];
  plateTypes.forEach((type, pi) => {
    const list = residences.filter((r) => r.type === type);
    const cols = list.map((r) => (photos.size(r.plan).width / photos.size(r.plan).height > 2 ? '1.6fr' : '1fr')).join(' ');
    page(
      `<div class="plate__head">
        <div class="stack" style="--s:3mm">
          <p class="micro"><span class="copper">${esc(c.plate)} ${String.fromCharCode(65 + pi)}</span> · ${esc(det.plan)}</p>
          <h2 class="h2">${esc(m.residences.typesPlural[type])}</h2>
        </div>
        <p class="outline" style="font-size:54pt">${String.fromCharCode(65 + pi)}</p>
      </div>
      <div class="plate__row" style="grid-template-columns:${cols}">
        ${list
          .map(
            (r) => `<div class="plate__item">
              <div class="plate__plan"><img src="${photos.src(r.plan)}" alt="${esc(alt(r.plan))}"></div>
              <div class="plate__cap"><span class="h4">${esc(name(r))}</span><span class="micro">${num(r.size)} ${esc(sqm)}</span></div>
            </div>`,
          )
          .join('')}
      </div>`,
      { cls: 'page--night', chapter: 'residences', folio: 'end' },
    );
  });

  // 19 Clubhouse opener: the facade, and the word set large ------------------
  page(
    `${ph('club__img', 'clubhouse/facade-night-wide', '50% 62%')}
    <div class="club__row">
      <div class="stack" style="--s:3mm"><p class="micro"><span class="copper">${chapterNo('clubhouse')}</span> · ${esc(m.clubhouse.hero.eyebrow)}</p><p class="h4">${esc(m.clubhouse.hero.subtitle)}</p></div>
      <p class="small">${esc(m.clubhouse.intro)}</p>
      <div class="figs">${['cinema', 'bowling', 'amenities'].map((k) => `<div><p class="v">${num(f[k].value)}</p><p class="l">${esc(f[k].label)}</p></div>`).join('')}</div>
    </div>
    <p class="club__word">${esc(rtl ? m.clubhouse.hero.eyebrow : 'Clubhouse')}</p>`,
    { cls: 'page--night', chapter: 'clubhouse', folio: false },
  );

  // 20 Clubhouse index --------------------------------------------------------
  const indexPhotos = { dining: ['clubhouse/lobby-portrait', 66], family: ['clubhouse/cinema-portrait', 82], sport: ['clubhouse/pool-night-portrait', 56] };
  page(
    `<div class="abs" style="top:var(--m);inset-inline:var(--m);display:flex;justify-content:space-between;align-items:baseline">
      <p class="eyebrow">${esc(m.home.clubhouse.eyebrow)}</p>
      <p class="micro">${num(f.amenities.value)} ${esc(f.amenities.label)}</p>
    </div>
    <div class="index__cols">
      ${amenityCategories
        .map((cat, i) => {
          const [photo, h] = indexPhotos[cat.key];
          return `<div class="index__col">
            <div class="index__img" style="height:${h}mm">${img(photo)}</div>
            <div style="display:flex;align-items:baseline;gap:3mm;margin-top:5mm"><span class="copper micro">${num(pad(i + 1))}</span><h3 class="h3">${esc(m.clubhouse.categories[cat.key].title)}</h3></div>
            <p class="small" style="margin-top:2.5mm">${esc(m.clubhouse.categories[cat.key].body)}</p>
            <ul class="hl" style="margin-top:auto">${cat.amenities.map((a) => `<li><span class="small" style="color:inherit">${esc(m.clubhouse.amenities[a])}</span></li>`).join('')}</ul>
          </div>`;
        })
        .join('')}
    </div>`,
    { chapter: 'clubhouse' },
  );

  // 21 Family -----------------------------------------------------------------
  page(
    `${ph('family__img', 'clubhouse/cinema', '40% 50%')}
    <div class="family__text">
      <p class="eyebrow">${esc(m.clubhouse.categories.family.title)}</p>
      <p class="lead" style="margin-top:5mm">${esc(m.clubhouse.categories.family.body)}</p>
      <div class="stat-o" style="margin-top:10mm"><p class="outline">${num(f.cinema.value)}</p><p class="small">${esc(f.cinema.label)}</p></div>
      <div class="stat-o" style="margin-top:6mm"><p class="outline">${num(f.bowling.value)}</p><p class="small">${esc(f.bowling.label)}</p></div>
      <div class="ph" style="position:relative;height:46mm;margin-top:auto">${img('clubhouse/bowling')}</div>
      <p class="fig"><b>${esc(c.fig)} 10</b><span>${esc(m.clubhouse.tour.scenes.bowling)}</span></p>
    </div>`,
    { cls: 'page--night', chapter: 'clubhouse', folio: 'end' },
  );

  // 22 Sport: three columns, staggered like the mark -------------------------
  const sport = amenityCategories.find((cat) => cat.key === 'sport');
  const triW = (190 - 2 * 2.5) / 3;
  page(
    `<div class="tri">
      <figure style="inset-inline-start:0;top:0;bottom:34mm">${img('clubhouse/pool-reflection')}</figure>
      <figure style="inset-inline-start:${(triW + 2.5).toFixed(2)}mm;top:24mm;bottom:0">${img('clubhouse/gym')}</figure>
      <figure style="inset-inline-start:${(2 * (triW + 2.5)).toFixed(2)}mm;top:0;bottom:0">${img('clubhouse/tennis-sunset', '70% 50%')}</figure>
    </div>
    <div class="abs" style="top:var(--m);bottom:18mm;inset-inline-start:var(--m);width:78mm;display:flex;flex-direction:column">
      <p class="eyebrow">${esc(m.clubhouse.categories.sport.title)}</p>
      <h2 class="h2" style="margin-top:6mm">${esc(m.clubhouse.categories.sport.body)}</h2>
      <ul class="hl" style="margin-top:auto">${sport.amenities.map((a, i) => `<li><span class="n">${num(pad(i + 1))}</span><span class="small" style="color:inherit">${esc(m.clubhouse.amenities[a])}</span></li>`).join('')}</ul>
    </div>`,
    { chapter: 'clubhouse', folio: false },
  );

  // 23 360° contact sheet: every room of the tour ----------------------------
  page(
    `<div class="sheet">
      <div class="sheet__title">
        <p class="eyebrow">${esc(m.clubhouse.tour.eyebrow)}</p>
        <h2 class="h3 br" style="margin-top:3mm">${esc(m.clubhouse.tour.title)}</h2>
        <p class="small" style="margin-top:auto">${esc(c.tourBody)}</p>
        <p class="micro links" style="margin-top:2mm"><a href="${url('/clubhouse')}">${esc(c.tourOpen)}</a></p>
      </div>
      ${scenes
        .map(
          (sc, i) => `<figure><div>${img(`tour/${sc.slug}`)}</div><figcaption><b>${num(pad(i + 1))}</b>${esc(m.clubhouse.tour.scenes[sc.slug])}</figcaption></figure>`,
        )
        .join('')}
    </div>`,
    { cls: 'page--night', chapter: 'clubhouse', folio: 'end' },
  );

  // 24 A day at Retal ---------------------------------------------------------
  const lv = m.living;
  const day = [
    ['schools', 'tour/early-learning', 92],
    ['shopping', 'clubhouse/mini-market', 70],
    ['community', 'clubhouse/pool-umbrellas', 82],
  ];
  page(
    `${edge('start')}
    <div class="day__head">
      <div class="stack" style="--s:5mm">
        <p class="eyebrow"><span class="copper">${chapterNo('living')}</span>&nbsp; ${esc(c.dayTitle)}</p>
        <h2 class="h1 br">${esc(m.home.living.title)}</h2>
      </div>
      <div class="stack" style="--s:3mm">
        <p class="small">${esc(lv.intro)}</p>
        <p class="small"><b style="color:var(--ink);font-weight:500">${esc(lv.themes.healthcare.title)}.</b> ${esc(lv.themes.healthcare.body)}</p>
      </div>
    </div>
    <div class="day">
      ${day
        .map(
          ([k, photo, h]) => `<div>
            <div class="day__img" style="height:${h}mm">${img(photo)}</div>
            <div class="day__line">
              <p class="day__time"><span>${esc(c.times[k])}</span><span class="micro">${esc(lv.themes[k].label)}</span></p>
              <h3 class="h4" style="margin-top:2.5mm">${esc(lv.themes[k].title)}</h3>
              <p class="small" style="margin-top:1.5mm">${esc(lv.themes[k].body)}</p>
            </div>
          </div>`,
        )
        .join('')}
    </div>`,
    { chapter: 'living', folio: 'end' },
  );

  // 25 Streets made for walking ----------------------------------------------
  page(
    `${ph('bleed', 'site/street-dusk', '50% 50%')}
    <div class="sky stack" style="--s:4mm" dir="${rtl ? 'rtl' : 'ltr'}">
      <p class="eyebrow">${esc(lv.outdoors.eyebrow)}</p>
      <h2 class="h2">${esc(lv.outdoors.title)}</h2>
      <p class="small">${esc(lv.outdoors.body)}</p>
    </div>
    <div class="panel-pair">
      <div>${img('living/kids-zone-dusk')}</div>
      <div>${img('living/garden-bench')}</div>
    </div>`,
    { chapter: 'living', folio: false },
  );

  // 26 Peace of mind ------------------------------------------------------------
  const sec = m.home.security;
  page(
    `${ph('sec__img', 'site/gate-canopy-dusk', '50% 50%')}
    ${edge('start')}
    <div class="sec__text">
      <p class="outline chapter-no">${chapterNo('security')}</p>
      <p class="eyebrow" style="margin-top:8mm">${esc(sec.eyebrow)}</p>
      <h2 class="h1 br" style="margin-top:6mm">${esc(sec.title)}</h2>
      <p class="body" style="margin-top:6mm;max-width:118mm">${esc(sec.body)}</p>
      <ul class="hl sec__list" style="margin-top:auto">
        ${Object.values(sec.services).map((t, j) => `<li><span class="n">${num(pad(j + 1))}</span>${esc(t)}</li>`).join('')}
      </ul>
    </div>`,
    { cls: 'page--stone', chapter: 'security', folio: false },
  );

  // 27 Visit --------------------------------------------------------------------
  const ft = m.footer;
  const ct = m.contact;
  page(
    `${markWindow('visit__window', 'site/street-palms-portrait')}
    <div class="visit__text">
      <p class="micro"><span class="copper">${chapterNo('visit')}</span> · ${esc(m.home.visit.eyebrow)}</p>
      <h2 class="display br" style="margin-top:9mm">${esc(ft.statement)}</h2>
      <p class="lead" style="margin-top:7mm;max-width:130mm">${esc(m.home.visit.body)}</p>
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
    </div>
    ${edge('end')}`,
    { cls: 'page--night', chapter: 'visit', folio: false },
  );

  // 28 Back cover ---------------------------------------------------------------
  page(
    `<svg class="back__mark" viewBox="0 0 51 119" aria-hidden="true"><path d="${MARK}" fill="var(--copper)"/></svg>
    <div class="back__foot">
      <div style="width:56mm">${wordmark('var(--ink)')}</div>
      <div class="stack" style="--s:2mm;text-align:end">
        <p class="h3"><a href="${url()}">${esc(show(SITE_URL))}</a></p>
        <p class="micro">${esc(m.home.hero.location)} · <span dir="ltr">${esc(contact.phone.display)}</span></p>
      </div>
    </div>`,
    { folio: false },
  );

  // Contents: one column slice per chapter, staggered like the mark.
  const contentsPhotos = {
    compound: ['site/aerial-courtyard', 74],
    audience: ['living/playground-train', 96],
    residences: ['residences/3br-town-villa/hallway', 112],
    clubhouse: ['clubhouse/lobby-portrait', 62],
    living: ['living/kids-zone-dusk', 88],
    security: ['site/gate-barrier-dusk', 70],
    visit: ['site/gate-dusk-portrait', 118],
  };
  pages[contentsIndex].html = `<div class="contents__head">
      <p class="eyebrow">${esc(c.contents)}</p>
      <p class="lead" style="color:var(--ink)">${esc(c.about)}</p>
    </div>
    <div class="contents__cols">
      ${chapterKeys
        .map((k, i) => {
          const [photo, h] = contentsPhotos[k];
          return `<div>
            <div class="contents__img" style="height:${h}mm">${img(photo)}</div>
            <p class="contents__label"><span class="n">${num(pad(i + 1))}</span><span class="t">${esc(c.chapters[k])}</span><span class="p">${num(pad(chapterStart[k]))}</span></p>
          </div>`;
        })
        .join('')}
    </div>`;

  const body = pages
    .map((p, i) => {
      const folio = p.folio
        ? `<footer class="folio" style="inset-inline-${p.folio}:var(--m)"><b>${num(pad(i + 1))}</b><span>${p.chapter ? esc(c.chapters[p.chapter]) : esc(m.home.statement.eyebrow)}</span></footer>`
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
${fitScript}
</body>
</html>`;
}

await build({
  outDir: OUT,
  locales: LOCALES,
  render,
  photos,
  pdfName: (locale) => `Retal-Residence-Profile-v2-${locale.toUpperCase()}.pdf`,
  shots: SHOTS,
});
