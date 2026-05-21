import { readFile, writeFile } from 'node:fs/promises';

const payload = JSON.parse(await readFile('data/calculator-data.json', 'utf8'));
const widgetId = 'chip-calc-widget';
const dataVersion = String(payload?.meta?.generatedAt ?? Date.now()).replace(/[^\d]/g, '');
const dataScriptPlaceholder =
  `https://cdn.jsdelivr.net/gh/webkos-studio/chip-calculator-data@main/dist/tilda-calculator-data.js?v=${dataVersion}`;

const styleBlock = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

  .cc-popup-context {
    margin: 0 0 18px;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid rgba(223,91,67,.18);
    background: rgba(223,91,67,.08);
    color: inherit;
    line-height: 1.55;
  }
  .cc-popup-context strong {
    display: block;
    margin-bottom: 6px;
    font-size: 12px;
    letter-spacing: .08em;
    text-transform: uppercase;
    opacity: .72;
  }

  #${widgetId} {
    --bg: #101418;
    --panel: #171d22;
    --line: rgba(255,255,255,.08);
    --text: #f3f6f8;
    --muted: #a7afb7;
    --accent: #df5b43;
    --accent-soft: rgba(223,91,67,.14);
    --good: #78d5a9;
    font-family: 'Manrope', 'Segoe UI', sans-serif;
    color: var(--text);
    background:
      radial-gradient(circle at top left, rgba(223,91,67,.18), transparent 28%),
      linear-gradient(135deg, #0b0f12 0%, #12181d 52%, #171e24 100%);
    border-radius: 28px;
    padding: 28px;
    box-shadow: 0 24px 80px rgba(0,0,0,.28);
  }
  #${widgetId}, #${widgetId} * { box-sizing: border-box; }
  #${widgetId} .cc-shell { display: grid; gap: 22px; }
  #${widgetId} .cc-hero { display: grid; gap: 20px; }
  #${widgetId} .cc-kicker {
    display: inline-flex; align-items: center; gap: 8px; width: fit-content;
    padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,.05);
    color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em;
  }
  #${widgetId} .cc-kicker::before {
    content: ''; width: 8px; height: 8px; border-radius: 50%;
    background: var(--accent); box-shadow: 0 0 16px rgba(223,91,67,.65);
  }
  #${widgetId} h2 { margin: 0; font-size: clamp(30px, 4vw, 44px); line-height: 1.02; max-width: none; }
  #${widgetId} .cc-subtitle { margin: 0; max-width: 760px; color: var(--muted); font-size: 15px; line-height: 1.6; }
  #${widgetId} .cc-meta { display: flex; flex-wrap: wrap; gap: 10px; }
  #${widgetId} .cc-meta span {
    padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,.04);
    border: 1px solid rgba(255,255,255,.06); color: var(--muted); font-size: 13px;
  }
  #${widgetId} .cc-filters { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
  #${widgetId} label { display: grid; gap: 8px; }
  #${widgetId} label span:first-child { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
  #${widgetId} .cc-select-wrap { position: relative; }
  #${widgetId} .cc-select-wrap::after {
    content: 'в–ѕ'; position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
    color: var(--muted); pointer-events: none;
  }
  #${widgetId} select {
    width: 100%; appearance: none; border: 1px solid var(--line); border-radius: 18px;
    background: rgba(9,12,15,.8); color: var(--text); padding: 16px 42px 16px 16px;
    font: inherit; font-size: 15px;
  }
  #${widgetId} select:focus { outline: none; border-color: rgba(223,91,67,.8); }
  #${widgetId} select:disabled { opacity: .55; cursor: not-allowed; }
  #${widgetId} .cc-panel {
    display: none;
    min-height: 320px; padding: 22px; border-radius: 24px; background: var(--panel);
    border: 1px solid rgba(255,255,255,.06); gap: 18px;
  }
  #${widgetId} .cc-empty {
    min-height: 250px; display: grid; place-items: center; text-align: center; padding: 24px;
    color: var(--muted); border-radius: 20px; border: 1px dashed rgba(255,255,255,.12);
    background: rgba(255,255,255,.02);
  }
  #${widgetId} .cc-result { display: none; gap: 18px; animation: ccFade .3s ease; }
  #${widgetId} .cc-panel[data-state="error"] {
    display: grid;
    animation: ccReveal .35s ease;
  }
  #${widgetId} .cc-panel[data-state="ready"] {
    display: grid;
    animation: ccReveal .35s ease;
  }
  #${widgetId} .cc-panel[data-state="ready"] .cc-empty { display: none; }
  #${widgetId} .cc-panel[data-state="ready"] .cc-result { display: grid; }
  #${widgetId} .cc-badges { display: flex; flex-wrap: wrap; gap: 8px; }
  #${widgetId} .cc-badge {
    display: inline-flex; align-items: center; gap: 8px; width: fit-content;
    padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,.05);
    color: var(--muted); font-size: 12px;
  }
  #${widgetId} .cc-badge--source { background: var(--accent-soft); color: #ffd3cb; }
  #${widgetId} .cc-title { margin: 0; font-size: clamp(22px, 3vw, 34px); line-height: 1.1; }
  #${widgetId} .cc-table-wrap {
    overflow-x: auto; border-radius: 20px; border: 1px solid rgba(255,255,255,.06);
    background: rgba(8,10,12,.45);
  }
  #${widgetId} table { width: 100%; border-collapse: collapse; min-width: 640px; }
  #${widgetId} th, #${widgetId} td { padding: 16px 18px; text-align: left; border-bottom: 1px solid var(--line); }
  #${widgetId} th {
    color: var(--muted); font-size: 12px; letter-spacing: .08em; text-transform: uppercase;
    background: rgba(255,255,255,.03);
  }
  #${widgetId} td { font-size: 14px; }
  #${widgetId} tbody td:last-child { color: var(--good); font-weight: 700; }
  #${widgetId} tr:last-child td { border-bottom: none; }
  #${widgetId} .cc-footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 16px; }
  #${widgetId} .cc-disclaimer {
    margin-right: auto;
    max-width: 760px;
    color: rgba(167,175,183,.78);
    font-size: 10px;
    line-height: 1.5;
  }
  #${widgetId} .cc-button {
    display: inline-flex; align-items: center; justify-content: center; min-width: 180px;
    padding: 14px 18px; border-radius: 16px; text-decoration: none; font-weight: 700;
    background: var(--accent); color: #fff;
    border: none; cursor: pointer;
  }
  #${widgetId} .cc-note { color: var(--muted); font-size: 12px; line-height: 1.6; }
  @keyframes ccFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ccReveal { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @media (max-width: 980px) { #${widgetId} .cc-filters { grid-template-columns: repeat(2, minmax(0,1fr)); } }
  @media (max-width: 640px) {
    #${widgetId} { padding: 20px; border-radius: 24px; }
    #${widgetId} h2 { max-width: 10ch; }
    #${widgetId} .cc-filters { grid-template-columns: 1fr; }
    #${widgetId} .cc-button { width: 100%; }
    #${widgetId} .cc-table-wrap { overflow: visible; background: transparent; border: none; }
    #${widgetId} table { min-width: 0; }
    #${widgetId} thead { display: none; }
    #${widgetId} tbody { display: grid; gap: 12px; }
    #${widgetId} tr {
      display: grid;
      gap: 10px;
      padding: 14px 16px;
      border: 1px solid rgba(255,255,255,.06);
      border-radius: 18px;
      background: rgba(8,10,12,.45);
    }
    #${widgetId} td {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      padding: 0;
      border: none;
    }
    #${widgetId} td::before {
      content: attr(data-label);
      color: var(--muted);
      font-size: 11px;
      letter-spacing: .08em;
      text-transform: uppercase;
      flex: 0 0 96px;
    }
  }
