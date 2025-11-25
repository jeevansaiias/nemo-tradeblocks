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
          background: "transparent",
        }}
      >
        <img
          src={new URL("/logo-nemo.png", "http://localhost:3000").toString()}
          alt="NemoBlocks"
          width={28}
          height={28}
          style={{ width: "70%", height: "70%", objectFit: "contain" }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
