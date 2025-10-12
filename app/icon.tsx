import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8f6f0",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ea580c"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 2c1.5 0 3 1.5 3 3v1c1 0 2 1 2 2v8c0 1-1 2-2 2H9c-1 0-2-1-2-2V8c0-1 1-2 2-2V5c0-1.5 1.5-3 3-3z"/>
          <path d="M8 8h8"/>
          <path d="M10 12h4"/>
          <circle cx="12" cy="15" r="1"/>
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