</style>
`.trim();

const markupBlock = `
<div id="${widgetId}">
  <div class="cc-shell">
    <div class="cc-hero">
      <div class="cc-kicker">Stage 1 Table</div>
      <h2>РљР°Р»СЊРєСѓР»СЏС‚РѕСЂ С‡РёРї-С‚СЋРЅРёРЅРіР°</h2>
      <p class="cc-subtitle">РћР±СЉРµРґРёРЅС‘РЅРЅР°СЏ Р±Р°Р·Р° РёР· Asiaforce, Seven Force Рё Rechip. Р’С‹Р±РµСЂРёС‚Рµ РјР°СЂРєСѓ, РјРѕРґРµР»СЊ, РіРѕРґ Рё РјРѕС‚РѕСЂ вЂ” РЅРёР¶Рµ РїРѕСЏРІРёС‚СЃСЏ РµРґРёРЅР°СЏ С‚Р°Р±Р»РёС†Р° Stage 1 Рё СЃС‚РѕРёРјРѕСЃС‚СЊ.</p>
      <div class="cc-meta">
        <span id="${widgetId}-meta-brands">вЂ” Р±СЂРµРЅРґРѕРІ</span>
        <span id="${widgetId}-meta-records">вЂ” РјРѕРґРёС„РёРєР°С†РёР№</span>
      </div>
    </div>

    <div class="cc-filters">
      <label><span>РњР°СЂРєР°</span><span class="cc-select-wrap"><select id="${widgetId}-brand" disabled><option value="">Р—Р°РіСЂСѓР·РєР°...</option></select></span></label>
      <label><span>РњРѕРґРµР»СЊ</span><span class="cc-select-wrap"><select id="${widgetId}-model" disabled><option value="">Р’С‹Р±РµСЂРёС‚Рµ РјРѕРґРµР»СЊ</option></select></span></label>
      <label><span>Р“РѕРґ</span><span class="cc-select-wrap"><select id="${widgetId}-year" disabled><option value="">Р’С‹Р±РµСЂРёС‚Рµ РіРѕРґ</option></select></span></label>
      <label><span>РњРѕС‚РѕСЂ</span><span class="cc-select-wrap"><select id="${widgetId}-engine" disabled><option value="">Р’С‹Р±РµСЂРёС‚Рµ РјРѕС‚РѕСЂ</option></select></span></label>
    </div>

    <div class="cc-panel" id="${widgetId}-panel" data-state="hidden">
      <div class="cc-empty" id="${widgetId}-empty">Р—Р°РіСЂСѓР·РєР° Р±Р°Р·С‹ РґР°РЅРЅС‹С… РєР°Р»СЊРєСѓР»СЏС‚РѕСЂР°...</div>
      <div class="cc-result" id="${widgetId}-result">
        <div>
          <div class="cc-badges">
            <div class="cc-badge" id="${widgetId}-path"></div>
          </div>
          <h3 class="cc-title" id="${widgetId}-title"></h3>
        </div>
        <div class="cc-table-wrap">
          <table>
            <thead>
              <tr><th>РџР°СЂР°РјРµС‚СЂ</th><th>Р‘С‹Р»Рѕ</th><th>РЎС‚Р°Р»Рѕ *</th></tr>
            </thead>
            <tbody id="${widgetId}-rows"></tbody>
          </table>
        </div>
        <div class="cc-footer">
          <div class="cc-disclaimer">*Реальные результаты могут отличаться от заявленных в пределах ± 5 %. Такое отклонение обусловлено совокупным влиянием факторов: текущей температурой окружающей среды, характеристиками используемого топлива (октановое число, состав) и индивидуальным техническим состоянием конкретного автомобиля.</div>
          <button class="cc-button" id="${widgetId}-lead-button" type="button">РћСЃС‚Р°РІРёС‚СЊ Р·Р°СЏРІРєСѓ</button>
        </div>
      </div>
    </div>
  </div>
