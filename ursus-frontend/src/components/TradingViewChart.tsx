import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickSeries, LineSeries, HistogramSeries, ColorType, UTCTimestamp } from 'lightweight-charts';
import { useChartData } from '../hooks/useChartData';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatNumber } from '../utils/formatters';

interface TradingViewChartProps {
  agentAddress: string;
  tokenSymbol: string;
  className?: string;
}

interface CandlestickData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface VolumeData {
  time: UTCTimestamp;
  value: number;
  color?: string;
}

interface PriceLineData {
  time: UTCTimestamp;
  value: number;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  agentAddress,
  tokenSymbol,
  className = ''
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  const [isChartReady, setIsChartReady] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0);

  // Get chart data with professional settings
  const {
    candles,
    trades,
    loading,
    error,
    livePrice,
    lastUpdate,
    priceChange24h,
    connectionStatus,
  } = useChartData(agentAddress, {
    interval: '1h', // Professional 1-hour candles
    limit: 168, // 7 days of hourly data
    autoUpdate: true,
    enableRealTime: true
  });

  // WebSocket for real-time updates
  const { isConnected: wsConnected } = useWebSocket({ autoConnect: true });

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Chart configuration
    const chartOptions = {
      layout: {
        textColor: '#d1d4dc',
        background: {
          type: ColorType.Solid,
          color: '#0f0f0f'
        },
        fontSize: 12,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
      },
      grid: {
        vertLines: {
          color: 'rgba(42, 46, 57, 0.5)',
          style: 1,
          visible: true
        },
        horzLines: {
          color: 'rgba(42, 46, 57, 0.5)',
          style: 1,
          visible: true
        }
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#758696',
          style: 3,
          visible: true,
          labelVisible: true
        },
        horzLine: {
          color: '#758696',
          style: 3,
          visible: true,
          labelVisible: true
        }
      },
      rightPriceScale: {
        visible: true,
        borderColor: '#2a2e39',
        textColor: '#d1d4dc',
        entireTextOnly: false,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1
        }
      },
      leftPriceScale: {
        visible: false
      },
      timeScale: {
        visible: true,
        borderColor: '#2a2e39',
        textColor: '#d1d4dc',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 6,
        minBarSpacing: 2
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
        axisDoubleClickReset: true
      },
      kineticScroll: {
        mouse: true,
        touch: true
      }
    };

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      ...chartOptions,
      width: chartContainerRef.current.clientWidth,
      height: 500
    });

    chartRef.current = chart;

    // Add candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      // Improve readability for very small prices
      priceFormat: {
        type: 'price',
        precision: 10,
        minMove: 1e-10
      }
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Add volume series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume'
      },
      priceScaleId: 'volume'
    });

    // Configure volume scale margins
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.7,
        bottom: 0
      }
    });

    volumeSeriesRef.current = volumeSeries;

    // Add price line series for real-time price
    const priceLineSeries = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      crosshairMarkerBorderColor: '#3b82f6',
      crosshairMarkerBackgroundColor: '#3b82f6',
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: '#3b82f6',
      priceLineWidth: 1,
      priceLineStyle: 2
    });

    priceLineSeriesRef.current = priceLineSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: 500
        });
      }
    };

    window.addEventListener('resize', handleResize);
    setIsChartReady(true);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chart) {
        chart.remove();
      }
    };
  }, []);

