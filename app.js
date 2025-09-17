/*
* app.js — Financiero Pro X
* - Cálculos: Balance / Resultados / Flujo / Ratios
* - Export CSV/XLSX
* - Preview PDF con portada
* - IndexedDB (plantillas)
* - Menú móvil + hooks de impresión
*/

/* ---------- Helpers ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const MONEDA = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 });

function toNumber(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  v = String(v).trim();
  v = v.replace(/[^\d\-,.]/g, '');
  if (v.indexOf(",") > -1 && v.indexOf(".") === -1) v = v.replace(/,/g, ".");
  else v = v.replace(/,/g, "");
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
function formatMoneyValue(x) { return MONEDA.format(x || 0); }
function formatPercentage(x) { return `${(x || 0).toFixed(2)}%`; }

/* ---------- DB Service (IndexedDB) ---------- */
const DBService = (() => {
  const DB_NAME = "FinProX_TEMPLATES_DB";
  const STORE = "templates";
  let db = null;

  function init() {
    return new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "name" });
        };
        req.onsuccess = e => { db = e.target.result; resolve(); };
        req.onerror = e => reject(e);
      } catch (err) { reject(err); }
    });
  }

  function put(name, data) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error("DB no inicializada"));
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ name, data, updated: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = e => reject(e);
    });
  }

  function get(name) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error("DB no inicializada"));
      const tx = db.transaction(STORE, "readonly");
      const rq = tx.objectStore(STORE).get(name);
      rq.onsuccess = () => resolve(rq.result ? rq.result.data : null);
      rq.onerror = e => reject(e);
    });
  }

  function all() {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error("DB no inicializada"));
      const tx = db.transaction(STORE, "readonly");
      const rq = tx.objectStore(STORE).getAll();
      rq.onsuccess = () => resolve(rq.result || []);
      rq.onerror = e => reject(e);
    });
  }

  return { init, put, get, all };
})();

