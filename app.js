/* app.js - FinPro X (versión profesional)
   - Compatible con el index.html que te pasé
   - Requerimientos: Tailwind + Chart.js + html2canvas + jspdf + xlsx (están incluidos en HTML)
*/

/* ===========================
   Config / Helpers
   =========================== */

const STORAGE_KEY = 'finprox_profesional_v1';

// Parse currency-ish inputs -> number
function unformatCurrency(str) {
    if (str === undefined || str === null || str === '') return 0;
    const s = String(str).trim();
    const cleaned = s.replace(/[^0-9\-,.]/g, '');
    if (cleaned === '') return 0;
    // Heuristics: if contains comma+dot => comma thousands dot decimal
    if (cleaned.includes(',') && cleaned.includes('.')) {
        return parseFloat(cleaned.replace(/,/g, '')) || 0;
    } else if (cleaned.includes(',') && !cleaned.includes('.')) {
        // comma as decimal
        return parseFloat(cleaned.replace(/,/g, '.')) || 0;
    } else {
        return parseFloat(cleaned) || 0;
    }
}

// Format number to localized MXN currency
function formatCurrency(num) {
    const v = Number(num) || 0;
    return v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

// Get element value by id (handles input and span)
function getElVal(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    if ('value' in el) return unformatCurrency(el.value);
    return unformatCurrency(el.textContent);
}

// Set element formatted (input.value or textContent)
function setElFormatted(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const formatted = formatCurrency(value);
    if ('value' in el) el.value = formatted;
    else el.textContent = formatted;
}

// Set plain text (non-currency)
function setText(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    if ('value' in el) el.value = text;
    else el.textContent = text;
}

/* ===========================
   Calculations: Results, Balance, Cash, Ratios
   =========================== */

function calcularResultados() {
    const ingresos = getElVal('ingresos-ventas');
    const devoluciones = getElVal('devoluciones-ventas');
    const ventasNetas = ingresos - devoluciones;
    setText('net-sales-display', formatCurrency(ventasNetas));

    const costoVentas = getElVal('cost-of-sales');
    const utilidadBruta = ventasNetas - costoVentas;
    setText('gross-profit-display', formatCurrency(utilidadBruta));

    const gastosPersonal = getElVal('gastos-personal');
    const gastosAdmin = getElVal('gastos-administracion');
    const gastosVenta = getElVal('gastos-venta');
    const otrosGastos = getElVal('otros-gastos-op');
    const totalGastosOp = gastosPersonal + gastosAdmin + gastosVenta + otrosGastos;

    const ebitda = utilidadBruta - totalGastosOp;
    setText('ebitda-display', formatCurrency(ebitda));

    const depreciacion = getElVal('depreciacion-amortizacion');
    const utilidadOperacional = ebitda - depreciacion;
    setText('operational-income-display', formatCurrency(utilidadOperacional));

    const gastosFinancieros = getElVal('gastos-financieros');
    const antesImpuestos = utilidadOperacional - gastosFinancieros;
    setText('pre-tax-income-display', formatCurrency(antesImpuestos));

    const impuestos = getElVal('impuestos');
    const utilidadNeta = antesImpuestos - impuestos;
    setText('net-income-display', formatCurrency(utilidadNeta));

    // copy utilidad neta to balance readonly input
    const netBal = document.getElementById('net-income-balance');
    if (netBal) netBal.value = formatCurrency(utilidadNeta);

    // dashboard & summary quick update
    const dRev = document.getElementById('dashboard-revenue');
    if (dRev) dRev.textContent = formatCurrency(ventasNetas);
    const dNet = document.getElementById('dashboard-net-income');
    if (dNet) dNet.textContent = formatCurrency(utilidadNeta);
    const summaryNet = document.getElementById('summary-net-income-actual');
    if (summaryNet) summaryNet.textContent = formatCurrency(utilidadNeta);
    const summaryIncome = document.getElementById('summary-income-actual');
    if (summaryIncome) summaryIncome.textContent = formatCurrency(ingresos);
    const summaryCOS = document.getElementById('summary-cos-actual');
    if (summaryCOS) summaryCOS.textContent = formatCurrency(costoVentas);

    return { ventasNetas, utilidadBruta, ebitda, utilidadOperacional, utilidadNeta };
}

function calcularBalance() {
    // Activo
    const activoCorr = getElVal('caja') + getElVal('bancos') + getElVal('accounts-receivable') + getElVal('inventories') + getElVal('other-current-assets');
    const activoNoCorr = getElVal('ppe') + getElVal('intangibles') + getElVal('other-non-current-assets');
    const totalActivo = activoCorr + activoNoCorr;

    // Pasivo
    const pasivoCorr = getElVal('accounts-payable') + getElVal('short-term-loans') + getElVal('labor-liabilities') + getElVal('other-current-liabilities');
    const pasivoNoCorr = getElVal('long-term-debt') + getElVal('other-non-current-liabilities');
    const totalPasivo = pasivoCorr + pasivoNoCorr;

    // Patrimonio
    const patrimonio = getElVal('capital-social') + getElVal('reserves') + getElVal('retained-earnings') + getElVal('net-income-balance');
    const totalPatrimonio = patrimonio;

    // set displays
    setText('total-activo', formatCurrency(totalActivo));
    setText('total-pasivo', formatCurrency(totalPasivo));
    setText('total-patrimonio', formatCurrency(totalPatrimonio));

    const totalPyP = totalPasivo + totalPatrimonio;
    setText('total-pasivo-patrimonio', formatCurrency(totalPyP));

    // Equation status
    const eq = document.getElementById('equation-status');
    if (eq) {
        const diff = totalActivo - totalPyP;
        const tol = 0.01;
        if (Math.abs(diff) <= tol) {
            eq.innerHTML = `<span style="color:#16a34a;font-weight:700">✅ Balance cuadrado</span>`;
        } else {
            eq.innerHTML = `<span style="color:#dc2626;font-weight:700">❌ Descuadre: ${formatCurrency(diff)}</span>`;
        }
    }

    return { totalActivo, totalPasivo, totalPatrimonio, totalPyP };
}

function calcularFlujo() {
    const receipts = getElVal('cash-receipts');
    const payments = getElVal('cash-payments');
    const salaries = getElVal('cash-salaries');
    const financial = getElVal('cash-financial');
    const netFlow = receipts - (payments + salaries + financial);
    setText('net-cash-flow', formatCurrency(netFlow));
    return netFlow;
}

function calcularRatios() {
    const currentAssets = getElVal('caja') + getElVal('bancos') + getElVal('accounts-receivable') + getElVal('inventories') + getElVal('other-current-assets');
    const currentLiab = getElVal('accounts-payable') + getElVal('short-term-loans') + getElVal('other-current-liabilities') + getElVal('labor-liabilities');
    const ratioCorriente = currentLiab === 0 ? 0 : currentAssets / currentLiab;
    const ratioEl = document.getElementById('ratio-current');
    if (ratioEl) ratioEl.textContent = isFinite(ratioCorriente) ? ratioCorriente.toFixed(2) : '0.00';

    // Quick ratio (prueba ácida) = (CA - inventarios) / CL
    const quick = currentLiab === 0 ? 0 : (currentAssets - getElVal('inventories')) / currentLiab;
    const quickEl = document.getElementById('ratio-quick');
    if (quickEl) quickEl.textContent = isFinite(quick) ? quick.toFixed(2) : '0.00';

    const utilidadNeta = getElVal('net-income-balance');
    const patrimonio = getElVal('capital-social') + getElVal('reserves') + getElVal('retained-earnings');
    const roe = patrimonio === 0 ? 0 : utilidadNeta / patrimonio;
    const roeEl = document.getElementById('ratio-roe');
    if (roeEl) roeEl.textContent = isFinite(roe) ? (roe * 100).toFixed(2) + '%' : '0.00%';

    const ventasNetas = getElVal('ingresos-ventas') - getElVal('devoluciones-ventas');
    const margin = ventasNetas === 0 ? 0 : utilidadNeta / ventasNetas;
    const marginEl = document.getElementById('ratio-net-margin');
    if (marginEl) marginEl.textContent = isFinite(margin) ? (margin * 100).toFixed(2) + '%' : '0.00%';

    const roa = totalAssetsForROA();
    const roaVal = roa === 0 ? 0 : utilidadNeta / roa;
    const roaEl = document.getElementById('ratio-roa');
    if (roaEl) roaEl.textContent = isFinite(roaVal) ? (roaVal * 100).toFixed(2) + '%' : '0.00%';

    const debtEquity = patrimonio === 0 ? 0 : (getElVal('total-pasivo') || getElVal('total-pasivo-patrimonio')) / patrimonio;
    const deEl = document.getElementById('ratio-debt-equity');
    if (deEl) deEl.textContent = isFinite(debtEquity) ? debtEquity.toFixed(2) + 'x' : '0.00x';

    // quick dashboard KPIs
    const kpiCurrent = document.getElementById('kpi-current');
    if (kpiCurrent) kpiCurrent.textContent = isFinite(ratioCorriente) ? ratioCorriente.toFixed(2) : '0.00';
    const kpiEbitda = document.getElementById('kpi-ebitda');
    if (kpiEbitda) kpiEbitda.textContent = formatCurrency(getElVal('ebitda-display') || unformatCurrency(document.getElementById('ebitda-display')?.textContent || 0));
    const kpiRoe = document.getElementById('kpi-roe');
    if (kpiRoe) kpiRoe.textContent = isFinite(roe) ? (roe * 100).toFixed(2) + '%' : '0.00%';
}

// helper: attempt to compute "total assets" numeric for ROA
function totalAssetsForROA() {
    const taText = document.getElementById('total-activo')?.textContent || document.getElementById('total-activo')?.value;
    return unformatCurrency(taText);
}

/* ===========================
   Validation: negatives & alerts
   =========================== */

function validarDatos() {
    const items = [
        { id: 'total-activo', name: 'Total Activo' },
        { id: 'total-pasivo', name: 'Total Pasivo' },
        { id: 'total-patrimonio', name: 'Total Patrimonio' },
        { id: 'net-income-display', name: 'Utilidad Neta' }
    ];
    items.forEach(it => {
        const el = document.getElementById(it.id);
        if (!el) return;
        const val = unformatCurrency(el.textContent || el.value);
        if (val < 0) {
            el.style.color = 'red';
            el.title = `${it.name} es negativo: ${formatCurrency(val)}`;
        } else {
            el.style.color = '';
            el.title = '';
        }
    });
}

/* ===========================
   Recalc pipeline (debounced)
   =========================== */

let recalcTimer = null;
function recalcAllDebounced() {
    if (recalcTimer) clearTimeout(recalcTimer);
    recalcTimer = setTimeout(() => {
        recalcAll();
        recalcTimer = null;
    }, 200);
}

function recalcAll() {
    calcularResultados();
    calcularBalance();
    calcularFlujo();
    calcularRatios();
    validarDatos();
    updateCharts();
    saveToLocal(); // autosave after recalculation
}

/* ===========================
   LocalStorage & Periods
   =========================== */

function saveToLocal() {
    try {
        const inputs = document.querySelectorAll('input');
        const data = {};
        inputs.forEach(i => { if (i.id) data[i.id] = i.value; });
        const payload = { ts: Date.now(), data };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        // show timestamp
        const dateEl = document.getElementById('current-date');
        if (dateEl) dateEl.textContent = 'Última guardado: ' + new Date(payload.ts).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
        console.warn('Error saving to local', e);
    }
}

function loadFromLocal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
        const parsed = JSON.parse(raw);
        const data = parsed.data || {};
        Object.keys(data).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = data[id];
        });
        const dateEl = document.getElementById('current-date');
        if (dateEl) dateEl.textContent = 'Última guardado: ' + new Date(parsed.ts).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
        recalcAll();
        return true;
    } catch (e) {
        console.warn('Error loading local', e);
        return false;
    }
}

