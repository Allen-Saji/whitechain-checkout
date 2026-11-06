import { ImageResponse } from 'next/og';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fcfaf7',
        borderRadius: 36,
      }}
    >
      <svg width="120" height="120" viewBox="0 0 40 40">
        <path d="M5 17 34 4v17L10 29l-5-3Z" fill="#d83c1b" />
        <path d="m5 17 5 12v7l-5-6Z" fill="#a42c17" />
        <path d="m5 17 5 12L34 21 10 25Z" fill="#ffac8c" />
      </svg>
    </div>,
    size,
  );
}