</div>
`.trim();

function createBootstrap(payloadExpression) {
  return `
<script>
  (() => {
    const payload = ${payloadExpression};
    const widgetId = ${JSON.stringify(widgetId)};
    const popupHook = window.__CHIP_CALC_POPUP_HOOK__ || '#chipcalc-popup';
    const els = {
      brand: document.getElementById(\`\${widgetId}-brand\`),
      model: document.getElementById(\`\${widgetId}-model\`),
      year: document.getElementById(\`\${widgetId}-year\`),
      engine: document.getElementById(\`\${widgetId}-engine\`),
      panel: document.getElementById(\`\${widgetId}-panel\`),
      empty: document.getElementById(\`\${widgetId}-empty\`),
      title: document.getElementById(\`\${widgetId}-title\`),
      path: document.getElementById(\`\${widgetId}-path\`),
      rows: document.getElementById(\`\${widgetId}-rows\`),
      leadButton: document.getElementById(\`\${widgetId}-lead-button\`),
      metaBrands: document.getElementById(\`\${widgetId}-meta-brands\`),
      metaRecords: document.getElementById(\`\${widgetId}-meta-records\`),
    };

    if (!payload || !payload.meta || !Array.isArray(payload.grouped)) {
      els.panel.dataset.state = 'error';
      els.empty.textContent = 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р±Р°Р·Сѓ РґР°РЅРЅС‹С… РєР°Р»СЊРєСѓР»СЏС‚РѕСЂР°. РџСЂРѕРІРµСЂСЊС‚Рµ РїРѕРґРєР»СЋС‡РµРЅРёРµ С„Р°Р№Р»Р° СЃ РґР°РЅРЅС‹РјРё.';
      return;
    }

    const data = payload.grouped;
    const state = { brand: '', model: '', year: '', engine: '' };

    els.metaBrands.textContent = String(payload.meta.brands) + ' Р±СЂРµРЅРґРѕРІ';
    els.metaRecords.textContent = String(payload.meta.totalRecords) + ' РјРѕРґРёС„РёРєР°С†РёР№';
    els.brand.disabled = false;

    const fillSelect = (select, items, placeholder, mapper) => {
      const current = select.value;
      select.innerHTML = '';
      const first = document.createElement('option');
      first.value = '';
      first.textContent = placeholder;
      select.appendChild(first);
      items.forEach((item) => {
        const mapped = mapper(item);
        const option = document.createElement('option');
        option.value = mapped.value;
        option.textContent = mapped.label;
        select.appendChild(option);
      });
      select.value = [...select.options].some((option) => option.value === current) ? current : '';
    };

    const findBrand = () => data.find((brand) => brand.name === state.brand) || null;
    const findModel = () => findBrand() && findBrand().models.find((model) => model.name === state.model) || null;
    const findYear = () => findModel() && findModel().years.find((year) => year.name === state.year) || null;
    const findEngine = () => findYear() && findYear().engines.find((engine) => engine.slug === state.engine) || null;

    const renderBrands = () => fillSelect(els.brand, data, 'Р’С‹Р±РµСЂРёС‚Рµ РјР°СЂРєСѓ', (item) => ({ value: item.name, label: item.name }));
    const renderModels = () => {
      const items = findBrand() ? findBrand().models : [];
      fillSelect(els.model, items, 'Р’С‹Р±РµСЂРёС‚Рµ РјРѕРґРµР»СЊ', (item) => ({ value: item.name, label: item.name }));
      els.model.disabled = !items.length;
    };
    const renderYears = () => {
      const items = findModel() ? findModel().years : [];
      fillSelect(els.year, items, 'Р’С‹Р±РµСЂРёС‚Рµ РіРѕРґ', (item) => ({ value: item.name, label: item.name }));
      els.year.disabled = !items.length;
    };
    const renderEngines = () => {
      const items = findYear() ? findYear().engines : [];
      fillSelect(els.engine, items, 'Р’С‹Р±РµСЂРёС‚Рµ РјРѕС‚РѕСЂ', (item) => ({ value: item.slug, label: item.name }));
      els.engine.disabled = !items.length;
    };

    const sourceName = (source) => source === 'asiaforce' ? 'РСЃС‚РѕС‡РЅРёРє: Asiaforce' : source === 'sevenforce' ? 'РСЃС‚РѕС‡РЅРёРє: Seven Force' : 'РСЃС‚РѕС‡РЅРёРє: Rechip';
    const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const formValue = (value) => String(value == null ? '' : value);
    const isPowerRow = (label) => /РјРѕС‰/i.test(label);
    const isTorqueRow = (label) => /РєСЂСѓС‚/i.test(label);
    const pickStageRows = (rows) => rows.filter((row) => isPowerRow(row.label) || isTorqueRow(row.label));
    const findMetricRow = (rows, matcher) => rows.find((row) => matcher(row.label)) || null;

    const setFieldValue = (variableName, value) => {
      const selectors = [
        '[name="' + variableName + '"]',
        '[data-name="' + variableName + '"]',
        '[data-input-lid="' + variableName + '"]',
      ];

      document.querySelectorAll(selectors.join(',')).forEach((field) => {
        field.value = value;
        field.setAttribute('value', value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };

    const popupSummaryHtml = (context) =>
      '<strong>Р’С‹ РІС‹Р±СЂР°Р»Рё</strong>' +
      escapeHtml(context.selection) +
      '<br>' +
      escapeHtml(context.title) +
      '<br>' +
      'РњРѕС‰РЅРѕСЃС‚СЊ: ' + escapeHtml(context.powerStock) + ' в†’ ' + escapeHtml(context.powerTuned) +
      '<br>' +
      'РљСЂСѓС‚СЏС‰РёР№ РјРѕРјРµРЅС‚: ' + escapeHtml(context.torqueStock) + ' в†’ ' + escapeHtml(context.torqueTuned);

    const renderPopupContext = (context) => {
      document.querySelectorAll('.t-popup_show form, .t-popup_show .t-form').forEach((form) => {
        let box = form.querySelector('.cc-popup-context');
        if (!box) {
          box = document.createElement('div');
          box.className = 'cc-popup-context';
          form.insertBefore(box, form.firstChild);
        }
        box.innerHTML = popupSummaryHtml(context);
      });
    };

    const syncLeadContext = (context) => {
      const fields = {
        car_selection: context.selection,
        car_brand: context.brand,
        car_model: context.model,
        car_year: context.year,
        car_engine: context.engine,
        car_title: context.title,
        power_stock: context.powerStock,
        power_tuned: context.powerTuned,
        torque_stock: context.torqueStock,
        torque_tuned: context.torqueTuned,
        car_source: context.source,
        car_url: context.url,
      };

      Object.entries(fields).forEach(([name, value]) => {
        setFieldValue(name, formValue(value));
      });

      renderPopupContext(context);
    };

    const scheduleLeadContextSync = (context) => {
      [0, 120, 400, 900].forEach((delay) => {
        window.setTimeout(() => syncLeadContext(context), delay);
      });
    };

    const openTildaPopup = () => {
      let trigger = document.getElementById(widgetId + '-popup-trigger');
      if (!trigger) {
        trigger = document.createElement('a');
        trigger.id = widgetId + '-popup-trigger';
        trigger.href = popupHook;
        trigger.style.display = 'none';
        document.body.appendChild(trigger);
      }
      trigger.click();
    };

    const buildLeadContext = (engine) => {
      const stageRows = pickStageRows(engine.rows);
      const powerRow = findMetricRow(stageRows, isPowerRow);
      const torqueRow = findMetricRow(stageRows, isTorqueRow);

      return {
        brand: state.brand,
        model: state.model,
        year: state.year,
        engine: engine.name,
        title: engine.title,
        source: sourceName(engine.source).replace('РСЃС‚РѕС‡РЅРёРє: ', ''),
        url: engine.url,
        selection: [state.brand, state.model, state.year, engine.name].join(' / '),
        powerStock: powerRow ? powerRow.stock : '',
        powerTuned: powerRow ? powerRow.tuned : '',
        torqueStock: torqueRow ? torqueRow.stock : '',
        torqueTuned: torqueRow ? torqueRow.tuned : '',
      };
    };

    const renderResult = () => {
      const engine = findEngine();
      if (!engine) {
        els.panel.dataset.state = 'hidden';
        return;
      }
      const stageRows = pickStageRows(engine.rows);
      els.panel.dataset.state = 'ready';
      els.title.textContent = engine.title;
      els.path.textContent = [state.brand, state.model, state.year, engine.name].join(' / ');
      els.rows.innerHTML = '';
      stageRows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td data-label="РџР°СЂР°РјРµС‚СЂ">' + escapeHtml(row.label) + '</td>' +
          '<td data-label="Р‘С‹Р»Рѕ">' + escapeHtml(row.stock) + '</td>' +
          '<td data-label="РЎС‚Р°Р»Рѕ">' + escapeHtml(row.tuned) + '</td>';
        els.rows.appendChild(tr);
      });
    };

    els.brand.addEventListener('change', () => {
      state.brand = els.brand.value;
      state.model = '';
      state.year = '';
      state.engine = '';
      renderModels();
      renderYears();
      renderEngines();
      renderResult();
    });

    els.model.addEventListener('change', () => {
      state.model = els.model.value;
      state.year = '';
      state.engine = '';
      renderYears();
      renderEngines();
      renderResult();
    });

    els.year.addEventListener('change', () => {
      state.year = els.year.value;
      state.engine = '';
      renderEngines();
      renderResult();
    });

    els.engine.addEventListener('change', () => {
      state.engine = els.engine.value;
      renderResult();
    });

    els.leadButton.addEventListener('click', () => {
      const engine = findEngine();
      if (!engine) {
        return;
      }

      const context = buildLeadContext(engine);
      scheduleLeadContextSync(context);
      openTildaPopup();
    });

    renderBrands();
    renderModels();
    renderYears();
    renderEngines();
    renderResult();
  })();
</script>
  `.trim();
}

const charsetMeta = `<meta charset="utf-8">`;

const inlineSnippet = [
  charsetMeta,
  styleBlock,
  markupBlock,
  createBootstrap(JSON.stringify({ meta: payload.meta, grouped: payload.grouped })),
].join('\n\n');

const loaderSnippet = [
  charsetMeta,
  styleBlock,
  markupBlock,
  `<script>window.__CHIP_CALC_DATA__ = window.__CHIP_CALC_DATA__ || null;</script>`,
  `<script src="${dataScriptPlaceholder}"></script>`,
  createBootstrap('window.__CHIP_CALC_DATA__'),
].join('\n\n');

const preview = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>РљР°Р»СЊРєСѓР»СЏС‚РѕСЂ С‡РёРї-С‚СЋРЅРёРЅРіР°</title>
    <style>
      body { margin: 0; min-height: 100vh; background: linear-gradient(180deg, #f1f4f6 0%, #e6eaee 100%); padding: 36px 16px; }
      .preview-wrap { max-width: 1180px; margin: 0 auto; }
    </style>
  </head>
  <body>
    <div class="preview-wrap">${inlineSnippet}</div>
  </body>
</html>
`;

const dataScript = `window.__CHIP_CALC_DATA__ = ${JSON.stringify({
  meta: payload.meta,
  grouped: payload.grouped,
})};\n`;

await writeFile('dist/tilda-calculator-inline.html', `${inlineSnippet}\n`, 'utf8');
await writeFile('dist/tilda-calculator.html', `${loaderSnippet}\n`, 'utf8');
await writeFile('dist/tilda-calculator-data.js', dataScript, 'utf8');
await writeFile(
  'dist/tilda-calculator-data.json',
  `${JSON.stringify({ meta: payload.meta, grouped: payload.grouped })}\n`,
  'utf8',
);
await writeFile('dist/preview.html', `${preview}\n`, 'utf8');

