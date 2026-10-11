import { ImageResponse } from 'next/og';

export const alt = 'Aether — Weather, elevated.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

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
        {/* Rising sun over waves mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 0,
            marginBottom: 44,
          }}
        >
          <div
            style={{
              width: 132,
              height: 132,
              borderRadius: 34,
              background: 'linear-gradient(135deg, #45D1B3 0%, #0F5F55 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 24px 80px -20px rgba(69,209,179,0.8)',
            }}
          >
            <div
              style={{
                width: 132,
                height: 132,
                borderRadius: 34,
                display: 'flex',
                position: 'absolute',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 9999,
                  background: '#F6FEFB',
                  marginTop: -26,
                  display: 'flex',
                }}
              />
              <div
                style={{
                  width: 84,
                  height: 5,
                  borderRadius: 9999,
                  background: '#F6FEFB',
                  marginTop: 34,
                  display: 'flex',
                }}
              />
              <div
                style={{
                  width: 64,
                  height: 4,
                  borderRadius: 9999,
                  background: '#F6FEFB',
                  opacity: 0.6,
                  marginTop: 52,
                  display: 'flex',
                }}
              />
            </div>
          </div>
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
          {['24h trends', '7-day outlook', 'Air quality', 'Live skies'].map((chip) => (
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
