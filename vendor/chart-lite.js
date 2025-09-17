
// Minimal chart replacement for offline use - draws a simple bar chart on a canvas.
// API: new SimpleChart(ctx, { labels: [], datasets: [{ label, data: [] }] })
// supports update() to redraw.
class SimpleChart {
  constructor(ctx, config){
    this.ctx = ctx;
    this.labels = (config && config.data && config.data.labels) || [];
    this.data = (config && config.data && config.data.datasets && config.data.datasets[0].data) || [];
    this.draw();
  }
  draw(){
    const ctx = this.ctx;
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0,0,w,h);
    const padding = 20;
    const max = Math.max(...this.data, 1);
    const barWidth = (w - padding*2) / Math.max(this.data.length,1) * 0.6;
    for(let i=0;i<this.data.length;i++){
      const val = this.data[i] || 0;
      const x = padding + i * ((w - padding*2) / Math.max(this.data.length,1)) + ((w - padding*2) / Math.max(this.data.length,1) - barWidth)/2;
      const barH = (val / max) * (h - padding*2);
      const y = h - padding - barH;
      ctx.fillStyle = '#10b981';
      ctx.fillRect(x, y, barWidth, barH);
      ctx.fillStyle = '#374151';
      ctx.font = Math.max(12, 12 * (window.devicePixelRatio || 1)) + 'px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.labels[i]||'', x + barWidth/2, h - 6);
    }
  }
  update(){
    this.draw();
  }
}
window.Chart = SimpleChart;