/* ---------- App engine ---------- */
const App = (() => {
  const state = { inputs: {}, results: { balance: {}, income: {}, cashflow: {}, ratios: {} } };
  const E = {};
  let chart = null;

  function bind() {
    E.navButtons = $$(".nav-btn");
    E.tabs = $$(".tab-section");
    E.themeToggle = $("#theme-toggle");
    E.metaFecha = $("#meta-fecha");

    // Elementos de resultados
    E.totalActivo = $("#total-activo");
    E.totalPasivo = $("#total-pasivo");
    E.resVentasNetas = $("#res_ventas_netas");
    E.resUtilidadBruta = $("#res_utilidad_bruta");
    E.resEbit = $("#res_ebit");
    E.resEbt = $("#res_ebt");
    E.resUtilidadNeta = $("#res_neta");
    E.flujoTotal = $("#flujo_total");
    E.kpiVentas = $("#r-ventas");
    E.kpiNeta = $("#r-neta");
    E.kpiChart = $("#kpiChart");

    E.balanceActivosCorr = $("#balance_activos_corr");
    E.balanceActivosNo = $("#balance_activos_no");
    E.balancePasivosCorr = $("#balance_pasivos_corr");
    E.balancePasivosNo = $("#balance_pasivos_no");
    E.balancePatrimonio = $("#balance_patrimonio");
    E.resCogsTotal = $("#res_cogs_total");
    E.resGastosOperativos = $("#res_gastos_operativos");
    E.resEbitda = $("#res_ebitda");
    E.resInteresesIsr = $("#res_intereses_isr");
    E.flujoOpe = $("#flujo_ope");
    E.flujoInv = $("#flujo_inv");
    E.flujoFin = $("#flujo_fin");
    E.ratioLiquidez = $("#ratio-liquidez");
    E.ratioEndeudamiento = $("#ratio-endeudamiento");
    E.ratioRentabilidad = $("#ratio-rentabilidad");

    // Botones
    E.btnPreview = $("#btn-preview");
    E.btnExportCSV = $("#btn-export-csv");
    E.btnExportXLSX = $("#btn-export-xlsx");
    E.btnClear = $("#btn-clear");
    E.btnUpdate = $("#btn-update");
    E.btnSaveTemplate = $("#btn-save-template");
    E.btnLoadTemplate = $("#btn-load-template");

    E.allInputs = $$(".input-balance");
  }

  function switchTab(key) {
    E.tabs.forEach(t => t.id === `tab-${key}` ? t.classList.remove("hidden") : t.classList.add("hidden"));
    E.navButtons.forEach(b => b.classList.remove("active"));
    const btn = document.querySelector(`.nav-btn[data-tab="${key}"]`);
    if (btn) btn.classList.add("active");
  }

  function bindTabs() {
    E.navButtons.forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.preventDefault();
        switchTab(btn.dataset.tab);
        document.body.classList.remove('sidebar-open');
        $("#mobile-overlay")?.classList.add('hidden');
      });
    });
    const first = E.navButtons[0]?.dataset?.tab || "dashboard";
    switchTab(first);
  }

  function applySavedTheme() {
    const s = localStorage.getItem("finprox_theme");
    if (s === "light") document.documentElement.classList.remove("dark");
    else document.documentElement.classList.add("dark");
  }

  function initChart() {
    const canvas = E.kpiChart;
    if (!canvas) return;
    canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
    canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);

    if (window.Chart && typeof Chart === "function") {
      const chartData = {
        labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
        datasets: [
          { label: "Ventas Netas", data: Array(12).fill(0), borderColor: "var(--accent-2)", backgroundColor: "rgba(37,99,235,0.08)", fill: true, tension: 0.2 },
          { label: "Utilidad Neta", data: Array(12).fill(0), borderColor: "var(--accent-3)", backgroundColor: "rgba(16,185,129,0.06)", fill: true, tension: 0.2 }
        ]
      };
      const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) label += formatMoneyValue(context.parsed.y);
                return label;
              }
            }
          }
        }
      };

      chart = new Chart(canvas, { type: 'line', data: chartData, options: chartOptions });
    } else {
      try { chart = new Chart(canvas, { type: 'bar', data: { labels: ["Activos", "Pasivos", "Ventas", "Gastos"], datasets: [{ data: [0, 0, 0, 0] }] } }); }
      catch (e) { chart = null; console.warn("Gráfica fallback:", e); }
    }
  }

  function updateChartWith(results) {
    if (!chart) return;
    const vals = [results.balance?.total_activos || 0, results.balance?.total_pasivo || 0, results.income?.ventas_netas || 0, results.income?.gastos_operativos || 0];
    const rNeta = results.income?.utilidad_neta || 0;
    const rVentas = results.income?.ventas_netas || 0;

    try {
      if (chart.config) {
        if (chart.config.type === 'line') {
          // Actualiza la gráfica de línea con datos del año (ejemplo)
          chart.data.datasets[0].data = Array(12).fill(rVentas / 12);
          chart.data.datasets[1].data = Array(12).fill(rNeta / 12);
        } else {
          chart.data.datasets[0].data = vals;
        }
        chart.update();
      } else if (typeof chart.update === "function") {
        chart.values = vals;
        chart.update();
      }
    } catch (e) { console.warn("updateChart err", e); }
  }

  function captureInputs() {
    E.allInputs.forEach(i => state.inputs[i.id] = i.value);
  }

  function calcularBalance() {
    const activos_circulantes = ["act_caja", "act_bancos", "act_cxc", "act_inventario", "act_otros_corr"].map(id => toNumber(state.inputs[id])).reduce((a, b) => a + b, 0);
    const activos_no_circulantes = ["act_terrenos", "act_mobiliario", "act_depre_mob", "act_trans", "act_depre_trans"].map(id => toNumber(state.inputs[id])).reduce((a, b) => a + b, 0);
    const total_activos = activos_circulantes + activos_no_circulantes;

    const pasivos_circulantes = ["pas_cxp", "pas_isr", "pas_prest_corto"].map(id => toNumber(state.inputs[id])).reduce((a, b) => a + b, 0);
    const pasivos_no_circulantes = ["pas_prest_largo", "pas_otros_no_corr"].map(id => toNumber(state.inputs[id])).reduce((a, b) => a + b, 0);
    const patrimonio = ["pat_capital", "pat_reservas", "pat_utilidad"].map(id => toNumber(state.inputs[id])).reduce((a, b) => a + b, 0);
    const total_pasivo = pasivos_circulantes + pasivos_no_circulantes + patrimonio;

    return {
      activos_circulantes, activos_no_circulantes, total_activos,
      pasivos_circulantes, pasivos_no_circulantes, patrimonio, total_pasivo
    };
  }

  function calcularResultados() {
    const ventas = toNumber(state.inputs["res_ventas"]);
    const devol = toNumber(state.inputs["res_devol"]);
    const ventas_netas = ventas - devol;

    const cogs = toNumber(state.inputs["res_cogs"]);
    const utilidad_bruta = ventas_netas - cogs;

    const gastos_operativos = ["res_gasto_ventas", "res_marketing", "res_sueldos_admin", "res_renta", "res_servpub", "res_depre"].map(id => toNumber(state.inputs[id])).reduce((a, b) => a + b, 0);

    const ebit = utilidad_bruta - gastos_operativos;
    const ebitda = ebit + toNumber(state.inputs["res_depre"]);

    const otros_ing_gastos = toNumber(state.inputs["res_otros"]);
    const intereses = toNumber(state.inputs["res_intereses"]);
    const isr = toNumber(state.inputs["res_isr"]);

    const ebt = ebit + otros_ing_gastos - intereses;
    const utilidad_neta = ebt - isr;

    return {
      ventas_netas, cogs, utilidad_bruta, gastos_operativos, ebit, ebitda, ebt, utilidad_neta,
      intereses_isr: intereses + isr
    };
  }

  function calcularFlujo(utilidadNeta) {
    const ope = utilidadNeta + toNumber(state.inputs["flujo_depre"]) + toNumber(state.inputs["flujo_captrabajo"]);
    const inv = toNumber(state.inputs["flujo_inversiones"]) + toNumber(state.inputs["flujo_activos"]);
    const fin = toNumber(state.inputs["flujo_deuda"]) - toNumber(state.inputs["flujo_dividendos"]);
    const total = ope - inv + fin;
    return { ope, inv, fin, total };
  }

  function calcularRatios(b, i) {
    const liquidez = b.pasivos_circulantes === 0 ? Infinity : b.activos_circulantes / b.pasivos_circulantes;
    const endeudamiento = b.total_activos === 0 ? 0 : (b.pasivos_circulantes + b.pasivos_no_circulantes) / b.total_activos;
    const rentabilidad = i.ventas_netas === 0 ? 0 : (i.utilidad_neta / i.ventas_netas) * 100;
    return { liquidez, endeudamiento, rentabilidad };
  }

  function renderAll() {
    const { balance, income, cashflow, ratios } = state.results;

    // Dashboard
    if (E.totalActivo) E.totalActivo.textContent = formatMoneyValue(balance.total_activos);
    if (E.totalPasivo) E.totalPasivo.textContent = formatMoneyValue(balance.total_pasivo);
    if (E.resVentasNetas) E.resVentasNetas.textContent = formatMoneyValue(income.ventas_netas);
    if (E.resUtilidadNeta) E.resUtilidadNeta.textContent = formatMoneyValue(income.utilidad_neta);
    if (E.flujoTotal) E.flujoTotal.textContent = formatMoneyValue(cashflow.total);
    if (E.kpiVentas) E.kpiVentas.textContent = formatMoneyValue(income.ventas_netas);
    if (E.kpiNeta) E.kpiNeta.textContent = formatMoneyValue(income.utilidad_neta);
    if (E.ratioRentabilidad) E.ratioRentabilidad.textContent = formatPercentage(ratios.rentabilidad);
    updateChartWith(state.results);

    // Balance
    if (E.balanceActivosCorr) E.balanceActivosCorr.textContent = formatMoneyValue(balance.activos_circulantes);
    if (E.balanceActivosNo) E.balanceActivosNo.textContent = formatMoneyValue(balance.activos_no_circulantes);
    if (E.balancePasivosCorr) E.balancePasivosCorr.textContent = formatMoneyValue(balance.pasivos_circulantes);
    if (E.balancePasivosNo) E.balancePasivosNo.textContent = formatMoneyValue(balance.pasivos_no_circulantes);
    if (E.balancePatrimonio) E.balancePatrimonio.textContent = formatMoneyValue(balance.patrimonio);

    // Resultados
    if (E.resCogsTotal) E.resCogsTotal.textContent = formatMoneyValue(income.cogs);
    if (E.resUtilidadBruta) E.resUtilidadBruta.textContent = formatMoneyValue(income.utilidad_bruta);
    if (E.resGastosOperativos) E.resGastosOperativos.textContent = formatMoneyValue(income.gastos_operativos);
    if (E.resEbit) E.resEbit.textContent = formatMoneyValue(income.ebit);
    if (E.resEbitda) E.resEbitda.textContent = formatMoneyValue(income.ebitda);
    if (E.resInteresesIsr) E.resInteresesIsr.textContent = formatMoneyValue(income.intereses_isr);

    // Flujo
    if (E.flujoOpe) E.flujoOpe.textContent = formatMoneyValue(cashflow.ope);
    if (E.flujoInv) E.flujoInv.textContent = formatMoneyValue(cashflow.inv);
    if (E.flujoFin) E.flujoFin.textContent = formatMoneyValue(cashflow.fin);

    // Ratios
    if (E.ratioLiquidez) E.ratioLiquidez.textContent = ratios.liquidez.toFixed(2);
    if (E.ratioEndeudamiento) E.ratioEndeudamiento.textContent = ratios.endeudamiento.toFixed(2);
    if (E.ratioRentabilidad) E.ratioRentabilidad.textContent = formatPercentage(ratios.rentabilidad);

    // auto-fill utilidad en patrimonio si existe
    const pat = $("#pat_utilidad");
    if (pat) pat.value = income.utilidad_neta ? formatMoneyValue(income.utilidad_neta) : "";
  }

  function calculateAllAndRender() {
    captureInputs();
    const balance = calcularBalance();
    const income = calcularResultados();
    const cashflow = calcularFlujo(income.utilidad_neta);
    const ratios = calcularRatios(balance, income);
    state.results = { balance, income, cashflow, ratios };
    renderAll();
    return state.results;
  }

  async function saveTemplate() {
    const templateName = prompt("Ingresa un nombre para tu plantilla:");
    if (!templateName) return;
    const data = {};
    E.allInputs.forEach(i => data[i.id] = toNumber(i.value));
    try {
      await DBService.put(templateName, data);
      alert(`Plantilla "${templateName}" guardada con éxito.`);
    } catch (e) {
      console.error("Error al guardar:", e);
      alert("Hubo un error al guardar la plantilla.");
    }
  }

  async function loadTemplate() {
    try {
      const templates = await DBService.all();
      if (templates.length === 0) {
        alert("No hay plantillas guardadas.");
        return;
      }
      const names = templates.map(t => t.name).join(", ");
      const templateName = prompt(`Plantillas disponibles: ${names}\nIngresa el nombre de la plantilla a cargar:`);
      if (!templateName) return;

      const template = await DBService.get(templateName);
      if (template) {
        for (const id in template) {
          const input = $(`#${id}`);
          if (input) input.value = formatMoneyValue(template[id]);
        }
        calculateAllAndRender();
        alert(`Plantilla "${templateName}" cargada con éxito.`);
      } else {
        alert(`No se encontró la plantilla con nombre "${templateName}".`);
      }
    } catch (e) {
      console.error("Error al cargar:", e);
      alert("Hubo un error al cargar la plantilla.");
    }
  }

  function exportCSV() {
    const rows = [["Campo", "Valor"]];
    E.allInputs.forEach(i => rows.push([i.id, toNumber(i.value)]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "finanzas_prox.csv"; document.body.appendChild(a); a.click(); a.remove();
  }

  function exportXLSX() {
    if (typeof XLSX === "undefined") { exportCSV(); return; }
    const rows = [["Campo", "Valor"]];
    E.allInputs.forEach(i => rows.push([i.id, toNumber(i.value)]));
    const ws = XLSX.utils.aoa_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Datos"); XLSX.writeFile(wb, "finanzas_prox.xlsx");
  }

  function previewPDF() {
    const now = new Date(); const dateStr = now.toLocaleString("es-MX");
    const contentHTML = document.querySelector('.content')?.innerHTML || "<div>No hay contenido</div>";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Reporte — Financiero Pro X</title>
          <style>
            @page{margin:20mm}
            body{font-family:Inter,Arial;color:#111;margin:0}
            .cover{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;height:100vh;padding:60px;background:linear-gradient(180deg,#fff,#f3f7ff)}
            .brand{font-weight:900;font-size:32px;color:#0f172a}
            .subtitle{color:#4b5563;margin-top:8px}
            .membrete{margin-top:40px;border-top:2px solid #06b6d4;padding-top:12px;color:#0f172a;font-weight:700}
            header.fixed{position:fixed;left:0;right:0;top:0;height:72px;display:flex;align-items:center;justify-content:space-between;padding:12px 24px;border-bottom:1px solid #e5e7eb;background:#fff}
            footer.fixed{position:fixed;left:0;right:0;bottom:0;height:34px;display:flex;align-items:center;justify-content:space-between;padding:8px 24px;border-top:1px solid #e5e7eb;background:#fff;font-size:12px;color:#6b7280}
            .page{page-break-after:always;padding:24px}
            .report-content{max-width:100%;margin-top:18px;color:#111827}
            .pagenum:after{content:counter(page)}
            @media print{header.fixed,footer.fixed{position:fixed}}
          </style></head><body>
          <div class="cover"><div class="brand">Financiero Pro X</div><div class="subtitle">Reporte Financiero Ejecutivo</div><div class="membrete">Agronare · Reporte Oficial — Generado: ${dateStr}</div></div>
          <header class="fixed"><div style="font-weight:700">Financiero Pro X — Reporte</div><div style="color:#6b7280">${dateStr}</div></header>
          <div class="page report-content">${contentHTML}</div>
          <footer class="fixed"><div>Financiero Pro X</div><div>Página <span class="pagenum"></span></div></footer>
          <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script>
        </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Pop-ups bloqueados: permite ventanas emergentes para previsualizar el PDF."); return; }
    w.document.write(html); w.document.close();
  }

  async function init() {
    bind(); applySavedTheme(); bindTabs(); initChart();
    if (E.metaFecha) E.metaFecha.textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Mobile menu
    $("#mobile-menu-btn")?.addEventListener('click', () => {
      const open = document.body.classList.toggle('sidebar-open');
      $("#mobile-overlay")?.classList.toggle('hidden', !open);
      $("#mobile-menu-btn")?.setAttribute('aria-expanded', open ? "true" : "false");
    });
    $("#mobile-overlay")?.addEventListener('click', () => { document.body.classList.remove('sidebar-open'); $("#mobile-overlay")?.classList.add('hidden'); });

    // Buttons
    E.navButtons.forEach(b => b.addEventListener('keydown', e => { if (e.key === 'Enter') b.click(); }));
    if (E.themeToggle) E.themeToggle.addEventListener('click', () => { const now = !document.documentElement.classList.contains('dark'); document.documentElement.classList.toggle('dark', now); localStorage.setItem('finprox_theme', now ? "dark" : "light"); });
    E.btnClear?.addEventListener('click', () => { E.allInputs.forEach(i => i.value = ""); calculateAllAndRender(); });
    E.btnUpdate?.addEventListener('click', () => calculateAllAndRender());
    E.btnPreview?.addEventListener('click', previewPDF);
    E.btnExportCSV?.addEventListener('click', exportCSV);
    E.btnExportXLSX?.addEventListener('click', exportXLSX);
    E.btnSaveTemplate?.addEventListener('click', saveTemplate);
    E.btnLoadTemplate?.addEventListener('click', loadTemplate);


    // Inputs behaviour (unformat on focus, format on blur)
    E.allInputs.forEach(inp => {
      inp.addEventListener('focus', e => {
        const raw = String(e.target.value || "").replace(/[^\d\-\.,]/g, "");
        e.target.value = raw;
      });
      inp.addEventListener('blur', e => {
        const v = toNumber(e.target.value);
        e.target.value = v === 0 ? "" : formatMoneyValue(v);
        calculateAllAndRender();
      });
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); ev.currentTarget.blur(); } });
    });

    try { await DBService.init(); } catch (err) { console.warn("IndexedDB init failed:", err); }

    mobileAndPrintEnhancements();
    calculateAllAndRender();
    console.log("App initialized (Financiero Pro X)");
  }

  return { init, calculateAllAndRender, DB: DBService };
})();

/* ---------- Mobile & Print helpers ---------- */
function mobileAndPrintEnhancements() {
  function beforePrint() {
    if (!document.querySelector('.print-header')) {
      const ph = document.createElement('div');
      ph.className = 'print-header';
      ph.innerHTML = `<div style="font-weight:700">Financiero Pro X</div><div>${new Date().toLocaleString()}</div>`;
      document.body.appendChild(ph);
    }
    if (!document.querySelector('.print-footer')) {
      const pf = document.createElement('div');
      pf.className = 'print-footer';
      pf.innerHTML = `<div>Financiero Pro X</div><div>Página <span class="pagenum"></span></div>`;
      document.body.appendChild(pf);
    }
    document.body.classList.add('printing');
  }
  function afterPrint() {
    document.body.classList.remove('printing');
    document.querySelector('.print-header')?.remove();
    document.querySelector('.print-footer')?.remove();
  }

  if (window.matchMedia) {
    try {
      const mql = window.matchMedia('print');
      if (mql.addEventListener) mql.addEventListener('change', e => e.matches ? beforePrint() : afterPrint());
      else if (mql.addListener) mql.addListener(m => m.matches ? beforePrint() : afterPrint());
    } catch (e) { /* ignore */ }
  }
  window.addEventListener('beforeprint', beforePrint);
  window.addEventListener('afterprint', afterPrint);

  // escape key closes mobile
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) { document.body.classList.remove('sidebar-open'); $("#mobile-overlay")?.classList.add('hidden'); } });
  window.addEventListener('resize', () => { if (window.innerWidth > 820) { document.body.classList.remove('sidebar-open'); $("#mobile-overlay")?.classList.add('hidden'); } });
}

/* ---------- Start ---------- */
document.addEventListener('DOMContentLoaded', () => App.init());