function clearLocal() {
    localStorage.removeItem(STORAGE_KEY);
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.textContent = 'Última guardado: --';
}

/* Save / Load by period (ej. 2025-09) */
function savePeriod(period) {
    const p = (period || '').trim();
    if (!p) { alert('Ingresa un periodo válido (ej. 2025-09)'); return; }
    const inputs = document.querySelectorAll('input');
    const data = {};
    inputs.forEach(i => { if (i.id) data[i.id] = i.value; });
    const payload = { ts: Date.now(), data };
    localStorage.setItem(`${STORAGE_KEY}_${p}`, JSON.stringify(payload));
    alert(`Guardado periodo ${p}`);
}

function loadPeriod(period) {
    const p = (period || '').trim();
    if (!p) { alert('Ingresa un periodo válido (ej. 2025-09)'); return; }
    const raw = localStorage.getItem(`${STORAGE_KEY}_${p}`);
    if (!raw) { alert(`No hay datos guardados para ${p}`); return; }
    const parsed = JSON.parse(raw);
    Object.entries(parsed.data || {}).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });
    recalcAll();
    alert(`Cargado periodo ${p}`);
}

/* ===========================
   Exports: Excel & PDF
   =========================== */

function exportToExcelAll() {
    if (typeof XLSX === 'undefined') { alert('Librería XLSX no disponible'); return; }
    const wb = XLSX.utils.book_new();

    // Balance sheet
    const balanceRows = [
        ['Concepto', 'Valor'],
        ['Total Activo', getElVal('total-activo')],
        ['Total Pasivo', getElVal('total-pasivo')],
        ['Total Patrimonio', getElVal('total-patrimonio')],
        ['Total Pasivo+Patrimonio', getElVal('total-pasivo-patrimonio')]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(balanceRows), 'Balance');

    // Resultados
    const erRows = [
        ['Concepto', 'Valor'],
        ['Ingresos por Ventas', getElVal('ingresos-ventas')],
        ['Devoluciones', getElVal('devoluciones-ventas')],
        ['Ventas Netas', unformatCurrency(document.getElementById('net-sales-display')?.textContent || 0)],
        ['Costo de Ventas', getElVal('cost-of-sales')],
        ['EBITDA', unformatCurrency(document.getElementById('ebitda-display')?.textContent || 0)],
        ['Utilidad Neta', getElVal('net-income-balance')]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(erRows), 'Resultados');

    // Flujo
    const flujoRows = [
        ['Concepto', 'Valor'],
        ['Cobros Clientes', getElVal('cash-receipts')],
        ['Pagos Proveedores', getElVal('cash-payments')],
        ['Pagos Sueldos', getElVal('cash-salaries')],
        ['Pagos Financieros', getElVal('cash-financial')],
        ['Flujo Neto', unformatCurrency(document.getElementById('net-cash-flow')?.textContent || 0)]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(flujoRows), 'Flujo');

    // Ratios
    const ratiosRows = [
        ['Concepto', 'Valor'],
        ['Ratio Corriente', document.getElementById('ratio-current')?.textContent || ''],
        ['Prueba Ácida', document.getElementById('ratio-quick')?.textContent || ''],
        ['ROE', document.getElementById('ratio-roe')?.textContent || ''],
        ['Margen Neto', document.getElementById('ratio-net-margin')?.textContent || ''],
        ['Deuda/Patrimonio', document.getElementById('ratio-debt-equity')?.textContent || '']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ratiosRows), 'Ratios');

    // Resumen
    const resumenRows = [
        ['Concepto', 'Valor'],
        ['Ingresos (Actual)', document.getElementById('summary-income-actual')?.textContent || ''],
        ['Costo Ventas (Actual)', document.getElementById('summary-cos-actual')?.textContent || ''],
        ['Utilidad Neta (Actual)', document.getElementById('summary-net-income-actual')?.textContent || '']
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumenRows), 'Resumen');

    XLSX.writeFile(wb, 'finanzas_completo.xlsx');
}

