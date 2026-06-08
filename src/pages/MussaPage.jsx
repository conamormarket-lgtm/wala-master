import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const MUSSA_URL = 'https://wala.pe/mussa';

const MussaPage = () => {
  const qrWrapRef = useRef(null);

  const descargarQR = () => {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mussa-qr.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        minHeight: '70vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1rem',
        background: 'linear-gradient(160deg, #faf5ff 0%, #f8fafc 100%)',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 10px 30px -10px rgba(124, 58, 237, 0.25)',
          padding: '2.5rem 2rem',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            background: '#ede9fe',
            color: '#7c3aed',
            fontSize: '0.8rem',
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            padding: '6px 14px',
            borderRadius: 999,
            marginBottom: '1.25rem',
          }}
        >
          Próximamente
        </span>

        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: '#1e1b4b', margin: '0 0 0.5rem' }}>
          Mussa
        </h1>
        <p style={{ color: '#64748b', fontSize: '1.05rem', lineHeight: 1.6, margin: '0 0 2rem' }}>
          Estamos preparando algo especial. Muy pronto podrás conocer Mussa aquí mismo.
        </p>

        <div
          ref={qrWrapRef}
          style={{
            display: 'inline-block',
            padding: 16,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <QRCodeCanvas
            value={MUSSA_URL}
            size={200}
            level="H"
            includeMargin={false}
            fgColor="#1e1b4b"
            bgColor="#ffffff"
          />
        </div>

        <p style={{ color: '#475569', fontSize: '0.95rem', margin: '1.25rem 0 0.25rem' }}>
          Escanea el código para visitar
        </p>
        <a
          href={MUSSA_URL}
          style={{ color: '#7c3aed', fontWeight: 700, textDecoration: 'none', fontSize: '1.05rem' }}
        >
          wala.pe/mussa
        </a>

        <div style={{ marginTop: '2rem' }}>
          <button
            onClick={descargarQR}
            style={{
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '12px 28px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.3)',
            }}
          >
            ⬇️ Descargar QR
          </button>
        </div>
      </div>
    </div>
  );
};

export default MussaPage;