// Update chart data
useEffect(() => {
  if (!isChartReady || !candlestickSeriesRef.current || !volumeSeriesRef.current) return;

  // Boş durum
  if (!candles || candles.length === 0) {
    try {
      candlestickSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
    } catch {}
    setCurrentPrice(null);
    setPriceChange(0);
    setPriceChangePercent(0);
    return;
  }

  // Zamanı baz alarak duplicate barları son değerle tekilleştir
  const dedupeByTime = <T extends { time: number }>(arr: T[]) => {
    const m = new Map<number, T>();
    for (const it of arr) m.set(it.time, it);
    return Array.from(m.values()).sort((a, b) => a.time - b.time);
  };

  // 1) Candle verisini (fiyat bazlı) hazırla
const candlestickData: CandlestickData[] = candles
.map((c) => ({
  time: Math.floor(c.date.getTime() / 1000) as UTCTimestamp,
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close,
}))
.sort((a, b) => a.time - b.time);

// 2) Hacim verisini hazırla
const volumeData: VolumeData[] = candles
.map((c) => ({
  time: Math.floor(c.date.getTime() / 1000) as UTCTimestamp,
  value: c.volume,
  color: c.close >= c.open ? '#26a69a80' : '#ef535080',
}))
.sort((a, b) => a.time - b.time);


  // 3) Duplicate timestamp’leri temizle
  const dedupedCandles = dedupeByTime(candlestickData);
  const dedupedVolume  = dedupeByTime(volumeData);

  if (dedupedCandles.length !== candlestickData.length) {
    console.log('⚠️ Duplicate candle times trimmed:',
      candlestickData.length, '→', dedupedCandles.length);
  }

  // 4) Serileri güncelle
  try {
    candlestickSeriesRef.current.setData(dedupedCandles);
    volumeSeriesRef.current.setData(dedupedVolume);
  } catch (err) {
    console.error('❌ Failed to update chart series:', err);
    return;
  }

  // 5) Header metrikleri
  const last = dedupedCandles[dedupedCandles.length - 1];
  setCurrentPrice(last?.close ?? null);

  if (dedupedCandles.length >= 2) {
    if (priceChange24h !== null && Number.isFinite(priceChange24h)) {
      const changeAbs = (last.close * priceChange24h) / 100;
      setPriceChange(changeAbs);
      setPriceChangePercent(priceChange24h);
    } else {
      const first = dedupedCandles[0];
      const change = last.close - first.close;
      const pct = first.close > 0 ? (change / first.close) * 100 : 0;
      setPriceChange(change);
      setPriceChangePercent(pct);
    }
  } else {
    setPriceChange(0);
    setPriceChangePercent(0);
  }

  // 6) Görünümü sığdır
  if (chartRef.current) {
    chartRef.current.timeScale().fitContent();
    // Ensure last bars are visible with some right offset for price line
    const ts = chartRef.current.timeScale();
    try { ts.applyOptions({ rightOffset: 12 }); } catch {}
  }
}, [candles, isChartReady, priceChange24h]);



  // Update real-time price line
  useEffect(() => {
    if (!isChartReady || !priceLineSeriesRef.current || !livePrice) return;

    const now = Math.floor(Date.now() / 1000) as UTCTimestamp;
    const priceData: PriceLineData = {
      time: now,
      value: livePrice
    };

    priceLineSeriesRef.current.update(priceData);
    setCurrentPrice(livePrice);
  }, [livePrice, isChartReady]);

  // Professional chart resize handler
  const handleChartResize = useCallback(() => {
    if (chartRef.current && chartContainerRef.current) {
      const { clientWidth, clientHeight } = chartContainerRef.current;
      chartRef.current.applyOptions({
        width: clientWidth,
        height: Math.max(clientHeight, 500)
      });
      console.log(`📊 Professional chart resized: ${clientWidth}x${Math.max(clientHeight, 500)}`);
    }
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      handleChartResize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleChartResize]);

  // Connection status indicator
  const getConnectionStatus = () => {
    if (loading) return { color: 'text-yellow-400', text: 'Loading...' };
    if (error) return { color: 'text-red-400', text: 'Error' };
    if (connectionStatus === 'connected' && wsConnected) return { color: 'text-green-400', text: 'Live' };
    if (connectionStatus === 'connected') return { color: 'text-blue-400', text: 'Connected' };
    return { color: 'text-gray-400', text: 'Offline' };
  };

  const status = getConnectionStatus();

  return (
    <div className={`bg-[#0f0f0f] rounded-lg border border-[#2a2a2a] ${className}`}>
      {/* Chart Header */}
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-semibold text-white">
              {tokenSymbol}/SOL
            </h3>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${status.color.replace('text-', 'bg-')}`} />
              <span className={`text-sm ${status.color}`}>{status.text}</span>
            </div>
          </div>
          
          {currentPrice && (
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-xl font-bold text-white">
                  {formatNumber(currentPrice.toString(), { maxDecimals: 10, minDecimals: 6 })} SOL
                </div>
                <div className={`text-sm ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {priceChange >= 0 ? '+' : ''}{formatNumber(priceChange.toString(), { maxDecimals: 10, minDecimals: 6 })}
                  ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        <div ref={chartContainerRef} className="w-full h-[500px]" />
        
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-[#0f0f0f] bg-opacity-90 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-3"></div>
              <div className="text-sm text-gray-400 mb-1">Loading chart data...</div>
              <div className="text-xs text-gray-500">Fetching real blockchain data</div>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && !loading && (
          <div className="absolute inset-0 bg-[#0f0f0f] bg-opacity-80 flex items-center justify-center">
            <div className="text-center">
              <div className="text-red-400 mb-2">⚠️</div>
              <div className="text-sm text-red-400">{error}</div>
            </div>
          </div>
        )}

        {/* No Data Overlay */}
        {!loading && !error && (!candles || candles.length === 0) && (
          <div className="absolute inset-0 bg-[#0f0f0f] bg-opacity-80 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-400 mb-2">📊</div>
              <div className="text-sm text-gray-400">No trading data available</div>
              <div className="text-xs text-gray-500 mt-1">Start trading to see chart data</div>
            </div>
          </div>
        )}
      </div>

      {/* Professional Chart Footer */}
      <div className="p-3 border-t border-[#2a2a2a] text-xs text-gray-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>Last update: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Never'}</div>
            {trades && trades.length > 0 && (
              <div>Trades: {trades.length} analyzed</div>
            )}
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
              <span>{wsConnected ? 'Live Data' : 'Offline'}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span>URSUS Professional Chart</span>
            <span>•</span>
            <span>Powered by Lightweight Charts™</span>
          </div>
        </div>
      </div>
    </div>
  );
};
