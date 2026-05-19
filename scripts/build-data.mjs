import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

const ASIAFORCE_ROOT_URL = 'https://asiaforce.ru/catalog/';
const ASIAFORCE_CHERY_URL = 'https://asiaforce.ru/catalog/chery/';
const SEVENFORCE_ROOT_URL = 'https://sevenforce.ru/chip-tuning/';
const RECHIP_ROOT_URL = 'https://m.rechip.ru/';

const DATA_DIR = 'data';
const RUNTIME_DIR = 'runtime';
const CACHE_DIR = join(RUNTIME_DIR, 'http-cache');
const RAW_DIR = join(RUNTIME_DIR, 'raw-records');
const STATE_FILE = join(RUNTIME_DIR, 'build-state.json');
const BUILD_OUTPUT_FILE = join(DATA_DIR, 'calculator-data.json');

const DEFAULT_SOURCES = ['asiaforce', 'sevenforce', 'rechip'];
const NO_YEAR_LABEL = 'Без разбивки';
const ASIAFORCE_EXCLUDED = new Set(['Chery'].map(normalizeName));
const HOST_POLICIES = {
  'asiaforce.ru': {
    minDelayMs: 2200,
    maxDelayMs: 4800,
    longPauseEvery: 12,
    longPauseMinMs: 15000,
    longPauseMaxMs: 30000,
  },
  'sevenforce.ru': {
    minDelayMs: 2500,
    maxDelayMs: 5200,
    longPauseEvery: 10,
    longPauseMinMs: 18000,
    longPauseMaxMs: 36000,
  },
  'm.rechip.ru': {
    minDelayMs: 2500,
    maxDelayMs: 5200,
    longPauseEvery: 10,
    longPauseMinMs: 18000,
    longPauseMaxMs: 36000,
  },
  default: {
    minDelayMs: 2500,
    maxDelayMs: 5000,
    longPauseEvery: 10,
    longPauseMinMs: 15000,
    longPauseMaxMs: 30000,
  },
};

const SEVENFORCE_EXCLUDED = new Set(
  [
    'Bently',
    'Bentley',
    'Changan',
    'Chery',
    'Cupra',
    'GAC',
    'Exeed',
    'Faw',
    'Ferrari',
    'Ford',
    'Geely',
    'Haval',
    'Hyundai',
    'Kia',
    'Lamborghini',
    'Lexus',
    'Maserati',
    'McLaren',
    'Mazda',
    'Mitsubishi',
    'Nissan',
    'Opel',
    'Renault',
    'Skoda',
    'Suzuki',
    'Toyota',
    'Tank',
    'Volkswagen',
  ].map(normalizeName),
);

const RECHIP_INCLUDED = new Set(
  [
    'Chevrolet',
    'Citroen',
    'Ford',
    'Honda',
    'Hyundai',
    'Kia',
    'Lexus',
    'Mazda',
    'Mitsubishi',
    'Nissan',
    'Opel',
    'Peugeot',
    'Renault',
    'Skoda',
    'Subaru',
    'Suzuki',
    'Toyota',
    'Volkswagen',
  ].map(normalizeName),
);

const CITY_TRIM_PATTERN = /(челябинск|челяба|Р§РµР»СЏР±РёРЅСЃРє|Р§РµР»СЏР±Р°)/giu;

