import React, { useEffect, useState } from 'react';
import TechanChart from './TechanChart';

interface TradingChartProps {
  tokenAddress: string;
  height?: number;
  onPriceUpdate?: (price: number) => void;
}

// WS adresi: .env.local'da NEXT_PUBLIC_WS_URL tanımlıysa onu kullan,
// yoksa NEXT_PUBLIC_API_URL'dan türet, o da yoksa localhost.
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, 'ws')
    : 'ws://localhost:3001');

const TradingChart: React.FC<TradingChartProps> = ({
  tokenAddress,
  height = 400,
  onPriceUpdate
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const addrLc = tokenAddress.toLowerCase();

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        // Backend RealTradingEngine.broadcastTradeUpdate ile gelen event
        if (
          msg?.type === 'realTradeExecuted' &&
          msg?.agentAddress?.toLowerCase() === addrLc
        ) {
          // fiyat geldiyse yukarıya bildir
          const p = msg?.trade?.price;
          if (typeof p === 'number') onPriceUpdate?.(p);

          // TechanChart yeniden mount → veriyi tekrar çeker
          setRefreshKey((k) => k + 1);
        }
      } catch {
        // ping/pong vb. JSON olmayan mesajlar olabilir; görmezden gel
      }
    };

    return () => ws.close();
  }, [addrLc, onPriceUpdate]);

  return (
    <TechanChart
      key={`${addrLc}-${refreshKey}`}
      agentAddress={tokenAddress}
      height={height}
      onPriceUpdate={onPriceUpdate}
      showVolume={true}
      showIndicators={true}
    />
  );
};

export default TradingChart;
