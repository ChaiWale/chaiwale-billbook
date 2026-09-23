'use client';

import React from 'react';

interface ChaiLoaderProps {
  label?: string;
  sublabel?: string;
  fullScreen?: boolean;
}

export default function ChaiLoader({
  label = 'Chaiwale POS & Billbook',
  sublabel = 'Syncing Khata ledger & store records...',
  fullScreen = false
}: ChaiLoaderProps) {
  const content = (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '32px',
        userSelect: 'none'
      }}
    >
      {/* Ambient Warm Halo Glow */}
      <div
        style={{
          position: 'absolute',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(217, 107, 39, 0.35) 0%, rgba(140, 89, 59, 0.15) 50%, transparent 70%)',
          filter: 'blur(30px)',
          zIndex: 0,
          animation: 'cwGlowPulse 2.4s infinite ease-in-out'
        }}
      />

      {/* Logo Container with Zoom-in / Zoom-out */}
      <div
        style={{
          position: 'relative',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1
        }}
      >
        <div
          className="cw-zoom-pulse"
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            overflow: 'hidden',
            padding: '3px',
            backgroundColor: '#1C100A',
            border: '2px solid rgba(217, 107, 39, 0.7)',
            boxShadow: '0 0 35px rgba(217, 107, 39, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/chaiwale-logo.jpeg"
            alt="Chaiwale"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '50%'
            }}
          />
        </div>
      </div>

      {/* Brand Text */}
      <h3
        style={{
          margin: '0 0 6px 0',
          fontSize: '17px',
          fontWeight: 900,
          color: '#FAF6F0',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          zIndex: 1
        }}
      >
        {label}
      </h3>
      {sublabel && (
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            fontWeight: 500,
            color: '#C5B5A8',
            maxWidth: '260px',
            lineHeight: 1.4,
            zIndex: 1
          }}
        >
          {sublabel}
        </p>
      )}

      {/* Embedded Animation Keyframes */}
      <style jsx>{`
        @keyframes cwZoom {
          0%, 100% {
            transform: scale(0.92);
            box-shadow: 0 0 20px rgba(217, 107, 39, 0.25);
          }
          50% {
            transform: scale(1.08);
            box-shadow: 0 0 45px rgba(217, 107, 39, 0.6);
          }
        }
        @keyframes cwGlowPulse {
          0%, 100% {
            opacity: 0.4;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.1);
          }
        }
        .cw-zoom-pulse {
          animation: cwZoom 2.2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(18, 9, 5, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)'
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '16px',
        backgroundColor: 'rgba(18, 9, 5, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '20px'
      }}
    >
      {content}
    </div>
  );
}
