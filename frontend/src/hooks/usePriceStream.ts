"use client";
import { useEffect } from "react";
import { usePriceStore } from "@/stores/priceStore";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function usePriceStream(symbols: string[]) {
  const updatePrices = usePriceStore((s) => s.updatePrices);

  useEffect(() => {
    if (!symbols.length) return;
    const symbolStr = symbols.join(",");
    const url = `${API_BASE}/api/market/stream/prices?symbols=${symbolStr}`;
    const es  = new EventSource(url);

    es.addEventListener("price_update", (event) => {
      try {
        const prices = JSON.parse(event.data);
        updatePrices(prices);
      } catch (e) {
        console.error("SSE parse error:", e);
      }
    });

    es.onerror = () => {
      console.warn("SSE connection lost — retrying…");
    };

    return () => es.close();
  }, [symbols.join(",")]);
}
