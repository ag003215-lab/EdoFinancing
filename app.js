/* app.js — Adaptado al HTML original con:
   - Meta: #companyName #periodEnd #logoURL #saveMeta
   - Tabs: .tab-btn[data-tab="input|preview|dashboard|export"] y sections #input #preview #dashboard #export
   - Contenedores de líneas: #assetsCurrentContainer #assetsNonCurrentContainer #liabilitiesCurrentContainer #liabilitiesNonCurrentContainer #equityContainer
   - Resultados: #revenuesContainer #expensesContainer
   - Botones: #calcBtn #clearBtn
   - Vista previa: #report, #reportLogo #reportCompany #reportPeriod #eqStatus
   - Previews de tablas: #balancePreview #incomePreview #ratiosPreview #notes
   - Dashboard: #modeSelector #chartSelect #statCurrentRatio #statQuickRatio #statROE #statMargin #mainChart
   - Export: #pdfTemplate #includeSignatures #includeNotes #exportPdfBtn #exportCsvBtn #csvImport #restoreBtn #exportJsonBtn
   - QR: #qrText #generateQrBtn #qrContainer
   Requiere: Chart.js, html2pdf.js y qrcode (ya incluidos en tu index). */

(() => {
    // ---------- Utils ----------
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
    const toNum = v => Number.isFinite(+v) ? +v : 0;
    const uid = () => Math.random().toString(36).slice(2, 9);

    // ---------- State ----------
    const state = {
        meta: { company: '', period: '', logoSrc: '' },
        balance: {
            assets: { current: [], nonCurrent: [] },         // [{id, name, amount}]
            liabilities: { current: [], nonCurrent: [] },
            equity: { main: [] }
        },
        income: { revenues: [], expenses: [] },              // Estado de resultados
        calc: { // totales calculados
            totals: {}, ratios: {}
        },
        dashboard: { mode: 'bank', chart: null, chartKind: 'liquidity' },
    };

    // ---------- Lines (CRUD) ----------
    function addLine(section, group) {
        const line = { id: uid(), name: 'Nuevo', amount: 0 };
        state[section === 'income' ? 'income' : (section === 'equity' ? 'balance' : 'balance')]
        if (section === 'assets') state.balance.assets[group].push(line);
        else if (section === 'liabilities') state.balance.liabilities[group].push(line);
        else if (section === 'equity') state.balance.equity.main.push(line);
        else if (section === 'income') state.income[group].push(line);
        renderLines();
        persist();
    }
    function removeLine(section, group, id) {
        const arr = getArr(section, group);
        const i = arr.findIndex(x => x.id === id);
        if (i >= 0) arr.splice(i, 1);
        renderLines();
        persist();
    }
    function getArr(section, group) {
        if (section === 'assets') return state.balance.assets[group];
        if (section === 'liabilities') return state.balance.liabilities[group];
        if (section === 'equity') return state.balance.equity.main;
        if (section === 'income') return state.income[group];
        return [];
    }

    // ---------- Rendering (Entrada) ----------
    function renderLines() {
        renderGroup('#assetsCurrentContainer', 'assets', 'current', 'Activo Corriente');
        renderGroup('#assetsNonCurrentContainer', 'assets', 'nonCurrent', 'Activo No Corriente');
        renderGroup('#liabilitiesCurrentContainer', 'liabilities', 'current', 'Pasivo Corriente');
        renderGroup('#liabilitiesNonCurrentContainer', 'liabilities', 'nonCurrent', 'Pasivo No Corriente');
        renderGroup('#equityContainer', 'equity', 'main', 'Patrimonio');
        renderGroup('#revenuesContainer', 'income', 'revenues', 'Ingresos');
        renderGroup('#expensesContainer', 'income', 'expenses', 'Gastos');
    }

    function renderGroup(containerSel, section, group, title) {
        const el = $(containerSel);
        const rows = getArr(section, group);
        el.innerHTML = `
      <table class="table mini">
        <thead><tr><th style="width:60%">Concepto</th><th style="width:30%">Importe</th><th></th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr data-id="${r.id}">
              <td><input class="line-name" value="${escapeHtml(r.name)}" /></td>
              <td><input class="line-amount" type="number" step="0.01" value="${r.amount}" /></td>
              <td style="text-align:center"><button class="danger" data-del>×</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
        // Bind events
        el.querySelectorAll('.line-name').forEach(inp => {
            inp.addEventListener('input', e => {
                const id = e.target.closest('tr').dataset.id;
                const row = rows.find(x => x.id === id);
                if (row) { row.name = e.target.value; persistThrottled(); }
            });
        });
        el.querySelectorAll('.line-amount').forEach(inp => {
            inp.addEventListener('input', e => {
                const id = e.target.closest('tr').dataset.id;
                const row = rows.find(x => x.id === id);
                if (row) { row.amount = toNum(e.target.value); persistThrottled(); }
            });
        });
        el.querySelectorAll('[data-del]').forEach(btn => {
            btn.addEventListener('click', e => {
                const id = e.target.closest('tr').dataset.id;
                removeLine(section, group, id);
            });
        });
    }

    // ---------- Cálculos ----------
    const sumArr = arr => arr.reduce((a, b) => a + toNum(b.amount), 0);

    function calculate() {
        // Balance
        const actC = sumArr(state.balance.assets.current);
        const actNC = sumArr(state.balance.assets.nonCurrent);
        const pasC = sumArr(state.balance.liabilities.current);
        const pasNC = sumArr(state.balance.liabilities.nonCurrent);
        const pat = sumArr(state.balance.equity.main);

        const activo = actC + actNC;
        const pasivo = pasC + pasNC;
        const pasMasPat = pasivo + pat;

        // Resultados
        const ingresos = sumArr(state.income.revenues);
        const gastos = sumArr(state.income.expenses);
        // desglose simple (si existen líneas con nombres clave)
        const costoVentas = takeByName(state.income.expenses, ['Costo', 'Costo de Ventas']);
        const dep = takeByName(state.income.expenses, ['Depreciación', 'Depreciacion']);
        const amo = takeByName(state.income.expenses, ['Amortización', 'Amortizacion']);
        const financieros = takeByName(state.income.expenses, ['Financieros', 'Intereses']);

        const bruto = ingresos - (costoVentas ?? 0);
        const operativo = bruto - (gastos - (costoVentas ?? 0));
        const antesImp = operativo - (financieros ?? 0);
        const impuestos = 0; // libre: puedes agregar línea “Impuestos” en gastos si lo prefieres
        const neto = antesImp - impuestos;

        // Ratios
        const razonCorr = pasC === 0 ? null : (actC / pasC);
        const inventarios = takeByName(state.balance.assets.current, ['Inventarios']);
        const pruebaAcida = pasC === 0 ? null : ((actC - (inventarios ?? 0)) / pasC);
        const endeud = activo === 0 ? null : (pasivo / activo);
        const capTrabajo = actC - pasC;
        const roe = pat === 0 ? null : (neto / pat);
        const margen = ingresos === 0 ? null : (neto / ingresos);

        state.calc.totals = { actC, actNC, pasC, pasNC, pat, activo, pasivo, pasMasPat, ingresos, gastos, bruto, operativo, antesImp, impuestos, neto };
        state.calc.ratios = { razonCorr, pruebaAcida, endeud, capTrabajo, roe, margen };
        return state.calc;
    }

    function takeByName(list, names) {
        const nset = new Set(names.map(x => x.toLowerCase()));
        let sum = 0, hit = false;
        list.forEach(l => { if (nset.has(String(l.name || '').toLowerCase())) { sum += toNum(l.amount); hit = true; } });
        return hit ? sum : null;
    }

    // ---------- Vista previa ----------
    function renderPreview() {
        const { totals, ratios } = calculate();

        // Meta
        $('#reportCompany').textContent = state.meta.company || 'Empresa';
        $('#reportPeriod').textContent = state.meta.period || 'Periodo';
        const logo = $('#reportLogo');
        if (state.meta.logoSrc) { logo.src = state.meta.logoSrc; logo.style.display = 'block'; } else { logo.style.display = 'none'; }

        // Ecuación contable
        const ok = Math.abs(totals.activo - totals.pasMasPat) < 0.005;
        const stat = $('#eqStatus');
        stat.textContent = ok ? 'Ecuación OK' : 'Ecuación NO cuadra';
        stat.className = `status ${ok ? 'ok' : 'bad'}`;

        // Balance
        $('#balancePreview').innerHTML = `
      <table class="table">
        <thead><tr><th>Cuenta</th><th>Importe</th></tr></thead>
        <tbody>
          <tr><td><strong>Activo Corriente</strong></td><td><strong>${fmt.format(totals.actC)}</strong></td></tr>
          ${rowsHtml(state.balance.assets.current)}
          <tr><td><strong>Activo No Corriente</strong></td><td><strong>${fmt.format(totals.actNC)}</strong></td></tr>
          ${rowsHtml(state.balance.assets.nonCurrent)}
          <tr><td><strong>Total Activo</strong></td><td><strong>${fmt.format(totals.activo)}</strong></td></tr>
          <tr><td colspan="2"></td></tr>
          <tr><td><strong>Pasivo Corriente</strong></td><td><strong>${fmt.format(totals.pasC)}</strong></td></tr>
          ${rowsHtml(state.balance.liabilities.current)}
          <tr><td><strong>Pasivo No Corriente</strong></td><td><strong>${fmt.format(totals.pasNC)}</strong></td></tr>
          ${rowsHtml(state.balance.liabilities.nonCurrent)}
          <tr><td><strong>Patrimonio</strong></td><td><strong>${fmt.format(totals.pat)}</strong></td></tr>
          ${rowsHtml(state.balance.equity.main)}
          <tr><td><strong>Pasivo + Patrimonio</strong></td><td><strong>${fmt.format(totals.pasMasPat)}</strong></td></tr>
        </tbody>
      </table>`;

        // Resultados
        $('#incomePreview').innerHTML = `
      <table class="table">
        <thead><tr><th>Concepto</th><th>Importe</th></tr></thead>
        <tbody>
          <tr><td><strong>Ingresos</strong></td><td><strong>${fmt.format(totals.ingresos)}</strong></td></tr>
          ${rowsHtml(state.income.revenues)}
          <tr><td><strong>Gastos</strong></td><td><strong>${fmt.format(totals.gastos)}</strong></td></tr>
          ${rowsHtml(state.income.expenses)}
          <tr><td><strong>Utilidad Bruta</strong></td><td><strong>${fmt.format(totals.bruto)}</strong></td></tr>
          <tr><td><strong>Resultado Operativo</strong></td><td><strong>${fmt.format(totals.operativo)}</strong></td></tr>
          <tr><td><strong>Resultado Neto</strong></td><td><strong>${fmt.format(totals.neto)}</strong></td></tr>
        </tbody>
      </table>`;

        // Ratios
        $('#ratiosPreview').innerHTML = `
      ${ratioItem('Razón Corriente', ratios.razonCorr, v => v.toFixed(2))}
      ${ratioItem('Prueba Ácida', ratios.pruebaAcida, v => v.toFixed(2))}
      ${ratioItem('Endeudamiento', ratios.endeud, v => (v * 100).toFixed(2) + '%')}
      ${ratioItem('Capital de Trabajo', ratios.capTrabajo, v => fmt.format(v))}
      ${ratioItem('ROE', ratios.roe, v => (v * 100).toFixed(2) + '%')}
      ${ratioItem('Margen Neto', ratios.margen, v => (v * 100).toFixed(2) + '%')}
    `;
        persist();
    }
    const rowsHtml = arr => arr.map(r => `<tr><td>${escapeHtml(r.name || '')}</td><td>${fmt.format(toNum(r.amount))}</td></tr>`).join('');
    const ratioItem = (name, val, f) => `<div class="ratioItem"><span>${name}</span><strong>${val == null ? '—' : f(val)}</strong></div>`;

    // ---------- Dashboard ----------
    function renderDashboard() {
        const { ratios } = calculate();
        $('#statCurrentRatio').textContent = ratios.razonCorr == null ? '—' : ratios.razonCorr.toFixed(2);
        $('#statQuickRatio').textContent = ratios.pruebaAcida == null ? '—' : ratios.pruebaAcida.toFixed(2);
        $('#statROE').textContent = ratios.roe == null ? '—' : (ratios.roe * 100).toFixed(2) + '%';
        $('#statMargin').textContent = ratios.margen == null ? '—' : (ratios.margen * 100).toFixed(2) + '%';

        const ctx = $('#mainChart');
        const kind = state.dashboard.chartKind;
        const dataset =
            (kind === 'liquidity') ? {
                labels: ['Razón Corriente', 'Prueba Ácida'],
                data: [ratios.razonCorr ?? 0, ratios.pruebaAcida ?? 0]
            } : {
                labels: ['Margen Neto', 'ROE'],
                data: [ratios.margen ?? 0, ratios.roe ?? 0]
            };
        if (state.dashboard.chart) state.dashboard.chart.destroy();
        state.dashboard.chart = new Chart(ctx, {
            type: 'bar',
            data: { labels: dataset.labels, datasets: [{ label: 'Indicadores', data: dataset.data }] },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    }

    // ---------- Export ----------
    async function exportPDF() {
        // opcional: plantilla afecta clase del #report
        const tpl = $('#pdfTemplate').value;            // corporate | minimal | bank
        const includeNotes = $('#includeNotes').checked;

        const rep = $('#report');
        rep.dataset.tpl = tpl;
        $('#notes').style.display = includeNotes ? 'block' : 'none';

        renderPreview(); // asegurar datos al día
        const ok = Math.abs(state.calc.totals.activo - state.calc.totals.pasMasPat) < 0.005;
        if (!ok) { alert('La ecuación contable no cuadra. Ajusta importes para continuar.'); return; }

        const opt = {
            margin: 10,
            filename: `Estados_${(state.meta.company || 'Empresa').replace(/\s+/g, '_')}_${state.meta.period || 'Periodo'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        await html2pdf().from(rep).set(opt).save();
    }

    function exportCSV() {
        const { totals } = calculate();
        const parts = [];

        const pushSection = (title, arr) => {
            parts.push(title);
            parts.push('Nombre,Importe');
            parts.push(...arr.map(r => `${csvEsc(r.name)},${toNum(r.amount)}`));
            parts.push('');
        };

        pushSection('Activo Corriente', state.balance.assets.current);
        pushSection('Activo No Corriente', state.balance.assets.nonCurrent);
        pushSection('Pasivo Corriente', state.balance.liabilities.current);
        pushSection('Pasivo No Corriente', state.balance.liabilities.nonCurrent);
        pushSection('Patrimonio', state.balance.equity.main);
        pushSection('Ingresos', state.income.revenues);
        pushSection('Gastos', state.income.expenses);

        parts.push('Totales,');
        parts.push(`Total Activo,${totals.activo}`);
        parts.push(`Pasivo + Patrimonio,${totals.pasMasPat}`);
        parts.push(`Ingresos,${totals.ingresos}`);
        parts.push(`Gastos,${totals.gastos}`);
        parts.push(`Resultado Neto,${totals.neto}`);

        const csv = parts.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Estados_${(state.meta.company || 'Empresa').replace(/\s+/g, '_')}_${state.meta.period || 'Periodo'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
    const csvEsc = s => `"${String(s ?? '').replace(/"/g, '""')}"`;

    // ---------- Import CSV sencillo (Nombre,Importe,Seccion,Grupo) ----------
    $('#csvImport')?.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const lines = String(reader.result).split(/\r?\n/).filter(x => x.trim());
                const header = lines.shift();
                const cols = header.split(',').map(h => h.trim().toLowerCase());
                const idx = Object.fromEntries(cols.map((c, i) => [c, i]));
                const pushSafe = (section, group, name, amount) => {
                    const arr = getArr(section, group);
                    arr.push({ id: uid(), name, amount: toNum(amount) });
                };
                lines.forEach(line => {
                    const cells = splitCsv(line);
                    const name = cells[idx['nombre']] ?? 'Item';
                    const amount = cells[idx['importe']] ?? '0';
                    const section = (cells[idx['seccion']] ?? '').trim().toLowerCase(); // assets/liabilities/equity/income
                    const group = (cells[idx['grupo']] ?? '').trim();                   // current/nonCurrent/main/revenues/expenses
                    if (section && group) pushSafe(section, group, name, amount);
                });
                renderLines(); renderPreview(); renderDashboard(); persist();
                alert('Importación CSV completada.');
            } catch (err) {
                console.error(err); alert('CSV inválido. Encabezados esperados: Nombre, Importe, Seccion, Grupo');
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    });

    function splitCsv(line) {
        const out = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') { inQ = !inQ; continue; }
            if (c === ',' && !inQ) { out.push(cur); cur = ''; } else { cur += c; }
        }
        out.push(cur); return out;
    }

    // ---------- Meta ----------
    $('#saveMeta')?.addEventListener('click', async () => {
        state.meta.company = $('#companyName').value.trim();
        state.meta.period = $('#periodEnd').value;
        const url = $('#logoURL').value.trim();
        if (url) {
            try {
                // usar como logo directo
                state.meta.logoSrc = url;
                $('#companyLogoPreview').src = url;
                $('#companyLogoPreview').style.display = 'block';
            } catch { }
        }
        renderPreview();
        persist();
    });

    // ---------- Botones generales ----------
    $('#calcBtn')?.addEventListener('click', () => { renderPreview(); renderDashboard(); });
    $('#clearBtn')?.addEventListener('click', () => { clearAll(); });

    // ---------- Tabs ----------
    $$('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            $$('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
            $$('.tab').forEach(s => s.classList.toggle('active', s.id === tab));
            if (tab === 'preview') renderPreview();
            if (tab === 'dashboard') renderDashboard();
        });
    });

    // ---------- Dashboard selectors ----------
    $('#modeSelector')?.addEventListener('change', e => { state.dashboard.mode = e.target.value; renderDashboard(); });
    $('#chartSelect')?.addEventListener('change', e => { state.dashboard.chartKind = (e.target.value === 'profit') ? 'profit' : 'liquidity'; renderDashboard(); });

    // ---------- Export buttons ----------
    $('#exportPdfBtn')?.addEventListener('click', exportPDF);
    $('#exportCsvBtn')?.addEventListener('click', exportCSV);
    $('#exportJsonBtn')?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `backup_${Date.now()}.json`; a.click();
        URL.revokeObjectURL(url);
    });

    // ---------- Restore (localStorage) ----------
    $('#restoreBtn')?.addEventListener('click', () => {
        const s = localStorage.getItem('finanzaspro_state');
        if (!s) { alert('No hay sesión guardada.'); return; }
        try {
            const obj = JSON.parse(s);
            Object.assign(state, obj);
            // reflejar meta visibles
            $('#companyName').value = state.meta.company || '';
            $('#periodEnd').value = state.meta.period || '';
            if (state.meta.logoSrc) { $('#companyLogoPreview').src = state.meta.logoSrc; $('#companyLogoPreview').style.display = 'block'; }
            renderLines(); renderPreview(); renderDashboard();
            alert('Sesión restaurada.');
        } catch (e) { alert('Backup inválido.'); }
    });

    // ---------- QR ----------
    $('#generateQrBtn')?.addEventListener('click', () => {
        const text = $('#qrText').value.trim();
        if (!text) { alert('Escribe un texto o link para el QR'); return; }
        $('#qrContainer').innerHTML = '';
        // librería qrcode ya está incluida
        QRCode.toCanvas(text, { width: 140 }, (err, canvas) => {
            if (err) { console.error(err); alert('No se pudo generar el QR.'); return; }
            $('#qrContainer').appendChild(canvas);
        });
    });

    // ---------- Helpers ----------
    const escapeHtml = s => String(s ?? '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
    function clearAll() {
        state.balance.assets.current = [];
        state.balance.assets.nonCurrent = [];
        state.balance.liabilities.current = [];
        state.balance.liabilities.nonCurrent = [];
        state.balance.equity.main = [];
        state.income.revenues = [];
        state.income.expenses = [];
        renderLines(); renderPreview(); renderDashboard(); persist();
    }

    function persist() { try { localStorage.setItem('finanzaspro_state', JSON.stringify(state)); } catch { } }
    const persistThrottled = throttle(persist, 400);
    function throttle(fn, ms) { let t = null; return (...a) => { if (t) return; t = setTimeout(() => { t = null; fn(...a); }, ms); }; }

    // ---------- Init ----------
    function init() {
        // botones agregar línea (según tus controles en Entrada)
        // Activos
        window.app = window.app || {};
        window.app.addLine = addLine;

        // Cargar sesión previa
        const s = localStorage.getItem('finanzaspro_state');
        if (s) {
            try {
                const obj = JSON.parse(s);
                // Estructura segura (por si cambió el esquema)
                Object.assign(state.meta, obj.meta || {});
                ['assets', 'liabilities'].forEach(k => {
                    ['current', 'nonCurrent'].forEach(g => {
                        state.balance[k][g] = (obj.balance?.[k]?.[g] ?? []).map(x => ({ id: x.id || uid(), name: x.name || 'Item', amount: +x.amount || 0 }));
                    });
                });
                state.balance.equity.main = (obj.balance?.equity?.main ?? []).map(x => ({ id: x.id || uid(), name: x.name || 'Item', amount: +x.amount || 0 }));
                state.income.revenues = (obj.income?.revenues ?? []).map(x => ({ id: x.id || uid(), name: x.name || 'Item', amount: +x.amount || 0 }));
                state.income.expenses = (obj.income?.expenses ?? []).map(x => ({ id: x.id || uid(), name: x.name || 'Item', amount: +x.amount || 0 }));
            } catch { }
        }

        // Pintar
        renderLines();
        renderPreview();
        renderDashboard();
    }

    // Go!
    window.addEventListener('DOMContentLoaded', init);
})();