const RECHIP_RECORD_OVERRIDES = new Map([
  ['https://m.rechip.ru/c/Chevrolet/139/345', { rows: { power: { stock: '405 л.с.', tuned: '425 л.с.' } } }],
  ['https://m.rechip.ru/c/Chevrolet/139/346', { rows: { power: { stock: '432 л.с.', tuned: '450 л.с.' } } }],
  ['https://m.rechip.ru/c/Ford/501/3691', { rows: { power: { stock: '68 л.с.', tuned: '93 л.с.' }, torque: { stock: '160 Нм', tuned: '210 Нм' } } }],
  ['https://m.rechip.ru/c/Ford/116/1607', { rows: { power: { stock: '109 л.с.', tuned: '136 л.с.' } } }],
  ['https://m.rechip.ru/c/Kia/150/6294', { rows: { power: { stock: '136 л.с.', tuned: '176 л.с.' }, torque: { stock: '280 Нм', tuned: '360 Нм' } } }],
  ['https://m.rechip.ru/c/Kia/623/6610', { engine: 'Kia Seltos 1.6 CRDI 136 л.с. / 280 Нм', title: 'Чип тюнинг Kia Seltos 1.6 CRDI 136 л.с. / 280 Нм STAGE 1', rows: { power: { stock: '136 л.с.', tuned: '176 л.с.' }, torque: { stock: '280 Нм', tuned: '360 Нм' } } }],
  ['https://m.rechip.ru/c/Kia/154/6573', { engine: 'Kia Sportage 1.6 CRDI 136 л.с. / 280 Нм', title: 'Чип тюнинг Kia Sportage 1.6 CRDI 136 л.с. / 280 Нм STAGE 1', rows: { power: { stock: '136 л.с.', tuned: '176 л.с.' }, torque: { stock: '280 Нм', tuned: '360 Нм' } } }],
  ['https://m.rechip.ru/c/Hyundai/683/6050', { engine: 'Hyundai Kona 1.6 CRDI 136 л.с. / 280 Нм', title: 'Чип тюнинг Hyundai Kona 1.6 CRDI 136 л.с. / 280 Нм STAGE 1', rows: { power: { stock: '136 л.с.', tuned: '176 л.с.' }, torque: { stock: '280 Нм', tuned: '360 Нм' } } }],
  ['https://m.rechip.ru/c/Citroen/101/360', { rows: { power: { stock: '156 л.с.', tuned: '185 л.с.' }, torque: { stock: '380 Нм', tuned: '430 Нм' } } }],
  ['https://m.rechip.ru/c/Citroen/97/5815', { rows: { power: { stock: '90 л.с.', tuned: '97 л.с.' }, torque: { stock: '133 Нм', tuned: '140 Нм' } } }],
  ['https://m.rechip.ru/c/Citroen/97/5817', { rows: { power: { stock: '90 л.с.', tuned: '110 л.с.' }, torque: { stock: '200 Нм', tuned: '260 Нм' } } }],
  ['https://m.rechip.ru/c/Citroen/97/5814', { rows: { power: { stock: '109 л.с.', tuned: '120 л.с.' }, torque: { stock: '147 Нм', tuned: '160 Нм' } } }],
  ['https://m.rechip.ru/c/Citroen/548/3980', { rows: { power: { stock: '120 л.с.', tuned: '150 л.с.' }, torque: { stock: '320 Нм', tuned: '370 Нм' } } }],
  ['https://m.rechip.ru/c/Citroen/548/3981', { rows: { power: { stock: '130 л.с.', tuned: '160 л.с.' }, torque: { stock: '320 Нм', tuned: '380 Нм' } } }],
  ['https://m.rechip.ru/c/Citroen/610/5390', { rows: { power: { stock: '68 л.с.', tuned: '90 л.с.' }, torque: { stock: '160 Нм', tuned: '200 Нм' } } }],
]);

const RECHIP_FORCE_INCLUDE = new Set(RECHIP_RECORD_OVERRIDES.keys());

const fetchCache = new Map();
const hostRuntime = new Map();

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  await ensureDirs();

  if (args.reset) {
    await resetRuntime();
    console.log('State reset completed.');
  }

  const selectedSources = resolveSources(args.source);
  const state = await loadState(selectedSources);

  for (const source of selectedSources) {
    await runSource(source, state);
  }

  await finalizeBuild(selectedSources);
  console.log(`Done. Output: ${BUILD_OUTPUT_FILE}`);
}

async function runSource(source, state) {
  const sourceState = state.sources[source];
  sourceState.status = 'running';
  sourceState.lastError = '';
  sourceState.updatedAt = new Date().toISOString();
  await saveState(state);

  console.log(
    `[${source}] queue=${sourceState.jobs.length} done=${sourceState.processedJobIds.length} records=${sourceState.recordUrls.length}`,
  );

  while (sourceState.jobs.length > 0) {
    const job = sourceState.jobs.shift();
    if (!job || sourceState.processedJobIds.includes(job.id)) {
      continue;
    }

    console.log(`[${source}] ${job.type} -> ${job.url}`);

    try {
      await processJob(source, job, state);
      sourceState.processedJobIds.push(job.id);
      sourceState.updatedAt = new Date().toISOString();
      await saveState(state);
    } catch (error) {
      sourceState.jobs.unshift(job);
      sourceState.status = 'failed';
      sourceState.lastError = `${error?.message ?? error}`;
      sourceState.updatedAt = new Date().toISOString();
      await saveState(state);
      throw error;
    }
  }

  sourceState.status = 'completed';
  sourceState.updatedAt = new Date().toISOString();
  await saveState(state);

  console.log(
    `[${source}] completed: records=${sourceState.recordUrls.length}, fetched=${sourceState.fetchCount}`,
  );
}

