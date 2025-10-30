import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useChartData, CandleData, ChartOptions } from '../hooks/useChartData';
import { RefreshCw, TrendingUp, TrendingDown, BarChart3, Settings } from 'lucide-react';
import { formatPriceRaw } from '../utils/formatters';

const INTERVAL_MS: Record<ChartOptions['interval'], number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
};

const WS_URL = (import.meta as any).env?.VITE_WS_URL || 'ws://localhost:3001';

export interface Candle {
  timestamp: number;
  date?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  tradeCount?: number;
}

interface TechanChartProps {
  agentAddress: string;
  height?: number;
  showVolume?: boolean;
  showIndicators?: boolean;
  onPriceUpdate?: (price: number) => void;
}

const TechanChart: React.FC<TechanChartProps> = ({
  agentAddress,
  height = 400,
  showVolume = true,
  showIndicators = true,
  onPriceUpdate
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [chartOptions, setChartOptions] = useState<ChartOptions>({
    interval: '1m',
    limit: 100,
    autoUpdate: true,
    enableRealTime: true
  });

  const [showSettings, setShowSettings] = useState(false);

  // --- DEBUG LOGS (mount/render takibi)
  useEffect(() => {
    console.log('[TechanChart] mounted');
    return () => console.log('[TechanChart] unmounted');
  }, []);
  console.log('[TechanChart] render — interval:', chartOptions.interval);

  const {
    candles,
    trades,
    loading,
    error,
    lastUpdate,
    refresh,
    isRealTime,
    connectionStatus,
    livePrice
  } = useChartData(agentAddress, chartOptions);

  /** Trades -> OHLC (tek mum/bucket) */
  function buildOHLCFromTrades(
    trades: Array<{ timestamp: number; price: number; qty?: number; side?: 'buy'|'sell' }>,
    intervalMs: number
  ): CandleData[] {
    if (!trades?.length) return [];

    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const buckets = new Map<number, CandleData & { buyVolume?: number; sellVolume?: number }>();

    for (const tr of sorted) {
      const p = Number(tr.price);
      if (!Number.isFinite(p) || p <= 0) continue; // bozuk/0 fiyatları at

      const t0 = Math.floor(tr.timestamp / intervalMs) * intervalMs;
      let c = buckets.get(t0);
      if (!c) {
        c = { date: new Date(t0), open: p, high: p, low: p, close: p, volume: 0 };
        buckets.set(t0, c);
      }
      c.high = Math.max(c.high, p);
      c.low  = Math.min(c.low, p);
      c.close = p;

      const q = Number.isFinite(tr.qty as number) ? (tr.qty as number) : 0;
      c.volume = (c.volume ?? 0) + q;
      if (tr.side === 'buy')  (c as any).buyVolume  = ((c as any).buyVolume  ?? 0) + q;
      if (tr.side === 'sell') (c as any).sellVolume = ((c as any).sellVolume ?? 0) + q;
    }

    // gaps
    const keys = Array.from(buckets.keys()).sort((a, b) => a - b);
    const filled: CandleData[] = [];
    for (let i = 0; i < keys.length; i++) {
      const t = keys[i];
      const c = buckets.get(t)!;
      filled.push(c);
      if (i < keys.length - 1) {
        const next = keys[i + 1];
        for (let tt = t + intervalMs; tt < next; tt += intervalMs) {
          const prev = filled[filled.length - 1];
          filled.push({
            date: new Date(tt),
            open: prev.close,
            high: prev.close,
            low:  prev.close,
            close: prev.close,
            volume: 0,
          });
        }
      }
    }
    return filled;
  }

  // WS: trade olunca yenile
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg?.type === 'realTradeExecuted' &&
            msg?.agentAddress?.toLowerCase() === agentAddress.toLowerCase()) {
          refresh();
        }
      } catch {}
    };
    return () => ws.close();
  }, [agentAddress, refresh]);

  const width = 800;

  // ÇİZİM
  useEffect(() => {
    if (!chartRef.current) return;

    // 1) Her ihtimale karşı TV Lightweight Charts kalıntılarını temizle
    Array.from(
      chartRef.current.querySelectorAll('canvas, .tv-lightweight-charts, .tv-lightweight-charts-container')
    ).forEach((el) => el.remove());

    // 2) Daha önce çizilmiş svg varsa sil
    d3.select(chartRef.current).selectAll('*').remove();

    // 3) Yeni svg oluştur
    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    svgRef.current = svg.node();

    // --- Veriyi hazırla
    const intervalMs = INTERVAL_MS[chartOptions.interval];
    const render: CandleData[] = buildOHLCFromTrades(trades as any, intervalMs);
    if (render.length === 0) return;

    // --- X ölçeği
    const minDate = render[0].date;
    const maxDate = render[render.length - 1].date;
    const spanMs = Math.max(60_000, maxDate.getTime() - minDate.getTime());
    const pad = spanMs * 0.05;

    const margin = { top: 20, right: 90, bottom: 30, left: 60 };

    const xScale = d3.scaleTime()
      .domain([new Date(minDate.getTime() - pad), new Date(maxDate.getTime() + pad)])
      .range([margin.left, width - margin.right]);

    // --- Y ölçeği (log/linear seçimi)
    const positive = render.filter(d => d.open > 0 && d.high > 0 && d.low > 0 && d.close > 0);
    if (positive.length === 0) return;

    const yMinRaw = d3.min(positive, d => Math.min(d.low, d.open, d.close))!;
    const yMaxRaw = d3.max(positive, d => Math.max(d.high, d.open, d.close))!;
    const useLog = (yMaxRaw / yMinRaw) > 5 && yMinRaw > 0;

    const yScale = (useLog ? d3.scaleLog() : d3.scaleLinear())
      .domain([Math.max(yMinRaw * 0.9, 1e-9), yMaxRaw * 1.1])
      .range([height - margin.bottom, margin.top])
      .clamp(true);

    // --- Mum genişliği
    const oneStep =
      (xScale(new Date(render[0].date.getTime() + intervalMs)) as number) -
      (xScale(render[0].date) as number);
    const widthByInterval = Math.max(2, Math.abs(oneStep) * 0.7);

    let minDx = Infinity;
    for (let i = 1; i < render.length; i++) {
      const prevX = xScale(render[i - 1].date) as number;
      const curX  = xScale(render[i].date) as number;
      minDx = Math.min(minDx, Math.abs(curX - prevX));
    }
    if (!Number.isFinite(minDx)) {
      minDx = (width - margin.left - margin.right) * 0.02;
    }
    const candleWidth = Math.max(2, Math.min(widthByInterval, minDx * 0.8));

    // --- Eksenler
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickFormat((d: any) => d3.timeFormat('%H:%M')(d as Date)))
      .selectAll('text').style('fill', '#a0a0a0');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).tickFormat((d: any) =>
        d < 0.0001 ? d3.format('.1e')(d as number) : (d as number).toFixed(12)
      ))
      .selectAll('text').style('fill', '#a0a0a0');

    // --- Mumlar
    const gCandles = svg.append('g').attr('class', 'candles');

    render.forEach((d) => {
      const x = (xScale(d.date) as number) ?? 0;

      // fitil
      const group = gCandles.append('g').attr('class', 'candle');
      group.append('line')
        .attr('x1', x).attr('x2', x)
        .attr('y1', (yScale(d.high) as number) ?? 0)
        .attr('y2', (yScale(d.low) as number) ?? 0)
        .attr('stroke', '#9aa3ad')
        .attr('stroke-width', 1);

      // ana gövde
      const baseColor = (d.close >= d.open) ? '#00ff88' : '#ff4757';
      const baseTop    = yScale(Math.max(d.open, d.close)) as number;
      const baseBottom = yScale(Math.min(d.open, d.close)) as number;
      const baseHeight = Math.max(1, Math.abs(baseBottom - baseTop));
      group.append('rect')
        .attr('x', x - candleWidth / 2)
        .attr('y', baseTop)
        .attr('width', candleWidth)
        .attr('height', baseHeight)
        .attr('fill', baseColor)
        .attr('opacity', 0.9);

      // tepe geri çekilmesi (kırmızı blok)
      const cutoff = Math.max(d.open, d.close);
      if (d.high > cutoff) {
        const retrTop    = yScale(d.high) as number;
        const retrBottom = yScale(cutoff) as number;
        const retrHeight = Math.max(1, Math.abs(retrBottom - retrTop));
        group.append('rect')
          .attr('x', x - candleWidth / 2)
          .attr('y', retrTop)
          .attr('width', candleWidth)
          .attr('height', retrHeight)
          .attr('fill', '#ff4757')
          .attr('opacity', 0.9);
      }
    });

    // --- canlı fiyat çizgisi
    if (isRealTime && livePrice) {
      const livePriceY = (yScale(livePrice) as number) ?? 0;
      svg.append('line')
        .attr('x1', margin.left).attr('x2', width - margin.right)
        .attr('y1', livePriceY).attr('y2', livePriceY)
        .attr('stroke', '#ffaa00').attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5').attr('opacity', 0.9);

      svg.append('text')
        .attr('x', width - margin.right + 5)
        .attr('y', livePriceY + 4)
        .attr('fill', '#ffaa00').attr('font-size', '12px').attr('font-weight', 'bold')
        .text(formatPriceRaw(livePrice));
    }

    // --- Market Cap etiketi
    const last = render[render.length - 1];
    if ((last as any).marketCap != null) {
      const mcValue = (last as any).marketCap as number;
      const formatUsd = (v: number) => (v >= 1 ? `$${v.toFixed(2)}` : `$${v.toPrecision(2)}`);
      svg.append('text')
        .attr('x', width - margin.right - 5)
        .attr('y', margin.top + 15)
        .attr('fill', '#00bfff').attr('font-size', '12px').attr('font-weight', 'bold')
        .text(`MCap: ${formatUsd(mcValue)}`).raise();
    }

    // --- parent’a fiyat bildir
    if (onPriceUpdate) {
      const latestPrice = livePrice || last.close;
      onPriceUpdate(latestPrice);
    }
  }, [
    candles,
    trades,
    height,
    showVolume,
    showIndicators,
    onPriceUpdate,
    isRealTime,
    livePrice,
    chartOptions.interval,
  ]);

  const handleIntervalChange = (interval: ChartOptions['interval']) => {
    setChartOptions(prev => ({ ...prev, interval }));
  };

  const toggleAutoUpdate = () => {
    setChartOptions(prev => ({ ...prev, autoUpdate: !prev.autoUpdate }));
  };

  const currentPrice = livePrice || (candles.length > 0 ? candles[candles.length - 1].close : 0);
  const priceChange = candles.length > 1
    ? candles[candles.length - 1].close - candles[candles.length - 2].close
    : 0;
  const priceChangePercent = candles.length > 1
    ? (priceChange / candles[candles.length - 2].close) * 100
    : 0;

  // ---------- RETURN (tam blok) ----------
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
              {/* DEBUG BANNER */}
      <div id="DEBUG_TECHAN" style={{background:'#0ea5e9',color:'#000',padding:6,fontWeight:700}}>
        TECHAN ACTIVE — interval: {chartOptions.interval}
      </div>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-[#d8e9ea]" />
            <span className="text-white font-medium">Price Chart</span>
          </div>
  
          {/* Current Price */}
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-white">
              {formatPriceRaw(currentPrice)} SOL
            </span>
            <div className={`flex items-center space-x-1 ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {priceChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="text-sm">
                {priceChange >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
  
        {/* Right controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleAutoUpdate}
            className={`p-2 rounded transition-colors ${
              chartOptions.autoUpdate
                ? 'bg-green-500/20 text-green-400'
                : 'bg-[#2a2a2a] text-[#a0a0a0] hover:text-white'
            }`}
            title={chartOptions.autoUpdate ? 'Auto-update ON' : 'Auto-update OFF'}
          >
            <RefreshCw className={`w-4 h-4 ${chartOptions.autoUpdate ? 'animate-spin' : ''}`} />
          </button>
  
          <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
            isRealTime && connectionStatus === 'connected'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isRealTime && connectionStatus === 'connected'
                ? 'bg-green-400 animate-pulse'
                : 'bg-red-400'
            }`} />
            <span>{isRealTime && connectionStatus === 'connected' ? 'LIVE' : 'OFFLINE'}</span>
          </div>
  
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-[#2a2a2a] text-[#a0a0a0] hover:text-white rounded transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
  
          <button
            onClick={refresh}
            disabled={loading}
            className="p-2 bg-[#2a2a2a] text-[#a0a0a0] hover:text-white rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
  
      {/* Interval Selector Row (H E M E N  H E A D E R ’ D A N  S O N R A) */}
      <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-[#2a2a2a] bg-[#111]">
        {(['1m','5m','15m','30m','1h','4h','1d'] as const).map((interval) => (
          <button
            key={interval}
            onClick={() => handleIntervalChange(interval)}
            className={`px-3 py-1 text-sm rounded transition-colors
              ${chartOptions.interval === interval
                ? 'bg-[#d8e9ea] text-black font-semibold'
                : 'text-[#a0a0a0] hover:text-white'}`}
          >
            {interval}
          </button>
        ))}
      </div>
  
      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-[#2a2a2a] bg-[#0a0a0a]">
          <div className="grid grid-cols-3 gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showVolume}
                onChange={() => setChartOptions(prev => ({ ...prev, limit: prev.limit }))}
                className="rounded"
              />
              <span className="text-sm text-[#a0a0a0]">Show Volume</span>
            </label>
  
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showIndicators}
                onChange={() => setChartOptions(prev => ({ ...prev, limit: prev.limit }))}
                className="rounded"
              />
              <span className="text-sm text-[#a0a0a0]">Show Indicators</span>
            </label>
  
            <div className="flex items-center space-x-2">
              <span className="text-sm text-[#a0a0a0]">Candles:</span>
              <select
                value={chartOptions.limit}
                onChange={(e) => setChartOptions(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
                className="bg-[#2a2a2a] text-white text-sm rounded px-2 py-1 border border-[#3a3a3a]"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>
        </div>
      )}
  
      {/* Chart Container */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-[#1a1a1a]/90 flex items-center justify-center z-10">
            <div className="flex items-center space-x-2 text-white">
              <RefreshCw className="w-5 h-5 animate-spin text-[#d8e9ea]" />
              <span>Loading chart data...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-2 right-2 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 px-3 py-1 rounded text-sm z-10">
            {error}
          </div>
        )}
  
        <div
          ref={chartRef}
          className="w-full"
          style={{ height: `${height}px`, position: 'relative', zIndex: 10 }}
        />
      </div>
  
      {/* Footer */}
      <div className="p-2 border-t border-[#2a2a2a] text-xs text-[#666] text-center">
        {lastUpdate && `Last updated: ${lastUpdate.toLocaleTimeString()}`}
        {candles.length > 0 && ` • ${candles.length} candles`}
      </div>
    </div>
  );
  
};

export default TechanChart;
