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

// Development-only fetch timing helper
export async function timedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return fetch(input, init);
  }
  const start = performance.now();
  try {
    return await fetch(input, init);
  } finally {
    const duration = Math.round(performance.now() - start);
    console.log(`[fetch] ${typeof input === "string" ? input : input.toString()} ${duration}ms`);
  }
}
