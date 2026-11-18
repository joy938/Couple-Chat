"use client";

import { useRef, useState, useEffect } from "react";

const COLORS = ["#ffffff", "#fb7185", "#38bdf8", "#fbbf24", "#34d399"];

export default function DoodleModal({ onClose, onSend }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvasRef.current.width,
      y: ((e.clientY - rect.top) / rect.height) * canvasRef.current.height,
    };
  };

  const startDraw = (e) => {
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };

  const moveDraw = (e) => {
    if (!drawing) return;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => setDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleSend = () => {
    const dataUrl = canvasRef.current.toDataURL("image/webp", 0.6);
    onSend(dataUrl);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-sm space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Draw a Doodle</span>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`h-5 w-5 rounded-full ${
                  color === c ? "ring-2 ring-white ring-offset-2 ring-offset-neutral-900" : ""
                }`}
              />
            ))}
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={320}
          height={260}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          className="w-full touch-none rounded-xl border border-neutral-800 bg-neutral-950"
        />

        <div className="flex gap-2">
          <button
            onClick={clearCanvas}
            className="rounded-xl border border-neutral-700 px-3 py-2 text-xs text-neutral-300"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-neutral-700 py-2 text-xs text-neutral-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            className="flex-1 rounded-xl bg-rose-600 py-2 text-xs font-medium text-white"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}