// PDF: export active section with header/logo and paginate if needed
async function exportToPDFActive() {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        alert('Librerías para PDF no cargadas');
        return;
    }

    // active visible section
    let active = Array.from(document.querySelectorAll('.section')).find(s => !s.classList.contains('hidden') && s.style.display !== 'none');
    if (!active) active = document.querySelector('.section');

    // clone node to render cleanly
    const clone = active.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.width = active.offsetWidth + 'px';
    document.body.appendChild(clone);

    const canvas = await html2canvas(clone, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // Header: try to load logo.png from same folder
    try {
        const logo = new Image();
        logo.src = 'logo.png';
        await new Promise(resolve => { logo.onload = resolve; logo.onerror = resolve; });
        if (logo.width) pdf.addImage(logo, 'PNG', 20, 18, 40, 40);
    } catch (e) { }

    pdf.setFontSize(14);
    pdf.text('FinPro X - Reporte Financiero', 70, 32);
    pdf.setFontSize(10);
    pdf.text(new Date().toLocaleString('es-MX'), 70, 48);

    // Content may be taller than a single page - split if necessary
    const imgProps = pdf.getImageProperties(imgData);
    const margin = 20;
    const availableW = pageW - margin * 2;
    const scale = availableW / imgProps.width;
    const renderedHeight = imgProps.height * scale;
    let remainingHeight = renderedHeight;
    const pageHeightWithoutHeaderFooter = pageH - 110; // header + footer space
    let yPosition = 70;

    // Draw first chunk and add pages if necessary using canvas slices
    // We'll draw the full image scaled; if taller than page, create slices using canvas
    if (renderedHeight <= pageHeightWithoutHeaderFooter) {
        pdf.addImage(imgData, 'PNG', margin, yPosition, availableW, renderedHeight);
    } else {
        // Create an offscreen canvas that contains the scaled image and draw page-sized slices
        const offCanvas = document.createElement('canvas');
        const offCtx = offCanvas.getContext('2d');
        offCanvas.width = imgProps.width;
        offCanvas.height = imgProps.height;
        const img = new Image();
        img.src = imgData;
        await new Promise(resolve => { img.onload = resolve; });

        offCtx.drawImage(img, 0, 0);

        // slice in source pixels based on scale and pageHeightWithoutHeaderFooter
        const srcPageHeight = Math.round(pageHeightWithoutHeaderFooter / scale);
        let srcY = 0;
        let pageIndex = 0;
        while (srcY < imgProps.height) {
            const sliceH = Math.min(srcPageHeight, imgProps.height - srcY);
            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = imgProps.width;
            sliceCanvas.height = sliceH;
            const sliceCtx = sliceCanvas.getContext('2d');
            sliceCtx.drawImage(offCanvas, 0, srcY, imgProps.width, sliceH, 0, 0, imgProps.width, sliceH);
            const sliceData = sliceCanvas.toDataURL('image/png');
            const drawH = sliceH * scale;

            if (pageIndex > 0) pdf.addPage();
            pdf.addImage(sliceData, 'PNG', margin, yPosition, availableW, drawH);

            srcY += sliceH;
            pageIndex++;
        }
    }

    // Footer & pagination
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.text('© FinPro X', margin, pageH - 18);
        pdf.text(`Página ${i} / ${pageCount}`, pageW - margin - 80, pageH - 18);
    }

    pdf.save(`finanzas_${(active.id || 'seccion')}.pdf`);

    document.body.removeChild(clone);
}