async function processJob(source, job, state) {
  switch (job.type) {
    case 'asiaforce-root':
      return processAsiaforceRoot(job, state);
    case 'asiaforce-brand':
      return processAsiaforceBrand(job, state);
    case 'asiaforce-model':
      return processAsiaforceModel(job, state);
    case 'asiaforce-year':
      return processAsiaforceYear(job, state);
    case 'asiaforce-detail':
      return processAsiaforceDetail(job, state);
    case 'sevenforce-root':
      return processSevenforceRoot(job, state);
    case 'sevenforce-brand':
      return processSevenforceBrand(job, state);
    case 'sevenforce-model':
      return processSevenforceModel(job, state);
    case 'sevenforce-year':
      return processSevenforceYear(job, state);
    case 'sevenforce-detail':
      return processSevenforceDetail(job, state);
    case 'rechip-root':
      return processRechipRoot(job, state);
    case 'rechip-brand':
      return processRechipBrand(job, state);
    case 'rechip-detail':
      return processRechipDetail(job, state);
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

async function processAsiaforceRoot(job, state) {
  const html = await fetchText(job.url, state, 'asiaforce');
  const brandUrls = parseSelectById(html, 'brand-select')
    .filter((option) => option.value)
    .filter((option) => !ASIAFORCE_EXCLUDED.has(normalizeName(option.label)))
    .map((option) => absoluteUrl(option.value, ASIAFORCE_ROOT_URL));

  for (const brandUrl of unique(brandUrls)) {
    enqueueJob(state, 'asiaforce', { type: 'asiaforce-brand', url: brandUrl });
  }
}

async function processAsiaforceBrand(job, state) {
  const html = await fetchText(job.url, state, 'asiaforce');
  const modelUrls = unique(
    matchAllValues(
      html,
      /class="catalog-models__item[^"]*"[\s\S]*?href="([^"]+)"/gi,
    ),
  );

  for (const modelUrl of modelUrls) {
    enqueueJob(state, 'asiaforce', { type: 'asiaforce-model', url: modelUrl });
  }
}

async function processAsiaforceModel(job, state) {
  const html = await fetchText(job.url, state, 'asiaforce');
  const yearOptions = parseSelectById(html, 'years-select')
    .filter((option) => option.value)
    .map((option) => option.value);

  const yearUrls = yearOptions.length
    ? yearOptions.map((value) => absoluteUrl(`${job.url}${trimSlashes(value)}/`, job.url))
    : [job.url];

  for (const yearUrl of unique(yearUrls)) {
    enqueueJob(state, 'asiaforce', { type: 'asiaforce-year', url: yearUrl });
  }
}

async function processAsiaforceYear(job, state) {
  const html = await fetchText(job.url, state, 'asiaforce');
  const engineUrls = unique([
    ...parseSelectById(html, 'engine-select')
      .filter((option) => option.value)
      .map((option) => absoluteUrl(`${job.url}${trimSlashes(option.value)}/`, job.url)),
    ...matchAllValues(
      html,
      /class="catalog-engines__link"[^>]*href="([^"]+)"/gi,
    ),
  ]);

  for (const engineUrl of engineUrls) {
    enqueueJob(state, 'asiaforce', { type: 'asiaforce-detail', url: engineUrl });
  }
}

async function processAsiaforceDetail(job, state) {
  const html = await fetchText(job.url, state, 'asiaforce');
  const record = parseAsiaforceDetailPage(html, job.url);
  if (record) {
    await upsertRecord('asiaforce', record, state);
  }
}

async function processSevenforceRoot(job, state) {
  const html = await fetchText(job.url, state, 'sevenforce');
  const brandOptions = parseSelectBlock(getSelectBlocks(html)[0] ?? '');
  const brandUrls = brandOptions
    .filter((option) => option.value)
    .filter((option) => !SEVENFORCE_EXCLUDED.has(normalizeName(option.label)))
    .map((option) => absoluteUrl(option.value, SEVENFORCE_ROOT_URL));

  for (const brandUrl of brandUrls) {
    enqueueJob(state, 'sevenforce', { type: 'sevenforce-brand', url: brandUrl });
  }
}

async function processSevenforceBrand(job, state) {
  const html = await fetchText(job.url, state, 'sevenforce');
  const modelOptions = parseSelectBlock(getSelectBlocks(html)[1] ?? '');
  const modelUrls = modelOptions
    .filter((option) => option.value)
    .map((option) => absoluteUrl(option.value, job.url));

  for (const modelUrl of unique(modelUrls)) {
    enqueueJob(state, 'sevenforce', { type: 'sevenforce-model', url: modelUrl });
  }
}

async function processSevenforceModel(job, state) {
  const html = await fetchText(job.url, state, 'sevenforce');
  const yearOptions = parseSelectBlock(getSelectBlocks(html)[2] ?? '');
  const yearUrls = yearOptions
    .filter((option) => option.value)
    .map((option) => absoluteUrl(option.value, job.url));

  for (const yearUrl of unique(yearUrls)) {
    enqueueJob(state, 'sevenforce', { type: 'sevenforce-year', url: yearUrl });
  }
}

async function processSevenforceYear(job, state) {
  const html = await fetchText(job.url, state, 'sevenforce');
  const engineOptions = parseSelectBlock(getSelectBlocks(html)[3] ?? '');
  const engineUrls = engineOptions
    .filter((option) => option.value)
    .map((option) => absoluteUrl(option.value, job.url));

  for (const engineUrl of unique(engineUrls)) {
    enqueueJob(state, 'sevenforce', { type: 'sevenforce-detail', url: engineUrl });
  }
}

async function processSevenforceDetail(job, state) {
  const html = await fetchText(job.url, state, 'sevenforce');
  const record = parseSevenforceDetailPage(html, job.url);
  if (record && isAllowedRecord(record)) {
    await upsertRecord('sevenforce', record, state);
  }
}

async function processRechipRoot(job, state) {
  const html = await fetchText(job.url, state, 'rechip');
  const brandOptions = parseSelectByClass(html, 'brandname');
  const brandUrls = brandOptions
    .filter((option) => option.value && option.attributes.class)
    .filter((option) => RECHIP_INCLUDED.has(normalizeName(option.label)))
    .map((option) => absoluteUrl(`/c/${option.attributes.class}`, RECHIP_ROOT_URL));

  for (const brandUrl of brandUrls) {
    enqueueJob(state, 'rechip', { type: 'rechip-brand', url: brandUrl });
  }
}

async function processRechipBrand(job, state) {
  const html = await fetchText(job.url, state, 'rechip');
  const variantUrls = unique(
    matchAllValues(
      html,
      /<div class='price_cel'><a href='([^']+\/\d+)'>/gi,
    ).map((value) => absoluteUrl(value, job.url)),
  );

  for (const variantUrl of variantUrls) {
    enqueueJob(state, 'rechip', { type: 'rechip-detail', url: variantUrl });
  }
}

