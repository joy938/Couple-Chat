import { ImageResponse } from "next/og";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const size = Number(searchParams.get("size")) || 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <div
          style={{
            width: Math.round(size * 0.72),
            height: Math.round(size * 0.72),
            borderRadius: "50%",
            background: "linear-gradient(135deg, #e11d48, #fb7185)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontSize: Math.round(size * 0.26),
            fontWeight: 700,
          }}
        >
          J&M
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}