// Export a specific section element to PDF (used by per-section buttons)
async function exportSectionElementToPDF(sectionEl, filename) {
    if (!sectionEl) return;
    const clone = sectionEl.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.left = '-9999px';
    document.body.appendChild(clone);

    const canvas = await html2canvas(clone, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    pdf.setFontSize(12);
    pdf.text('FinPro X - Reporte', 20, 20);
    pdf.setFontSize(9);
    pdf.text(new Date().toLocaleString('es-MX'), 20, 34);

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const margin = 20;
    const ratio = Math.min((pageW - margin * 2) / imgProps.width, (pageH - 80) / imgProps.height);
    const w = imgProps.width * ratio;
    const h = imgProps.height * ratio;
    pdf.addImage(imgData, 'PNG', margin, 50, w, h);

    pdf.setFontSize(9);
    pdf.text('© FinPro X', 20, pageH - 18);
    pdf.text('Página 1 / 1', pageW - 80, pageH - 18);

    pdf.save(filename || `export_${(sectionEl.id || 'section')}.pdf`);
    document.body.removeChild(clone);
}

/* ===========================
   Import / Export JSON
   =========================== */

function exportJSON() {
    const inputs = document.querySelectorAll('input');
    const data = {};
    inputs.forEach(i => { if (i.id) data[i.id] = i.value; });
    const payload = { ts: Date.now(), data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finanzas_export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const parsed = JSON.parse(e.target.result);
            const data = parsed.data || parsed;
            Object.keys(data).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = data[id];
            });
            recalcAll();
            alert('JSON importado correctamente');
        } catch (err) {
            alert('Error importando JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
}

/* ===========================
   Charts (Chart.js)
   =========================== */

let chartRevenue = null;
let chartProfit = null;
let chartDebt = null;
let chartCosts = null;
let chartMargin = null;
let chartSummary = null;

function createCharts() {
    // Safe guard: if Chart not loaded, skip
    if (typeof Chart === 'undefined') return;

    // Revenue chart
    const ctxRev = document.getElementById('chart-revenue');
    if (ctxRev) {
        chartRevenue = new Chart(ctxRev, {
            type: 'line',
            data: {
                labels: ['-5', '-4', '-3', '-2', '-1', 'Actual'],
                datasets: [{ label: 'Ingresos', data: [0, 0, 0, 0, 0, getElVal('ingresos-ventas')], fill: true }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    }

    const ctxProfit = document.getElementById('chart-profit');
    if (ctxProfit) {
        chartProfit = new Chart(ctxProfit, {
            type: 'bar',
            data: { labels: ['-3', '-2', '-1', 'Actual'], datasets: [{ label: 'Utilidad', data: [0, 0, 0, getElVal('net-income-display')], backgroundColor: '#2563eb' }] },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    }

    const ctxDebt = document.getElementById('chart-debt');
    if (ctxDebt) {
        chartDebt = new Chart(ctxDebt, {
            type: 'doughnut',
            data: { labels: ['Deuda', 'Patrimonio'], datasets: [{ data: [getElVal('total-pasivo') || 0, getElVal('total-patrimonio') || 0], backgroundColor: ['#ef4444', '#10b981'] }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    const ctxCosts = document.getElementById('chart-costs');
    if (ctxCosts) {
        chartCosts = new Chart(ctxCosts, {
            type: 'pie',
            data: {
                labels: ['Costo Ventas', 'Gastos Oper', 'Gastos Fin'],
                datasets: [{ data: [getElVal('cost-of-sales'), (getElVal('gastos-personal') + getElVal('gastos-administracion') + getElVal('gastos-venta') + getElVal('otros-gastos-op')), getElVal('gastos-financieros')], backgroundColor: ['#2563eb', '#f59e0b', '#ef4444'] }]
            }
        });
    }

    const ctxMargin = document.getElementById('chart-margin');
    if (ctxMargin) {
        chartMargin = new Chart(ctxMargin, {
            type: 'line',
            data: { labels: ['-5', '-4', '-3', '-2', '-1', 'Actual'], datasets: [{ label: 'Margen Neto', data: [0, 0, 0, 0, 0, parseFloat((unformatCurrency(document.getElementById('ratio-net-margin')?.textContent || '0%') || 0))], fill: false }] },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    }

    const ctxSummary = document.getElementById('chart-summary');
    if (ctxSummary) {
        chartSummary = new Chart(ctxSummary, {
            type: 'bar',
            data: { labels: ['Ingresos', 'Costo', 'Utilidad'], datasets: [{ label: 'Montos', data: [getElVal('ingresos-ventas'), getElVal('cost-of-sales'), getElVal('net-income-display')], backgroundColor: ['#2563eb', '#ef4444', '#10b981'] }] },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    }
}

// Update charts with fresh values
function updateCharts() {
    // update revenue
    if (chartRevenue) {
        const ds = chartRevenue.data.datasets[0];
        ds.data = ds.data.slice(0, ds.data.length - 1).concat([getElVal('ingresos-ventas')]);
        chartRevenue.update('none');
    }
    if (chartProfit) {
        chartProfit.data.datasets[0].data = [0, 0, 0, getElVal('net-income-display')];
        chartProfit.update('none');
    }
    if (chartDebt) {
        chartDebt.data.datasets[0].data = [getElVal('total-pasivo'), getElVal('total-patrimonio')];
        chartDebt.update('none');
    }
    if (chartCosts) {
        chartCosts.data.datasets[0].data = [getElVal('cost-of-sales'), (getElVal('gastos-personal') + getElVal('gastos-administracion') + getElVal('gastos-venta') + getElVal('otros-gastos-op')), getElVal('gastos-financieros')];
        chartCosts.update('none');
    }
    if (chartMargin) {
        const marginNum = parseFloat((document.getElementById('ratio-net-margin')?.textContent || '0%').replace('%', '')) || 0;
        chartMargin.data.datasets[0].data = [0, 0, 0, 0, 0, marginNum];
        chartMargin.update('none');
    }
    if (chartSummary) {
        chartSummary.data.datasets[0].data = [getElVal('ingresos-ventas'), getElVal('cost-of-sales'), getElVal('net-income-display')];
        chartSummary.update('none');
    }

    // update small KPIs
    const kpiRevenueDiff = document.getElementById('kpi-revenue-diff');
    if (kpiRevenueDiff) {
        const actual = getElVal('ingresos-ventas');
        // As placeholder, compute diff vs cost-of-sales percent
        const budget = actual * 0.95;
        const pct = budget === 0 ? 0 : ((actual - budget) / budget) * 100;
        kpiRevenueDiff.textContent = `${pct.toFixed(1)}%`;
    }
    const kpiNetMargin = document.getElementById('kpi-net-margin');
    if (kpiNetMargin) kpiNetMargin.textContent = document.getElementById('ratio-net-margin')?.textContent || '0%';
    const kpiDebtEquity = document.getElementById('kpi-debt-equity');
    if (kpiDebtEquity) kpiDebtEquity.textContent = document.getElementById('ratio-debt-equity')?.textContent || '0x';
    // summary small numbers
    const sSales = document.getElementById('summary-sales');
    if (sSales) sSales.textContent = formatCurrency(getElVal('ingresos-ventas'));
    const sCos = document.getElementById('summary-cos');
    if (sCos) sCos.textContent = formatCurrency(getElVal('cost-of-sales'));
    const sNet = document.getElementById('summary-net');
    if (sNet) sNet.textContent = formatCurrency(getElVal('net-income-display'));
}

/* ===========================
   UI Helpers: input formatting & navigation
   =========================== */

function attachInputFormatting() {
    // Currency inputs: class .currency-input
    document.querySelectorAll('.currency-input').forEach(inp => {
        inp.addEventListener('input', recalcAllDebounced);
        inp.addEventListener('focus', (e) => {
            const v = unformatCurrency(e.target.value);
            e.target.value = v === 0 ? '' : v;
        });
        inp.addEventListener('blur', (e) => {
            const v = unformatCurrency(e.target.value);
            e.target.value = v === 0 ? '' : formatCurrency(v);
            recalcAllDebounced();
        });
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') e.target.blur();
        });
    });

    // non-currency inputs still trigger recalc
    document.querySelectorAll('input').forEach(inp => {
        if (!inp.classList.contains('currency-input')) {
            inp.addEventListener('input', recalcAllDebounced);
        }
    });
}

function initNavigation() {
    const links = Array.from(document.querySelectorAll('.nav-link'));
    const sections = Array.from(document.querySelectorAll('.section'));

    function showSection(id) {
        sections.forEach(s => {
            if (s.id === id) {
                s.classList.remove('hidden');
                s.style.display = 'block';
            } else {
                s.classList.add('hidden');
                s.style.display = 'none';
            }
        });
        links.forEach(l => l.classList.remove('bg-blue-50', 'text-blue-700', 'font-medium'));
        const active = links.find(l => l.dataset.target === id);
        if (active) active.classList.add('bg-blue-50', 'text-blue-700', 'font-medium');
        recalcAll();
    }

    links.forEach(l => {
        l.addEventListener('click', (ev) => {
            ev.preventDefault();
            const t = l.dataset.target;
            if (t) showSection(t);
        });
    });

    // default
    showSection('dashboard');
}

/* ===========================
   Wire Buttons & Actions
   =========================== */

function wireButtons() {
    // Top exports
    document.getElementById('export-excel')?.addEventListener('click', exportToExcelAll);
    document.getElementById('export-pdf')?.addEventListener('click', exportToPDFActive);
    document.getElementById('export-excel-2')?.addEventListener('click', exportToExcelAll);
    document.getElementById('export-pdf-2')?.addEventListener('click', exportToPDFActive);

    // Per-section export (buttons with class .export-section)
    document.querySelectorAll('.export-section').forEach(btn => {
        btn.addEventListener('click', async (ev) => {
            const section = btn.closest('.section') || Array.from(document.querySelectorAll('.section')).find(s => !s.classList.contains('hidden'));
            if (!section) { alert('No hay sección activa'); return; }
            await exportSectionElementToPDF(section, `finanzas_${section.id}.pdf`);
        });
    });

    // Reset / Demo / Clear
    document.getElementById('reset-data')?.addEventListener('click', () => {
        if (!confirm('¿Deseas reiniciar todos los datos y borrar el almacenamiento local?')) return;
        document.querySelectorAll('input').forEach(i => i.value = '');
        clearLocal();
        recalcAll();
    });

    document.getElementById('load-sample')?.addEventListener('click', () => {
        loadSampleData();
        saveToLocal();
    });

    document.getElementById('btn-clear-local')?.addEventListener('click', () => {
        if (!confirm('¿Borrar localStorage?')) return;
        clearLocal();
        alert('localStorage borrado. Recarga la página para estado limpio.');
    });

    document.getElementById('btn-clear-local-2')?.addEventListener('click', () => {
        if (!confirm('¿Borrar localStorage?')) return;
        clearLocal();
        alert('localStorage borrado. Recarga la página para estado limpio.');
    });

    // Save / Load period
    document.getElementById('btn-save-period')?.addEventListener('click', () => {
        const p = (document.getElementById('period-select')?.value || '').trim();
        savePeriod(p);
    });
    document.getElementById('btn-load-period')?.addEventListener('click', () => {
        const p = (document.getElementById('period-select')?.value || '').trim();
        loadPeriod(p);
    });

    // JSON import/export
    document.getElementById('btn-export-json')?.addEventListener('click', exportJSON);
    document.getElementById('btn-import-json')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) importJSON(file);
        };
        input.click();
    });
}

/* ===========================
   Sample demo data
   =========================== */

function loadSampleData() {
    const map = {
        caja: 120000,
        bancos: 350000,
        "accounts-receivable": 180000,
        inventories: 90000,
        "other-current-assets": 15000,
        ppe: 500000,
        intangibles: 80000,
        "other-non-current-assets": 20000,
        "accounts-payable": 95000,
        "short-term-loans": 40000,
        "labor-liabilities": 12000,
        "other-current-liabilities": 5000,
        "long-term-debt": 250000,
        "other-non-current-liabilities": 10000,
        "capital-social": 300000,
        reserves: 50000,
        "retained-earnings": 70000,

        "ingresos-ventas": 1200000,
        "devoluciones-ventas": 20000,
        "cost-of-sales": 600000,
        "gastos-personal": 100000,
        "gastos-administracion": 40000,
        "gastos-venta": 30000,
        "otros-gastos-op": 15000,
        "depreciacion-amortizacion": 20000,
        "gastos-financieros": 10000,
        impuestos: 50000,

        "cash-receipts": 400000,
        "cash-payments": 250000,
        "cash-salaries": 60000,
        "cash-financial": 8000
    };

    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = formatCurrency(val);
    });

    recalcAll();
}

/* ===========================
   Boot: init on DOMContentLoaded
   =========================== */

document.addEventListener('DOMContentLoaded', () => {
    // attach formatting
    attachInputFormatting();

    // charts (create charts first)
    createCharts();

    // wire nav & buttons
    initNavigation();
    wireButtons();

    // load local
    loadFromLocal();

    // initial recalc to populate all displays & charts
    recalcAll();

    // format any prefilled inputs that are currency inputs
    document.querySelectorAll('.currency-input').forEach(i => {
        if (i.value && i.value.trim() !== '') {
            const v = unformatCurrency(i.value);
            i.value = v === 0 ? '' : formatCurrency(v);
        }
    });
});