async function processRechipDetail(job, state) {
  const html = await fetchText(job.url, state, 'rechip');
  const record = parseRechipDetailPage(html, job.url);
  if (record) {
    await upsertRecord('rechip', record, state);
  }
}

function parseAsiaforceDetailPage(html, url) {
  const selects = {
    brand: getSelectedOption(parseSelectById(html, 'brand-select')),
    model: getSelectedOption(parseSelectById(html, 'model-select')),
    year: getSelectedOption(parseSelectById(html, 'years-select')),
    engine: getSelectedOption(parseSelectById(html, 'engine-select')),
  };

  const activeBlock = sliceBetween(
    html,
    'class="catalog-calculator__tab active"',
    [
      '<div class="catalog-calculator__tab"',
      '<div class="catalog-calculator__buttons">',
    ],
  );

  if (!activeBlock) {
    return null;
  }

  const rows = parseFourColumnRows(
    activeBlock,
    /<div class="catalog-calculator__table-row">[\s\S]*?<div class="catalog-calculator__table-col">([\s\S]*?)<\/div>\s*<div class="catalog-calculator__table-col">([\s\S]*?)<\/div>\s*<div class="catalog-calculator__table-col">([\s\S]*?)<\/div>\s*<div class="catalog-calculator__table-col">([\s\S]*?)<\/div>\s*<\/div>/gi,
  );

  const price =
    toNumber(matchFirst(activeBlock, /data-price="(\d+)"/i)) ??
    toNumber(
      cleanText(
        matchFirst(
          html,
          /class="catalog-calculator__price-num"[\s\S]*?catalog-calculator__price--red">([^<]+)/i,
        ),
      ),
    );

  const title = cleanText(
    matchFirst(html, /<h1 class="catalog-cover__title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i),
  );

  return buildRecord({
    source: 'asiaforce',
    url,
    brandName: selects.brand?.label ?? 'CHERY',
    modelName: selects.model?.label ?? title.replace(/^CHERY\s+/i, ''),
    yearName: selects.year?.label ?? NO_YEAR_LABEL,
    engineName: selects.engine?.label ?? title,
    title,
    rows,
    price,
  });
}

function parseSevenforceDetailPage(html, url) {
  const selectBlocks = getSelectBlocks(html);
  const brand = getSelectedOption(parseSelectBlock(selectBlocks[0] ?? ''));
  const model = getSelectedOption(parseSelectBlock(selectBlocks[1] ?? ''));
  const year = getSelectedOption(parseSelectBlock(selectBlocks[2] ?? ''));
  const engine = getSelectedOption(parseSelectBlock(selectBlocks[3] ?? ''));

  const stageBlock = sliceBetween(
    html,
    '<section class="grid-stage-1',
    ['<section class="grid-stage-2"', '<div class="container">\n    <div class="alert alert-warning">'],
  );

  if (!stageBlock) {
    return null;
  }

  const rows = parseFourColumnRows(
    stageBlock,
    /<div class="row table-row">[\s\S]*?<div class="col-3">([\s\S]*?)<\/div>\s*<div class="col-3">([\s\S]*?)<\/div>\s*<div class="col-3">([\s\S]*?)<\/div>\s*<div class="col-3(?: [^"]*)?">([\s\S]*?)<\/div>\s*<\/div>/gi,
  );

  const price =
    toNumber(matchFirst(stageBlock, /class="price total" data-price="(\d+)"/i)) ??
    toNumber(cleanText(matchFirst(stageBlock, /class="price total"[^>]*>([\d\s]+)/i)));

  const title = cleanText(matchFirst(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i));

  return buildRecord({
    source: 'sevenforce',
    url,
    brandName: brand?.label ?? '',
    modelName: model?.label ?? '',
    yearName: year?.label ?? NO_YEAR_LABEL,
    engineName: engine?.label ?? title,
    title,
    rows,
    price,
  });
}

