import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "transparent",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "24px",
        }}
      >
        <img
          src={new URL("/logo-nemo.png", "http://localhost:3000").toString()}
          alt="NemoBlocks"
          width={144}
          height={144}
          style={{ width: "80%", height: "80%", objectFit: "contain", borderRadius: "18px" }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
