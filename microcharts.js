/* MicroCharts: tiny line/bar charts (offline) */
export function toCurrency(n, locale = 'es-MX') {
  try {
    return n.toLocaleString(locale, { style: 'currency', currency: 'MXN' });
  } catch (e) {
    return '$' + (n || 0).toFixed(2);
  }
}

(function (global) {
  function defaultPalette(i) {
    const colors = [
      '#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#a78bfa', '#22c55e'
    ];
    return colors[i % colors.length];
  }

  function drawAxes(ctx, w, h, padding, textColor) {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, h - padding);
    ctx.lineTo(w - padding, h - padding);
    ctx.moveTo(padding, h - padding);
    ctx.lineTo(padding, padding);
    ctx.stroke();
    ctx.fillStyle = textColor;
  }

  function getBounds(datasets) {
    let min = Infinity, max = -Infinity;
    datasets.forEach(ds => {
      (ds.data || []).forEach(v => {
        if (v == null) return;
        min = Math.min(min, v);
        max = Math.max(max, v);
      });
    });
    if (!isFinite(min) || !isFinite(max)) {
      min = 0;
      max = 1;
    }
    if (min === max) {
      const pad = Math.abs(min) || 1;
      min -= pad;
      max += pad;
    }
    return { min, max };
  }

  class MicroChart {
    constructor(canvas, config) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.type = config.type || 'line';
      this.data = config.data || { labels: [], datasets: [] };
      this.options = config.options || {};
      this.redraw();
    }
    update() {
      this.redraw();
    }
    clear() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    redraw() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      this.clear();
      const padding = 36;
      const isDark = document.body.classList.contains('dark-mode');
      const textColor = isDark ? '#f1f5f9' : '#1e293b';

      drawAxes(ctx, w, h, padding, textColor);

      const { min, max } = getBounds(this.data.datasets);
      const range = max - min || 1;
      const count = (this.data.labels || []).length || 1;

      const xStep = (w - padding * 2) / Math.max(1, count - 1);
      const yScale = (h - padding * 2) / range;

      // X labels (sparse)
      ctx.fillStyle = textColor;
      ctx.font = '12px system-ui';
      const step = Math.ceil(count / 6);
      for (let i = 0; i < count; i += step) {
        const x = padding + i * xStep;
        ctx.fillText(String(this.data.labels[i] || ''), x - 8, h - padding + 16);
      }

      // Y labels (min/mid/max)
      ctx.fillText(String(max.toFixed(0)), 6, padding + 4);
      ctx.fillText(String(((min + max) / 2).toFixed(0)), 6, h / 2);
      ctx.fillText(String(min.toFixed(0)), 6, h - padding);

      this.data.datasets.forEach((ds, idx) => {
        const color = ds.color || defaultPalette(idx);
        if (this.type === 'line') {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < count; i++) {
            const v = ds.data[i] ?? null;
            const x = padding + i * xStep;
            const y = h - padding - ((v - min) * yScale);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else if (this.type === 'bar') {
          const barW = (w - padding * 2) / (count * (this.data.datasets.length + 1));
          ctx.fillStyle = color;
          for (let i = 0; i < count; i++) {
            const v = ds.data[i] ?? 0;
            const x = padding + (i * (this.data.datasets.length) + idx) * barW + i * barW;
            const y = h - padding - ((v - min) * yScale);
            const height = (h - padding) - y;
            ctx.fillRect(x, y, barW * 0.9, Math.max(1, height));
          }
        }
      });
    }
  }

  global.MicroChart = MicroChart;
})(window);