function parseRechipDetailPage(html, url) {
  const h1 = cleanText(matchFirst(html, /<h1>([\s\S]*?)<\/h1>/i));
  const modelBreadcrumb = cleanText(
    matchFirst(html, /<a href='\/c\/[^']+\/\d+'>([^<]+)<\/a><h1>/i),
  ).replace(/^Чип тюнинг\s+/i, '');
  const brandBreadcrumb = cleanText(
    matchFirst(html, /<a href='\/c\/[^']+'>([^<]+)<\/a>\s*\/\s*<a href='\/c\/[^']+\/\d+'>/i),
  ).replace(/^Чип тюнинг\s+/i, '');

  const rows = parseRechipRows(html);
  if (!rows.length) {
    return null;
  }

  const price = toNumber(
    matchFirst(html, /name ='chip' value='(\d+)' id='Stage 1'/i),
  );

  const engineName = h1
    .replace(/^Чип тюнинг\s+/i, '')
    .replace(new RegExp(`^${escapeRegex(`${brandBreadcrumb} ${modelBreadcrumb}`)}\\s*`, 'i'), '')
    .replace(/\s*STAGE\s*1.*$/i, '')
    .trim();

  return buildRecord({
    source: 'rechip',
    url,
    brandName: brandBreadcrumb,
    modelName: modelBreadcrumb,
    yearName: NO_YEAR_LABEL,
    engineName: engineName || h1,
    title: h1,
    rows,
    price,
  });
}

function buildRecord({ source, url, brandName, modelName, yearName, engineName, title, rows, price }) {
  const normalizedRows = rows
    .map((row) => ({
      label: cleanText(row.label),
      stock: cleanText(row.stock),
      tuned: cleanText(row.tuned),
      diff: cleanText(row.diff),
    }))
    .filter((row) => row.label && (row.stock || row.tuned));

  return applyRecordFixes({
    source,
    url,
    brand: brandName,
    model: modelName,
    year: yearName,
    engine: engineName,
    title,
    price: price ?? null,
    rows: normalizedRows,
    slug: normalizeName([brandName, modelName, yearName, engineName].join(' ')),
  });
}

function parseRechipRows(html) {
  const table = matchFirst(html, /<table id='about_model_eq'>([\s\S]*?)<\/table>/i);
  if (!table) {
    return [];
  }

  const rows = [];
  for (const match of table.matchAll(
    /<tr>\s*<td class = 'left_td'>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi,
  )) {
    rows.push({
      label: match[1],
      stock: match[2],
      tuned: match[3],
      diff: buildDiff(match[1], match[2], match[3]),
    });
  }
  return rows;
}

function buildDiff(label, stock, tuned) {
  const stockNumber = extractPrimaryNumber(stock);
  const tunedNumber = extractPrimaryNumber(tuned);
  if (stockNumber == null || tunedNumber == null) {
    return '';
  }

  const unit = cleanText(tuned).replace(/^[\d\s.,+-]+/g, '').trim();
  const rawDelta = tunedNumber - stockNumber;
  const isAcceleration = /0-100|разгон/i.test(label);
  const sign = rawDelta > 0 ? '+' : rawDelta < 0 ? '-' : '';
  const absValue = Math.abs(rawDelta);
  const formattedValue = Number.isInteger(absValue)
    ? String(absValue)
    : absValue.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');

  return isAcceleration ? `-${formattedValue} ${unit}` : `${sign} ${formattedValue} ${unit}`.trim();
}

function applyRecordFixes(record) {
  if (!record) {
    return record;
  }

  const nextRecord = {
    ...record,
    brand: sanitizeRecordText(record.brand),
    model: sanitizeRecordText(record.model),
    year: sanitizeRecordText(record.year),
    engine: sanitizeRecordText(record.engine),
    title: sanitizeRecordText(record.title),
    rows: (record.rows ?? []).map((row) => ({
      ...row,
      label: sanitizeRecordText(row.label),
      stock: sanitizeRecordText(row.stock),
      tuned: sanitizeRecordText(row.tuned),
      diff: sanitizeRecordText(row.diff),
    })),
  };

  if (nextRecord.source === 'rechip') {
    applyRechipOverride(nextRecord);
  }

  nextRecord.slug = normalizeName(
    [nextRecord.brand, nextRecord.model, nextRecord.year, nextRecord.engine].join(' '),
  );

  return nextRecord;
}

function applyRechipOverride(record) {
  const override = RECHIP_RECORD_OVERRIDES.get(record.url);
  if (!override) {
    return;
  }

  if (override.brand) {
    record.brand = override.brand;
  }
  if (override.model) {
    record.model = override.model;
  }
  if (override.year) {
    record.year = override.year;
  }
  if (override.engine) {
    record.engine = override.engine;
  }
  if (override.title) {
    record.title = override.title;
  }
  if (override.rows?.power && record.rows[0]) {
    record.rows[0] = overrideRowValues(
      record.rows[0],
      override.rows.power.stock,
      override.rows.power.tuned,
    );
  }
  if (override.rows?.torque && record.rows[1]) {
    record.rows[1] = overrideRowValues(
      record.rows[1],
      override.rows.torque.stock,
      override.rows.torque.tuned,
    );
  }
}

