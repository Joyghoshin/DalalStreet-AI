"use client";
import { create } from "zustand";

export interface StockPrice {
  symbol:    string;
  exchange:  string;
  price:     number;
  open:      number;
  high:      number;
  low:       number;
  volume:    number;
  change:    number;
  changePct: number;
  timestamp: string;
  prevPrice?: number;
}

interface PriceState {
  prices:       Record<string, StockPrice>;
  updatePrices: (data: StockPrice[]) => void;
}

export const usePriceStore = create<PriceState>((set, get) => ({
  prices: {},
  updatePrices: (data) => {
    // Merge each incoming price into existing state — never replace all at once
    const current = get().prices;
    const patch: Record<string, StockPrice> = {};
    data.forEach((item) => {
      const prev = current[item.symbol];
      patch[item.symbol] = {
        ...item,
        prevPrice: prev?.price,
      };
    });
    // Spread existing first, then overlay only the updated symbols
    set({ prices: { ...current, ...patch } });
  },
}));
