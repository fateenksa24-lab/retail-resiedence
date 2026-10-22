// Shared plumbing for the company profile builds: the site's content, the photo export and the
// PDF render. Each version owns its own pages and stylesheet.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const load = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const json = async (p) => JSON.parse(await readFile(path.join(ROOT, p), 'utf8'));

/** Everything the profile is composed from, straight from the website's sources. */
export async function loadContent(locales) {
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
  const messages = Object.fromEntries(await Promise.all(locales.map(async (l) => [l, await json(`messages/${l}.json`)])));
  return { residences, amenityCategories, MARK, WORD, contact, social, SITE_URL, manifest, markers, destinations, scenes, messages };
}

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const pad = (n) => String(n).padStart(2, '0');
export const num = (v) => `<span class="num" dir="ltr">${esc(v)}</span>`;

/** Picks the ICU plural branch for n (enough for the `{n, plural, ...}` strings in messages). */
export function plural(pattern, n, locale) {
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

// Photos are re-exported at 2000px for the PDF (sharp enough for screen and office print, a third of the weight).
const CACHE = path.join(ROOT, '.cache/profile');
const PHOTO_MAX = 2000;

/** Resolves image ids to paths relative to a page in `outDir`, and exports the photos it handed out. */
export function photoLibrary(manifest, outDir) {
  const used = new Set();
  const rel = (p) => path.relative(outDir, p).split(path.sep).join('/');
  return {
    src(id) {
      const entry = manifest[id];
      if (!entry) throw new Error(`Unknown image ${id}`);
      if (!entry.src.endsWith('.jpg')) return rel(path.join(ROOT, 'public', entry.src));
      used.add(entry.src);
      return rel(path.join(CACHE, entry.src));
    },
    size(id) {
      const { width, height } = manifest[id];
      return { width, height };
    },
    async export() {
      for (const src of used) {
        const out = path.join(CACHE, src);
        if (await stat(out).catch(() => null)) continue;
        await mkdir(path.dirname(out), { recursive: true });
        await sharp(path.join(ROOT, 'public', src))
          .resize(PHOTO_MAX, PHOTO_MAX, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80, mozjpeg: true, progressive: true })
          .toFile(out);
      }
    },
  };
}

