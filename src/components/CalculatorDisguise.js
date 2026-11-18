"use client";

import { useState } from "react";

export default function CalculatorDisguise({ pins, onUnlock }) {
  const [display, setDisplay] = useState("0");

  const handlePress = (val) => {
    if (val === "C") {
      setDisplay("0");
      return;
    }
    if (val === "⌫") {
      setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
      return;
    }
    if (val === "=") {
      // PIN মিলে গেলে চ্যাটে ফিরে যাবে
      if (display === pins.Joy) {
        onUnlock("Joy");
        return;
      }
      if (display === pins.Meher) {
        onUnlock("Meher");
        return;
      }
      // সাধারণ অঙ্ক করলে আসল উত্তর দেখাবে
      try {
        const sanitized = display.replace(/×/g, "*").replace(/÷/g, "/");
        if (/^[0-9+\-*/.]+$/.test(sanitized)) {
          const result = Function(`"use strict"; return (${sanitized})`)();
          setDisplay(String(Number.isFinite(result) ? result : "Error"));
        }
      } catch {
        setDisplay("Error");
      }
      return;
    }

    setDisplay((prev) => (prev === "0" || prev === "Error" ? val : prev + val));
  };

  const buttons = [
    "C", "÷", "×", "⌫",
    "7", "8", "9", "-",
    "4", "5", "6", "+",
    "1", "2", "3", "=",
    "0", ".",
  ];

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-neutral-950 px-4 text-white">
      <div className="w-full max-w-xs space-y-4 rounded-3xl border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex h-20 items-end justify-end overflow-hidden rounded-2xl bg-neutral-950 px-4 py-3 text-right text-3xl font-light tracking-wider">
          {display}
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {buttons.map((b) => (
            <button
              key={b}
              onClick={() => handlePress(b)}
              className={`rounded-2xl py-4 text-lg font-medium active:scale-95 ${
                b === "="
                  ? "row-span-2 bg-amber-500 text-black"
                  : ["C", "÷", "×", "-", "+", "⌫"].includes(b)
                  ? "bg-neutral-800 text-amber-400"
                  : b === "0"
                  ? "col-span-2 bg-neutral-800/70"
                  : "bg-neutral-800/70"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}