function overrideRowValues(row, stock, tuned) {
  const nextRow = {
    ...row,
    stock: sanitizeRecordText(stock),
    tuned: sanitizeRecordText(tuned),
  };
  nextRow.diff = buildDiff(nextRow.label, nextRow.stock, nextRow.tuned);
  return nextRow;
}

function sanitizeRecordText(value) {
  return cleanText(value)
    .replace(CITY_TRIM_PATTERN, ' ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;!?/])/g, '$1')
    .trim();
}

function parseFourColumnRows(input, pattern) {
  const rows = [];
  for (const match of input.matchAll(pattern)) {
    rows.push({
      label: match[1],
      stock: match[2],
      tuned: match[3],
      diff: match[4],
    });
  }
  return rows;
}

async function upsertRecord(source, record, state) {
  const file = sourceRecordFile(source);
  const currentRecords = await readJsonFile(file, []);
  const recordsByUrl = new Map(currentRecords.map((item) => [item.url, item]));
  recordsByUrl.set(record.url, record);
  const nextRecords = [...recordsByUrl.values()].sort(compareRecords);

  await writeJsonAtomic(file, nextRecords);

  const sourceState = state.sources[source];
  if (!sourceState.recordUrls.includes(record.url)) {
    sourceState.recordUrls.push(record.url);
  }
}

async function finalizeBuild(selectedSources) {
  const sourceRecords = [];
  for (const source of selectedSources) {
    const records = await readJsonFile(sourceRecordFile(source), []);
    sourceRecords.push(...records);
  }

  const records = dedupeByUrl(sourceRecords)
    .map((record) => applyRecordFixes(record))
    .filter((record) => isAllowedRecord(record))
    .sort(compareRecords);
  const grouped = groupRecords(records);
  const meta = {
    generatedAt: new Date().toISOString(),
    totalRecords: records.length,
    brands: grouped.length,
    sources: Object.fromEntries(
      selectedSources.map((source) => [source, records.filter((item) => item.source === source).length]),
    ),
  };

  await writeJsonAtomic(BUILD_OUTPUT_FILE, { meta, records, grouped });
}

function groupRecords(records) {
  const brands = new Map();

  for (const record of records) {
    const brand = ensureMapItem(brands, record.brand, () => ({
      name: record.brand,
      models: new Map(),
    }));
    const model = ensureMapItem(brand.models, record.model, () => ({
      name: record.model,
      years: new Map(),
    }));
    const year = ensureMapItem(model.years, record.year, () => ({
      name: record.year,
      engines: [],
    }));

    year.engines.push({
      name: record.engine,
      title: record.title,
      price: record.price,
      source: record.source,
      url: record.url,
      rows: record.rows,
      slug: record.slug,
    });
  }

  return [...brands.values()]
    .map((brand) => ({
      name: brand.name,
      models: [...brand.models.values()]
        .map((model) => ({
          name: model.name,
          years: [...model.years.values()]
            .map((year) => ({
              name: year.name,
              engines: year.engines.sort((left, right) =>
                left.name.localeCompare(right.name, 'ru'),
              ),
            }))
            .sort((left, right) => left.name.localeCompare(right.name, 'ru')),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'ru')),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}

function compareRecords(left, right) {
  return [left.brand, left.model, left.year, left.engine].join('|').localeCompare(
    [right.brand, right.model, right.year, right.engine].join('|'),
    'ru',
  );
}

function isAllowedRecord(record) {
  if (!record) {
    return false;
  }

  if (record.source === 'sevenforce') {
    return !SEVENFORCE_EXCLUDED.has(normalizeName(record.brand));
  }

  if (record.source === 'rechip') {
    return (
      RECHIP_INCLUDED.has(normalizeName(record.brand)) &&
      (isRechipStage1Record(record) || RECHIP_FORCE_INCLUDE.has(record.url))
    );
  }

  return true;
}

function isRechipStage1Record(record) {
  const title = normalizeName(record.title);
  return record.price != null && /\bstage\s*1\b/.test(title);
}

function dedupeByUrl(records) {
  const map = new Map();
  for (const record of records) {
    map.set(record.url, record);
  }
  return [...map.values()];
}

function ensureMapItem(map, key, createValue) {
  if (!map.has(key)) {
    map.set(key, createValue());
  }
  return map.get(key);
}

function enqueueJob(state, source, job) {
  const sourceState = state.sources[source];
  const fullJob = { ...job, id: createJobId(job.type, job.url) };

  if (
    sourceState.seenJobIds.includes(fullJob.id) ||
    sourceState.processedJobIds.includes(fullJob.id)
  ) {
    return;
  }

  sourceState.jobs.push(fullJob);
  sourceState.seenJobIds.push(fullJob.id);
}

async function fetchText(url, state, source) {
  if (fetchCache.has(url)) {
    return fetchCache.get(url);
  }

  const promise = (async () => {
    const cacheFile = cacheFileForUrl(url);
    if (existsSync(cacheFile)) {
      return readFile(cacheFile, 'utf8');
    }

    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await waitForPoliteWindow(url);

        const response = await fetch(url, {
          headers: {
            'user-agent': USER_AGENT,
            'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const charset =
          response.headers.get('content-type')?.match(/charset=([^;]+)/i)?.[1] ??
          buffer.toString('latin1', 0, 2000).match(/charset=([a-zA-Z0-9_-]+)/i)?.[1] ??
          'utf-8';

        const text = decodeBuffer(buffer, charset);
        await writeFile(cacheFile, text, 'utf8');
        state.sources[source].fetchCount += 1;
        registerSuccessfulRequest(url);
        return text;
      } catch (error) {
        lastError = error;
        registerFailedRequest(url, attempt);
        if (attempt < 3) {
          await delay(jitter(3000 * attempt, 6000 * attempt));
        }
      }
    }

    if (existsSync(cacheFile)) {
      return readFile(cacheFile, 'utf8');
    }

    throw lastError;
  })();

  fetchCache.set(url, promise);
  return promise;
}

function decodeBuffer(buffer, charset) {
  try {
    return new TextDecoder(charset.toLowerCase()).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

async function loadState(selectedSources) {
  const state = await readJsonFile(STATE_FILE, {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    selectedSources,
    sources: {},
  });

  state.selectedSources = selectedSources;

  for (const source of selectedSources) {
    const expectedSeed = sourceSeed(source);
    if (!state.sources[source]) {
      state.sources[source] = createSourceState(source);
      continue;
    }

    if (state.sources[source].seed !== expectedSeed) {
      await resetSourceArtifacts(source);
      state.sources[source] = createSourceState(source);
    }
  }

  state.updatedAt = new Date().toISOString();
  await saveState(state);
  return state;
}

function createSourceState(source) {
  const jobs = initialJobsForSource(source);
  return {
    seed: sourceSeed(source),
    status: 'pending',
    jobs,
    seenJobIds: jobs.map((job) => job.id),
    processedJobIds: [],
    recordUrls: [],
    fetchCount: 0,
    lastError: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function initialJobsForSource(source) {
  switch (source) {
    case 'asiaforce':
      return [
        makeJob('asiaforce-root', ASIAFORCE_ROOT_URL),
        makeJob('asiaforce-brand', ASIAFORCE_CHERY_URL),
      ];
    case 'sevenforce':
      return [makeJob('sevenforce-root', SEVENFORCE_ROOT_URL)];
    case 'rechip':
      return [makeJob('rechip-root', RECHIP_ROOT_URL)];
    default:
      throw new Error(`Unknown source: ${source}`);
  }
}

function sourceSeed(source) {
  return initialJobsForSource(source)
    .map((job) => job.id)
    .join('|');
}

function makeJob(type, url) {
  return { type, url, id: createJobId(type, url) };
}

function createJobId(type, url) {
  return `${type}:${url}`;
}

async function saveState(state) {
  state.updatedAt = new Date().toISOString();
  await writeJsonAtomic(STATE_FILE, state);
}

async function ensureDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(RUNTIME_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(RAW_DIR, { recursive: true });
}

async function resetRuntime() {
  await rm(RUNTIME_DIR, { recursive: true, force: true });
  await rm(BUILD_OUTPUT_FILE, { force: true });
  await ensureDirs();
}

async function resetSourceArtifacts(source) {
  await rm(sourceRecordFile(source), { force: true });
}

async function readJsonFile(file, fallback) {
  try {
    const raw = await readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(file, value) {
  const tempFile = `${file}.${process.pid}.tmp`;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(tempFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tempFile, file);
}

function sourceRecordFile(source) {
  return join(RAW_DIR, `${source}.json`);
}

function cacheFileForUrl(url) {
  const hash = createHash('sha1').update(url).digest('hex');
  const name = basename(url).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40) || 'index';
  return join(CACHE_DIR, `${hash}-${name}.html`);
}

async function waitForPoliteWindow(url) {
  const host = new URL(url).host;
  const policy = HOST_POLICIES[host] ?? HOST_POLICIES.default;
  const runtime = ensureHostRuntime(host);

  const now = Date.now();
  const nextAllowedAt = Math.max(runtime.nextAllowedAt, runtime.cooldownUntil);
  if (nextAllowedAt > now) {
    await delay(nextAllowedAt - now);
  }

  const gap = jitter(policy.minDelayMs, policy.maxDelayMs);
  runtime.nextAllowedAt = Date.now() + gap;
}

function registerSuccessfulRequest(url) {
  const host = new URL(url).host;
  const policy = HOST_POLICIES[host] ?? HOST_POLICIES.default;
  const runtime = ensureHostRuntime(host);

  runtime.successCount += 1;
  runtime.failureCount = 0;

  if (
    policy.longPauseEvery > 0 &&
    runtime.successCount % policy.longPauseEvery === 0
  ) {
    runtime.cooldownUntil =
      Date.now() + jitter(policy.longPauseMinMs, policy.longPauseMaxMs);
  } else {
    runtime.cooldownUntil = Math.max(runtime.cooldownUntil, 0);
  }
}

function registerFailedRequest(url, attempt) {
  const host = new URL(url).host;
  const runtime = ensureHostRuntime(host);
  runtime.failureCount += 1;

  const penaltyMs = jitter(10000 * attempt, 20000 * attempt);
  runtime.cooldownUntil = Math.max(runtime.cooldownUntil, Date.now() + penaltyMs);
}

function ensureHostRuntime(host) {
  if (!hostRuntime.has(host)) {
    hostRuntime.set(host, {
      nextAllowedAt: 0,
      cooldownUntil: 0,
      successCount: 0,
      failureCount: 0,
    });
  }
  return hostRuntime.get(host);
}

function getSelectBlocks(html) {
  return [...html.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/gi)].map(
    (match) => match[0],
  );
}

function parseSelectById(html, id) {
  const match = html.match(
    new RegExp(`<select\\b[^>]*id="${escapeRegex(id)}"[^>]*>([\\s\\S]*?)<\\/select>`, 'i'),
  );
  return parseSelectBlock(match?.[0] ?? '');
}

function parseSelectByClass(html, className) {
  const match = html.match(
    new RegExp(
      `<select\\b[^>]*class=(["'])[^"']*${escapeRegex(className)}[^"']*\\1[^>]*>([\\s\\S]*?)<\\/select>`,
      'i',
    ),
  );
  return parseSelectBlock(match?.[0] ?? '');
}

function parseSelectBlock(selectHtml) {
  const options = [];
  for (const match of selectHtml.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
    const attributes = parseAttributes(match[1]);
    options.push({
      value: attributes.value ?? '',
      label: cleanText(match[2]),
      selected: Object.hasOwn(attributes, 'selected'),
      attributes,
    });
  }
  return options;
}

function getSelectedOption(options) {
  return options.find((option) => option.selected) ?? null;
}

function parseAttributes(raw) {
  const attributes = {};
  for (const match of raw.matchAll(
    /([a-zA-Z0-9_:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
  )) {
    const [, name, doubleQuoted, singleQuoted, unquoted] = match;
    attributes[name] = doubleQuoted ?? singleQuoted ?? unquoted ?? '';
  }
  return attributes;
}

function absoluteUrl(value, base) {
  return new URL(value, base).toString();
}

function matchFirst(input, pattern) {
  return input.match(pattern)?.[1] ?? '';
}

function matchAllValues(input, pattern) {
  return [...input.matchAll(pattern)].map((match) => match[1]);
}

function sliceBetween(input, startMarker, endMarkers) {
  const start = input.indexOf(startMarker);
  if (start === -1) {
    return '';
  }

  const rest = input.slice(start);
  let end = rest.length;
  for (const marker of endMarkers) {
    const index = rest.indexOf(marker);
    if (index !== -1) {
      end = Math.min(end, index);
    }
  }
  return rest.slice(0, end);
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, '');
}

function stripTags(value) {
  return String(value).replace(/<br\s*\/?>/gi, ' ').replace(/<\/?[^>]+>/g, ' ');
}

function decodeHtmlEntities(value) {
  const named = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    mdash: '-',
    ndash: '-',
    rsquo: "'",
    lsquo: "'",
    hellip: '...',
  };

  return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return named[entity] ?? full;
  });
}

function cleanText(value) {
  return decodeHtmlEntities(stripTags(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .trim();
}

function extractPrimaryNumber(value) {
  const match = cleanText(value).match(/-?\d+(?:[.,]\d+)?/);
  if (!match) {
    return null;
  }
  return Number.parseFloat(match[0].replace(',', '.'));
}

function toNumber(value) {
  const digits = String(value ?? '').replace(/[^\d.-]/g, '');
  return digits ? Number.parseFloat(digits) : null;
}

function normalizeName(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, ' ').replace(/ё/g, 'е').trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgs(argv) {
  const args = { source: '', reset: false, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--source' && argv[index + 1]) {
      args.source = argv[index + 1];
      index += 1;
      continue;
    }
    if (item.startsWith('--source=')) {
      args.source = item.split('=').slice(1).join('=');
      continue;
    }
    if (item === '--reset') {
      args.reset = true;
      continue;
    }
    if (item === '--help' || item === '-h') {
      args.help = true;
    }
  }

  return args;
}

function resolveSources(rawSource) {
  if (!rawSource) {
    return DEFAULT_SOURCES;
  }

  const selected = rawSource
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const invalid = selected.filter((item) => !DEFAULT_SOURCES.includes(item));
  if (invalid.length > 0) {
    throw new Error(`Unknown source(s): ${invalid.join(', ')}`);
  }

  return unique(selected);
}

function printHelp() {
  console.log(`Usage:
  node scripts/build-data.mjs
  node scripts/build-data.mjs --source sevenforce
  node scripts/build-data.mjs --source asiaforce,rechip
  node scripts/build-data.mjs --reset

Behavior:
  - saves progress to runtime/build-state.json
  - caches fetched HTML in runtime/http-cache/
  - stores partial records in runtime/raw-records/
  - resumes from the last saved job after interruption`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
