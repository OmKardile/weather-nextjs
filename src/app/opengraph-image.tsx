import { ImageResponse } from 'next/og';
import { LOGO_MARK_SVG } from '@/components/brand/Logo';

export const alt = 'Aether — Weather, elevated.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The brand mark as a self-contained data URI (satori renders data-URL <img>). */
const MARK_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(LOGO_MARK_SVG).toString('base64')}`;

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: 'linear-gradient(135deg, #04100F 0%, #0A2B2A 52%, #15907C 135%)',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Soft aurora glow */}
        <div
          style={{
            position: 'absolute',
            width: 900,
            height: 420,
            top: -180,
            left: 150,
            borderRadius: 9999,
            background:
              'radial-gradient(closest-side, rgba(69,209,179,0.35), rgba(69,209,179,0))',
            display: 'flex',
          }}
        />
        {/* Altitude-A brand mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 44,
          }}
        >
          <img
            src={MARK_DATA_URI}
            width={168}
            height={168}
            alt=""
            style={{ borderRadius: 42, display: 'flex' }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 108,
            fontWeight: 800,
            letterSpacing: '0.24em',
            color: '#F2F7F5',
            margin: 0,
          }}
        >
          AETHER
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 34,
            color: 'rgba(234,244,241,0.72)',
            marginTop: 18,
            letterSpacing: '0.08em',
          }}
        >
          Weather, elevated.
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 44,
            gap: 14,
          }}
        >
          {['Live map', 'AI briefings', '16-day outlook', 'Sky mode'].map((chip) => (
            <div
              key={chip}
              style={{
                display: 'flex',
                padding: '10px 24px',
                borderRadius: 9999,
                border: '1px solid rgba(255,255,255,0.22)',
                background: 'rgba(255,255,255,0.07)',
                color: 'rgba(234,244,241,0.9)',
                fontSize: 22,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