/** Writes each locale's HTML, prints it to PDF, and optionally screenshots every page. */
export async function build({ outDir, locales, render, photos, pdfName, shots }) {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const locale of locales) {
      const htmlFile = path.join(outDir, `retal-residence-profile.${locale}.html`);
      await writeFile(htmlFile, render(locale));
      await photos.export();

      const page = await browser.newPage({ viewport: { width: 1123, height: 794 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('requestfailed', (r) => errors.push(`failed: ${r.url()}`));
      await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      if (errors.length) throw new Error(errors.join('\n'));

      const pdfFile = path.join(outDir, pdfName(locale));
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: pdfFile, preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
      console.log(path.relative(ROOT, pdfFile));

      if (shots) {
        await page.emulateMedia({ media: 'screen' });
        await page.evaluate(() => {
          document.body.classList.add('shot');
          document.body.style.setProperty('--fit', '1');
        });
        await mkdir(shots, { recursive: true });
        const sections = page.locator('section.page');
        const n = await sections.count();
        for (let i = 0; i < n; i++) {
          await sections.nth(i).screenshot({ path: path.join(shots, `${locale}-${pad(i + 1)}.png`) });
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

/** Scales the pages to the window on screen; print and PDF always use the true page size. */
export const fitScript = `<script>
  (function () {
    if (document.body.classList.contains('shot')) return;
    var fit = function () {
      var w = document.querySelector('.page').getBoundingClientRect().width / (parseFloat(getComputedStyle(document.body).zoom) || 1);
      document.body.style.setProperty('--fit', Math.min(1.25, (window.innerWidth - 24) / w));
    };
    fit();
    window.addEventListener('resize', fit);
  })();
</script>`;

/** "Who Retal is for": the three audiences, in both languages. Facts come from messages and content. */
export const AUDIENCE = {
  en: {
    chapter: 'Who it’s for',
    eyebrow: 'Who Retal is for',
    words: ['Families.', 'Executives.', 'The discerning.'],
    intro:
      'Retal is planned for people who choose carefully: families who want space, safety and a good school close by, executives who want a home that is ready the day they arrive, and residents who expect five-star facilities a short walk from their front door.',
    to: (place) => `to ${place}`,
    playZones: 'speed limit in the children’s play zones',
    largest: 'our largest home, the four-bedroom executive villa',
    kmh: 'km/h',
    groups: {
      families: {
        name: 'Families',
        title: 'Room to grow,\nthree minutes from school',
        lead: 'Gated streets where children play safely, a school three minutes from the gate and an early learning centre inside the Clubhouse. Homes of up to four bedrooms, with a private backyard at every villa.',
      },
      executives: {
        name: 'Executives & professionals',
        title: 'Ready the day\nyou arrive',
        lead: 'Every residence comes fully furnished, with European appliances and internet included. Housekeeping and laundry take care of the week, while Saudi Aramco, Dhahran Expo and the causeway to Bahrain stay within easy reach.',
      },
      discerning: {
        name: 'The discerning',
        title: 'Five-star facilities,\na short walk from home',
        lead: 'A restaurant and café, a salon and spa, a private 38-seat cinema and a guesthouse for visiting family, all in the Clubhouse at the centre of the compound.',
      },
    },
  },
  ar: {
    chapter: 'لمن صُمّم رتال',
    eyebrow: 'لمن صُمّم رتال',
    words: ['العائلات.', 'التنفيذيون.', 'أصحاب الذوق الرفيع.'],
    intro:
      'خُطّط رتال لمن يختارون بعناية: عائلات تبحث عن المساحة والأمان ومدرسة جيدة على مقربة، وتنفيذيون يريدون بيتًا جاهزًا منذ يوم وصولهم، وسكان ينتظرون مرافق بمستوى خمس نجوم على بُعد خطوات من بيوتهم.',
    to: (place) => `إلى ${place}`,
    playZones: 'حدّ السرعة في مناطق لعب الأطفال',
    largest: 'أكبر مساكننا: الفيلا التنفيذية بأربع غرف نوم',
    kmh: 'كم/س',
    groups: {
      families: {
        name: 'العائلات',
        title: 'مساحة يكبر فيها الأطفال،\nوالمدرسة على بُعد ثلاث دقائق',
        lead: 'شوارع مسوّرة يلعب فيها الأطفال بأمان، ومدرسة على بُعد ثلاث دقائق من البوابة، ومركز للتعليم المبكر داخل النادي. ومساكن تصل إلى أربع غرف نوم، مع فناء خلفي خاص في كل فيلا.',
      },
      executives: {
        name: 'التنفيذيون والمهنيون',
        title: 'بيتٌ جاهز\nمنذ يوم وصولك',
        lead: 'كل مسكن مفروش بالكامل، مع أجهزة أوروبية وإنترنت مشمول. وتتولى خدمات التدبير المنزلي والغسيل شؤون الأسبوع، فيما تبقى أرامكو السعودية ومعرض الظهران وجسر الملك فهد إلى البحرين في المتناول.',
      },
      discerning: {
        name: 'أصحاب الذوق الرفيع',
        title: 'مرافق بمستوى خمس نجوم،\nعلى بُعد خطوات من البيت',
        lead: 'مطعم ومقهى، وصالون وسبا، وسينما خاصة من 38 مقعدًا، ودار ضيافة لأقاربك الزائرين، وكلها في النادي الذي يتوسّط المجمّع.',
      },
    },
  },
};

/**
 * Each audience's proof: figures [value, unit, label] and the amenities that serve it, all from the
 * site's own messages and content.
 */
export function audienceProof(m, a, { destinations, residences, minUnit }) {
  const mins = (key) => destinations.find((d) => d.key === key).minutes;
  const drive = (key) => [String(mins(key)), minUnit(mins(key)), a.to(m.neighborhood.destinations[key])];
  const largest = Math.max(...residences.map((r) => r.size));
  const am = m.clubhouse.amenities;
  return {
    families: {
      figures: [
        [m.home.stats.school.value, m.home.stats.school.unit, m.home.stats.school.label],
        [m.home.stats.security.value, '', m.home.stats.security.label],
        ['15', a.kmh, a.playZones],
        [String(largest), m.common.sqmUnit, a.largest],
      ],
      amenities: [am.learning, am.kidsPool, m.residences.extras['private-backyard'], m.living.outdoors.title],
    },
    executives: {
      figures: [drive('expo'), drive('aramco'), drive('causeway'), drive('airport')],
      amenities: [
        m.residences.features.furnished,
        m.residences.features.appliances,
        m.residences.features.internet,
        m.home.security.services.housekeeping,
        m.home.security.services.laundry,
        am.business,
      ],
    },
    discerning: {
      figures: [
        [m.clubhouse.figures.amenities.value, '', m.clubhouse.figures.amenities.label],
        [m.clubhouse.figures.cinema.value, '', m.clubhouse.figures.cinema.label],
        [m.clubhouse.figures.bowling.value, '', m.clubhouse.figures.bowling.label],
      ],
      amenities: [am.restaurant, am.salon, am.guesthouse, am.pools, m.home.security.services.facilities],
    },
  };
}
