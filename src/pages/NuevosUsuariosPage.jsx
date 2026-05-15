import React from 'react';
import { Star } from 'lucide-react';
import './NuevosUsuariosPage.module.css';

const NuevosUsuariosPage = () => {
  const [vsSlideIndex, setVsSlideIndex] = React.useState(0);
  const [reviewsSlideIndex, setReviewsSlideIndex] = React.useState(0);

  // DATOS PARA LAS TARJETAS DE RESEÑAS
  const reviewsData = [
    { id: 1, image: `https://picsum.photos/400/400?random=1`, location: 'Lima, PE', date: '12/05/2026', title: 'El mejor regalo', review: 'Mi novia lloró de la emoción cuando vio nuestra foto enmarcada. ¡Gracias!' },
    { id: 2, image: `https://picsum.photos/400/400?random=2`, location: 'Arequipa, PE', date: '08/05/2026', title: 'Calidad Premium', review: 'La madera del marco se siente muy fina y la impresión fotográfica es espectacular.' },
    { id: 3, image: `https://picsum.photos/400/400?random=3`, location: 'Cusco, PE', date: '01/05/2026', title: 'Llegó rapidísimo', review: 'Lo pedí un martes y el jueves ya estaba en la puerta de mi casa. Súper recomendados.' },
    { id: 4, image: `https://picsum.photos/400/400?random=4`, location: 'Trujillo, PE', date: '25/04/2026', title: 'Detalle único', review: 'Me encantó poder personalizar la dedicatoria. Hizo que el regalo fuera mucho más especial.' },
    { id: 5, image: `https://picsum.photos/400/400?random=5`, location: 'Piura, PE', date: '15/04/2026', title: '100% Confiable', review: 'Tenía dudas por ser mi primera compra, pero el empaque protegió súper bien el cuadro.' },
    { id: 6, image: `https://picsum.photos/400/400?random=6`, location: 'Ica, PE', date: '02/04/2026', title: 'A mi mamá le encantó', review: 'Le regalé un cuadro con fotos de los nietos por su cumpleaños y quedó fascinada.' }
  ];

  const handleNextReview = () => {
    setReviewsSlideIndex((prev) => (prev + 1) % reviewsData.length);
  };

  const handlePrevReview = () => {
    setReviewsSlideIndex((prev) => (prev - 1 + reviewsData.length) % reviewsData.length);
  };

  // ARREGLO DE PARES DE IMÁGENES PARA EL BLOQUE VS (4 imágenes = 2 pares)
  const vsSlidesData = [
    { left: 'https://picsum.photos/400/400?random=10', right: 'https://picsum.photos/400/400?random=11' },
    { left: 'https://picsum.photos/400/400?random=12', right: 'https://picsum.photos/400/400?random=13' }
  ];

  const handleNextVsSlide = () => {
    setVsSlideIndex((prev) => (prev + 1) % vsSlidesData.length);
  };

  const handlePrevVsSlide = () => {
    setVsSlideIndex((prev) => (prev - 1 + vsSlidesData.length) % vsSlidesData.length);
  };

  return (
    <>
      <style>{`
        /* IMPORTACIÓN DE FUENTES LOCALES */
        @font-face {
          font-family: 'Mermaid';
          src: url('${process.env.PUBLIC_URL}/diseno/MERMAID1001.TTF') format('truetype');
          font-weight: normal;
          font-style: normal;
        }

        @font-face {
          font-family: 'Mermaid Swash';
          src: url('${process.env.PUBLIC_URL}/diseno/MERMAID%20SWASH%20CAPS.TTF') format('truetype');
          font-weight: normal;
          font-style: normal;
        }

        /* ESTILO PC: Parallax fluido (Fijo al fondo) */
        .landing-bg-image {
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          object-fit: cover;
          z-index: -1;
          transform: translateZ(0);
          will-change: transform;
          backface-visibility: hidden;
        }
        
        .landing-container {
          width: 100%;
          position: relative;
          min-height: 100vh; /* Se expandirá según el contenido */
        }

        /* Contenedor invisible por defecto para móviles */
        .landing-bg-mobile-container {
          display: none;
        }

        /* Capa donde irán los componentes (encima del fondo) */
        .content-layer {
          position: relative;
          z-index: 1;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 2rem; /* El padding lateral lo pondremos por elemento para permitir fondos de ancho completo */
          font-family: 'Mermaid', sans-serif; /* Aplicamos la fuente por defecto aquí */
        }

        /* --- CLASES RESPONSIVAS PARA EL HERO (PC por defecto) --- */
        .hero-title {
          font-size: 3rem; /* Tamaño Grande para PC */
          line-height: 1.2;
          color: #333;
          text-shadow: 0px 4px 15px rgba(255,255,255,0.9);
          margin: 0;
        }
        .hero-abrazos-img {
          height: 1.2em;
          vertical-align: middle;
          margin: 0 4px;
        }
        .hero-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background-color: #ffffff;
          padding: 12px 28px; /* Botón grande para PC */
          border-radius: 50px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
          font-size: 1.25rem; /* Letra grande para PC */
          color: #333;
        }
        .hero-btn-icon {
          width: 28px;
          height: 28px;
          object-fit: contain;
        }

        /* --- CLASES PARA EL BLOQUE VS (Y FLECHAS DE RESEÑAS) --- */
        .vs-arrow-btn {
          width: 35px; /* 👈 MODIFICA EL TAMAÑO DE LAS FLECHAS EN PC (ancho) */
          height: 35px; /* 👈 MODIFICA EL TAMAÑO DE LAS FLECHAS EN PC (alto) */
          border-radius: 50%;
          background-color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FF8B6F;
          font-weight: bold;
          font-size: 1rem; /* 👈 MODIFICA EL TAMAÑO DEL ÍCONO DE FLECHA EN PC */
          box-shadow: 0 4px 10px rgba(0,0,0,0.15);
          cursor: pointer;
          flex-shrink: 0;
        }

        .vs-box {
          background-color: #FF8B6F;
          border: 6px solid #ffffff;
          border-radius: 20px;
          width: 45%; /* Asegura que quepan 2 siempre */
          max-width: 300px;
          aspect-ratio: 1/1; /* Cuadrado perfecto */
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
          text-align: center;
          padding: 0; /* Sin padding para que la imagen toque el borde */
          overflow: hidden; /* Corta la imagen en las esquinas redondas */
        }

        /* Animación suave al cambiar la imagen del VS */
        @keyframes fadeSlide {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .vs-animate {
          animation: fadeSlide 0.4s ease-out;
        }

        /* --- CLASES PARA EL CARRUSEL INFINITO DE MARCAS --- */
        @keyframes scrollMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .marquee-container {
          width: 100%;
          overflow: hidden;
          padding: 1rem 0;
        }

        .marquee-track {
          display: flex;
          width: max-content;
          animation: scrollMarquee 25s linear infinite; /* 25s es la velocidad, cámbiala si quieres que vaya más lento/rápido */
        }

        /* Opcional: Pausar al pasar el mouse */
        .marquee-track:hover {
          animation-play-state: paused;
        }

        .logo-circle-wrapper {
          padding-right: 2rem; /* Espaciado entre logos */
        }

        @media (min-width: 769px) {
          .logo-circle {
            width: 120px !important;
            height: 120px !important;
          }
        }

        /* --- CLASES RESPONSIVAS PARA EL TERCER BLOQUE (PC por defecto) --- */
        .text-block-general {
          margin: 0;
          line-height: 1.8;
          font-size: 1.5rem; /* Tamaño Grande para PC */
          color: #ffffff;
          text-align: center;
          max-width: 800px;
          text-shadow: 0px 2px 4px rgba(0,0,0,0.2);
        }
        .text-block-title {
          font-size: 2.1rem; /* Título Grande para PC (Ajustado) */
          color: #000000;
        }

        /* --- CLASES RESPONSIVAS PARA EL QUINTO BLOQUE (PC por defecto) --- */
        .brands-title {
          font-size: 1.5rem; /* Tamaño Grande para PC */
          font-weight: bold;
          -webkit-text-stroke: 1px #000000; /* Fuerza la negrita en la tipografía Mermaid */
        }

        /* --- CLASES RESPONSIVAS PARA EL BOTÓN DESCUBRE (PC por defecto) --- */
        .discover-btn {
          padding: 12px 35px; /* Botón amplio en PC */
          font-size: 1.25rem;
        }

        /* --- CLASES RESPONSIVAS PARA IMAGEN DE DESCARGA (PC por defecto) --- */
        .download-img-wrapper {
          display: inline-block;
          width: 100%;
          max-width: 600px; /* 👈 Tamaño aún más grande para PC (Ajustado) */
          transition: transform 0.2s ease;
        }
        .download-img-wrapper:hover {
          transform: scale(1.05); /* Pequeño efecto al pasar el mouse en PC */
        }

        /* --- CONTENEDOR SÉPTIMO BLOQUE (PC) --- */
        .download-section {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0 1rem;
          margin-top: -34rem; /* 👈 Margen ajustado para PC que querías (-17rem) */
          margin-bottom: -10.5rem; /* 👈 Margen ajustado para PC que querías (-12rem) */
        }

        /* --- CLASES SEXTO BLOQUE TEXTOS RESPONSIVOS --- */
        .kapi-text-1 {
          font-size: 1.2rem;
        }
        .kapi-text-2 {
          font-size: 1.3rem;
        }
        .kapi-text-3 {
          font-size: 1.3rem;
        }

        /* --- CLASES SEXTO BLOQUE (COLLAGE KAPI) --- */
        .kapi-collage-container {
          position: relative;
          width: 100%;
          max-width: 1000px;
          aspect-ratio: 1000 / 600; /* 👈 Esto hace que el lienzo actúe como una imagen y se reduzca proporcionalmente en celular */
          margin: 0 auto 0 auto;
        }

        /* --- CLASES RESPONSIVAS PARA EL OCTAVO Y NOVENO BLOQUE (PC por defecto) --- */
        .banner-line1 { font-size: 1.8rem; line-height: 1.3; }
        .banner-line2 { font-size: 2.2rem; }
        .review-card { max-width: 300px; }
        .review-img-wrapper { padding: 10px; }
        .review-img { height: 160px; }
        .review-text-zone { padding: 1rem; gap: 0.5rem; }
        .review-meta { font-size: 0.8rem; }
        .review-title { font-size: 1.2rem; }
        .review-desc { font-size: 0.9rem; line-height: 1.4; }
        .review-star { width: 16px !important; height: 16px !important; }

        /* --- CLASES DÉCIMO BLOQUE --- */
        .enc-container { display: flex; width: 100%; align-items: center; justify-content: flex-start; overflow: visible; position: relative; }
        .enc-banner { width: 80%; aspect-ratio: 4 / 1.1; flex-shrink: 0; background-color: #FF8B6F; padding: 0.8rem; border-top-right-radius: 18px; border-bottom-right-radius: 18px; display: flex; color: black; }
        .enc-izq { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .enc-der { flex: 1; min-width: 0; display: flex; padding: 0.1rem; }
        
        /* EDITA AQUÍ PARA MOVER Y CAMBIAR DE TAMAÑO A KAPI EN PC */
        .enc-kapi-container { 
          position: absolute; 
          right: 5%; /* 👈 Posición horizontal: juega con este valor (-5%, 0%, 10px, etc.) */
          bottom: -7px; /* 👈 Posición vertical: juega con este valor (-20px, 10px, etc.) */
          width: 16%; /* 👈 Ancho del contenedor: juega con este valor para hacer a kapi más grande o pequeño */
          display: flex; justify-content: center; z-index: 2; pointer-events: none; 
        }
        .enc-kapi-img { width: 100%; max-width: 400px; height: auto; object-fit: contain; }
        .enc-main-title { font-size: 1.2rem; font-weight: 900; color: #000; text-align: center; }
        .enc-white-text { font-size: 0.8rem; font-weight: 900; color: #000; }
        .enc-white-icon { height: 25px; margin: 0 10px; }
        .enc-no-llegues { font-size: 2rem; font-weight: 900; color: #000; text-align: center; line-height: 1.1; }
        .enc-horario { font-size: 1.3rem; font-weight: 900; color: #000; margin-bottom: 0.5rem; text-align: center; }
        .enc-caja-img { flex: 1; height: 230px; background-color: #f5a7a7ff; border-radius: 5px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.15); }
        .enc-btn { width: 25px !important; height: 25px !important; font-size: 12px !important; min-width: 25px !important; }
        .enc-guiones { width: 65%; overflow: hidden; white-space: nowrap; color: #FF8B6F; font-weight: bold; letter-spacing: 3px; }
        .enc-sub-container { flex: 8; padding: 0.1rem; display: flex; align-items: center; justify-content: center; }
        .enc-sub-izq { flex: 3; padding: 0.2rem; display: flex; align-items: center; justify-content: center; }
        .enc-sub-der { flex: 7; padding: 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .enc-franja-blanca { flex: 1; background-color: white; width: 90%; max-width: 100%; box-sizing: border-box; overflow: hidden; border-top-right-radius: 50px; border-bottom-right-radius: 50px; display: flex; align-items: center; margin-left: -0.4rem; padding-left: 0.4rem; padding-right: 1rem; z-index: 1; }

        /* ESTILO MÓVIL: Ajustes generales */
        @media (max-width: 768px) {
          .landing-bg-image {
            display: none; /* Apagamos el Parallax en móvil */
          }
          
          /* --- TAMAÑOS REDUCIDOS PARA MÓVIL --- */
          .hero-title {
            font-size: 1.2rem; /* Tamaño reducido que ajustaste */
            line-height: 1.5;
          }
          .hero-abrazos-img {
            margin: 0 1px;
          }
          .hero-btn {
            font-size: 0.6rem; /* El tamaño súper pequeño que pediste */
            padding: 6px 16px;
            gap: 3px;
          }
          .hero-btn-icon {
            width: 18px;
            height: 10px;
          }

          .vs-arrow-btn {
            width: 25px; /* 👈 MODIFICA EL TAMAÑO DE LAS FLECHAS EN MÓVIL (ancho) */
            height: 25px; /* 👈 MODIFICA EL TAMAÑO DE LAS FLECHAS EN MÓVIL (alto) */
            font-size: 0.8rem; /* 👈 MODIFICA EL TAMAÑO DEL ÍCONO DE FLECHA EN MÓVIL */
          }
          
          /* --- TERCER BLOQUE TAMAÑOS REDUCIDOS PARA MÓVIL --- */
          .text-block-general {
            font-size: 0.75rem; /* El tamaño general que pusiste en móvil */
          }
          .text-block-title {
            font-size: 1.2rem; /* El tamaño de la primera línea en móvil (Ajustado) */
          }

          /* --- QUINTO BLOQUE TAMAÑOS REDUCIDOS PARA MÓVIL --- */
          .brands-title {
            font-size: 0.75rem; /* Tamaño móvil */
            -webkit-text-stroke: 0.6px #000000; /* Negrita ligeramente más fina para que sea legible en pequeño */
          }

          /* --- BOTÓN DESCUBRE MÓVIL --- */
          .discover-btn {
            padding: 1px 14px; /* Relleno compacto que pediste para móvil */
            font-size: 0.95rem; /* Letra ajustada para móvil */
          }

          /* --- IMAGEN DE DESCARGA MÓVIL --- */
          .download-img-wrapper {
            max-width: 300px !important; /* 👈 Tamaño fijo para móvil */
          }

          /* --- CONTENEDOR SÉPTIMO BLOQUE (MÓVIL) --- */
          .download-section {
            margin-top: -16rem; /* 👈 Margen original protegido para Móvil */
            margin-bottom: 1rem; /* 👈 Margen original protegido para Móvil */
          }

          /* --- SEXTO BLOQUE (KAPI COLLAGE) MÓVIL --- */
          .kapi-text-1 { font-size: 0.63rem; }
          .kapi-text-2 { font-size: 0.7rem; }
          .kapi-text-3 { font-size: 0.63rem; }
          
          /* --- OCTAVO Y NOVENO BLOQUE PARA MÓVIL --- */
          .banner-line1 { font-size: 0.9rem; line-height: 1.2; }
          .banner-line2 { font-size: 1.1rem; }
          .review-card { max-width: 200px; }
          .review-img-wrapper { padding: 2px; }
          .review-img { height: 50px; }
          .review-text-zone { padding: 0.3rem; gap: 0.05rem; }
          .review-meta { font-size: 0.2rem; }
          .review-title { font-size: 0.4rem; }
          .review-desc { font-size: 0.32rem; line-height: 1; }
          .review-star { width: 6px !important; height: 6px !important; }

          /* --- DÉCIMO BLOQUE MÓVIL --- */
          .enc-container { flex-direction: column !important; overflow: visible !important; }
          .enc-banner { width: 95% !important; aspect-ratio: auto !important; flex-direction: column !important; border-radius: 18px !important; padding: 1rem !important; }
          .enc-franja-blanca { width: 40% !important; border-radius: 50px !important; margin-bottom: 0.5rem !important; } /* 👈 Juega con la franja en celular aquí */
          .enc-sub-container { flex-direction: column !important; margin-top: 1rem; }
          .enc-sub-izq { width: 100% !important; padding: 0 !important; margin-bottom: 0.5rem; text-align: center !important; }
          .enc-sub-der { width: 100% !important; padding: 0 !important; }
          .enc-der { flex: none !important; width: 100% !important; min-height: 200px !important; margin-top: 1rem !important; height: 100px !important; }
          .enc-kapi-container { position: relative !important; right: auto !important; bottom: auto !important; width: 40% !important; margin-left: 0 !important; justify-content: center !important; padding-left: 0 !important; margin-top: -140px !important; align-self: flex-end !important; z-index: 5 !important; }
          .enc-kapi-img { max-height: 130px !important; max-width: 100% !important; }
          .hide-mobile { display: none !important; }
          .enc-main-title { font-size: 0.8rem !important; }
          .enc-white-text { font-size: 0.5rem !important; }
          .enc-white-icon { height: 15px !important; margin: 0 5px !important; }
          .enc-no-llegues { font-size: 1.4rem !important; }
          .enc-horario { font-size: 1.1rem !important; margin-bottom: 0.1rem !important; }
          .enc-caja-img { height: 150px !important; }
          .enc-btn { width: 15px !important; height: 15px !important; font-size: 8px !important; min-width: 15px !important; }
          .enc-guiones { width: 0% !important; }

          .kapi-text-box-mobile {
            /* En móvil, podemos hacer que el texto del collage sea un poco más chico para que no desborde */
          }
          
          .landing-bg-mobile-container {
            display: flex;
            flex-direction: column;
            position: absolute;
            top: 0; left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            overflow: hidden;
          }

          .mobile-bg-slice {
            width: 100%;
            height: 100vh; /* Cada "rebanada" mide una pantalla */
            object-fit: fill; /* Mantiene el ancho completo */
          }
        }
      `}</style>

      <div className="landing-container">

        {/* FONDO PC PARALLAX */}
        <img className="landing-bg-image" src={`${process.env.PUBLIC_URL}/diseno/1920jpg.jpg`} alt="Fondo PC" />

        {/* FONDO MÓVIL (4 capas apiladas con efecto espejo en 2 y 4) */}
        <div className="landing-bg-mobile-container">
          <img className="mobile-bg-slice" src={`${process.env.PUBLIC_URL}/diseno/1920jpg.jpg`} alt="Fondo Movil 1" />
          <img className="mobile-bg-slice" src={`${process.env.PUBLIC_URL}/diseno/1920jpg.jpg`} alt="Fondo Movil 2" style={{ transform: 'scaleY(-1)' }} />
          <img className="mobile-bg-slice" src={`${process.env.PUBLIC_URL}/diseno/1920jpg.jpg`} alt="Fondo Movil 3" />
          <img className="mobile-bg-slice" src={`${process.env.PUBLIC_URL}/diseno/1920jpg.jpg`} alt="Fondo Movil 4" style={{ transform: 'scaleY(-1)' }} />
        </div>

        {/* CONTENIDO LIBRE (Aquí pondremos todos los componentes) */}
        <div className="content-layer">

          {/* Primer Bloque / Hero */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginTop: '2vh',
            maxWidth: '900px',
            padding: '0 5%', /* Padding lateral devuelto aquí para que no choque en los bordes */
            gap: '0.3rem'
          }}>

            {/* Título Principal (Responsivo) */}
            <h1 className="hero-title">
              Convierte tus Mejores Recuerdos <br />
              en <img
                src={`${process.env.PUBLIC_URL}/diseno/abrazos.png`}
                alt="Abrazos"
                className="hero-abrazos-img"
              /> que Duran para Siempre.
            </h1>

            {/* Label estilo botón (Responsivo) */}
            <div className="hero-btn">
              <img
                src={`${process.env.PUBLIC_URL}/diseno/corazón.png`}
                alt="Corazón"
                className="hero-btn-icon"
              />
              <span>ten a tu familia feliz con nuestra app</span>
            </div>

          </div>

          {/* Segundo Bloque / Imagen Pantalla con Video Hueco */}
          <div style={{
            marginTop: '0.2rem',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            padding: '0 5%' /* Padding lateral para que no toque los bordes del celular */
          }}>
            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '800px', width: '100%' }}>

              {/* FONDO NEGRO Y VIDEO DE YOUTUBE */}
              <div style={{
                position: 'absolute',
                /* 👇 EDITAR ESTOS PORCENTAJES PARA AJUSTAR EL TAMAÑO DEL FONDO NEGRO AL HUECO 👇 */
                top: '12%',
                left: '1%',
                width: '98%',
                height: '77%',
                /* 👆 ======================================================================== 👆 */
                zIndex: 1,
                borderRadius: '15px',
                backgroundColor: '#000000', /* <-- FONDO NEGRO para que los huecos de proporción no se vean */
                overflow: 'hidden', /* Asegura que el video no se salga del fondo negro */
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <iframe
                  src="https://www.youtube.com/embed/dQw4w9WgXcQ?controls=0" /* REEMPLAZAR CON TU LINK REAL */
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{
                    /* 👇 EDITAR AQUÍ PARA CAMBIAR EL TAMAÑO DEL VIDEO INDEPENDIENTE DEL FONDO NEGRO 👇 */
                    width: '99%',
                    height: '98%',
                  }}
                ></iframe>
              </div>

              {/* MARCO PANTALLA.PNG (Por encima del video) */}
              <img
                src={`${process.env.PUBLIC_URL}/diseno/PANTALLA.png`}
                alt="Pantalla de la App"
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain',
                  zIndex: 2, /* Se pone por encima del iframe para servir de marco */
                  pointerEvents: 'none', /* ¡IMPORTANTE! Permite dar click al video de YouTube "traspasando" la imagen */
                  filter: 'drop-shadow(0px 15px 30px rgba(0,0,0,0.5))' /* Sombra fuerte solicitada */
                }}
              />
            </div>
          </div>

          {/* Tercer Bloque / Texto Resaltado (A LO ANCHO DE TODA LA PANTALLA) */}
          <div style={{
            marginTop: '3rem',
            width: '100%', /* 100% de la pantalla */
            backgroundColor: 'rgba(217, 135, 115, 0.66)', /* Fondo Salmón con Opacidad */
            padding: '1rem 5%',
            display: 'flex',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          }}>
            <p className="text-block-general" style={{ lineHeight: '1.2' }}>
              <strong className="text-block-title"><span style={{ fontFamily: 'Georgia, serif' }}>¿</span>Por qué regalar algo personalizado?</strong> <br />
              Por que hay fechas que merecen más que un <strong style={{ color: '#000000' }}>regalo</strong> <br />
              de último minuto. Un detalle <strong style={{ color: '#000000' }}>personalizado</strong> se usa, <br />
              se abraza y <strong style={{ color: '#000000' }}>se guarda para siempre</strong>.
            </p>
          </div>

          {/* Cuarto Bloque / VS Propuesta de Valor */}
          <div style={{
            marginTop: '1.5rem',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '2rem' /* Margen inferior para que no acabe de golpe */
          }}>

            {/* Contenedor del VS y las Cajas */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: '900px',
              padding: '0 5%',
              gap: '1rem'
            }}>

              {/* Flecha Izquierda (Ahora con acción de React) */}
              <div className="vs-arrow-btn" onClick={handlePrevVsSlide}>
                &#10094;
              </div>

              {/* Contenedor de las dos cajas */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10%', /* Espacio entre los cuadrados */
                position: 'relative',
                flex: 1
              }}>

                {/* Caja Izquierda */}
                <div className="vs-box">
                  <img
                    key={`vs-left-${vsSlideIndex}`} /* El key asegura que la animación corra de nuevo al cambiar de estado */
                    src={vsSlidesData[vsSlideIndex].left.startsWith('http') ? vsSlidesData[vsSlideIndex].left : `${process.env.PUBLIC_URL}/diseno/${vsSlidesData[vsSlideIndex].left}`} /* 👇 NOMBRE DINÁMICO 👇 */
                    alt="Opción Común"
                    className="vs-animate"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                {/* Círculo VS Central (Se superpone usando absolute) */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)', /* Centrado perfecto matemático */
                  width: '40px', /* Reducido de 60px a 40px */
                  height: '40px',
                  backgroundColor: '#ffffff',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FF8B6F',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                  zIndex: 10
                }}>
                  <span style={{
                    fontSize: '1.3rem', /* Letra más grande */
                    WebkitTextStroke: '1px #FF8B6F', /* Lo hace más grueso de forma artificial */
                    marginTop: '4px' /* Lo empuja un poco hacia abajo para centrarlo visualmente */
                  }}>
                    VS
                  </span>
                </div>

                {/* Caja Derecha */}
                <div className="vs-box">
                  <img
                    key={`vs-right-${vsSlideIndex}`}
                    src={vsSlidesData[vsSlideIndex].right.startsWith('http') ? vsSlidesData[vsSlideIndex].right : `${process.env.PUBLIC_URL}/diseno/${vsSlidesData[vsSlideIndex].right}`} /* 👇 NOMBRE DINÁMICO 👇 */
                    alt="Nuestra App"
                    className="vs-animate"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

              </div>

              {/* Flecha Derecha (Ahora con acción de React) */}
              <div className="vs-arrow-btn" onClick={handleNextVsSlide}>
                &#10095;
              </div>

            </div>

            {/* Botón Descubre la diferencia (Responsivo) */}
            <div className="discover-btn" style={{
              backgroundColor: '#FF8B6F',
              color: '#ffffff',
              borderRadius: '50px',
              boxShadow: '0 6px 20px rgba(217,135,115,0.4)',
              cursor: 'pointer',
              textAlign: 'center',
              marginTop: '0.5rem'
            }}>
              Descubre la Diferencia
            </div>

          </div>

          {/* Quinto Bloque / Carrusel de Marcas (B2B) */}
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2rem',
            marginBottom: '0.2rem'
          }}>

            {/* Título Estilo Píldora Gris (Responsivo y Negrita Forzada) */}
            <div className="brands-title" style={{
              border: '1px solid #000000',
              backgroundColor: 'rgba(250, 250, 250, 0.66)', /* Fondo gris clarito con 66% de opacidad que tú ajustaste */
              color: '#000000',
              padding: '6px 20px', /* Relleno ajustado */
              borderRadius: '50px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              whiteSpace: 'nowrap', /* Fuerza a que todo el texto se mantenga en 1 sola línea */
              textAlign: 'center'
            }}>
              Empresas con las que trabajamos
            </div>

            {/* Carrusel Deslizable Infinito */}
            <div className="marquee-container">
              <div className="marquee-track">

                {/* 
                  TRUCO DE BUCLE PERFECTO:
                  Aquí pones 1, 2, 3 o las marcas que tengas.
                  El Array(10).fill(...).flat() las multiplicará mágicamente para crear una cinta infinita,
                  así pongas 1 sola imagen, llenará la pantalla y dará vueltas sin parar.
                */}
                {Array(20).fill([
                  'wala 900x900.png',
                  // Puedes agregar 'logo_2.png', 'logo_3.png' separándolos por comas
                ]).flat().map((imagen, index) => (
                  <div key={index} className="logo-circle-wrapper">
                    <div className="logo-circle" style={{
                      flexShrink: 0,
                      width: '90px',
                      height: '90px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #ffffff', /* Borde grueso y blanco como las cajas anteriores */
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.15)', /* Sombra para que resalte el borde blanco sobre fondos claros */
                      overflow: 'hidden'
                    }}>
                      <img
                        src={`${process.env.PUBLIC_URL}/diseno/${imagen}`}
                        alt={`Logo Empresa ${index}`}
                        style={{ width: '70%', height: '70%', objectFit: 'contain' }}
                      />
                    </div>
                  </div>
                ))}

              </div>
            </div>

          </div>

          {/* Sexto Bloque / Lienzo de Superposición Libre (Collage) */}
          <div className="kapi-collage-container">

            {/* 1. Componente: kapi.png (Fondo Izquierdo) */}
            <div style={{
              position: 'absolute',
              top: '0%',   /* 👈 JUEGA CON ESTE VALOR (arriba/abajo) */
              left: '2%',  /* 👈 JUEGA CON ESTE VALOR (izquierda/derecha) */
              width: '85%', /* 👈 TAMAÑO DE LA IMAGEN */
              zIndex: 1    /* 👈 ORDEN DE CAPAS (1 está más al fondo) */
            }}>
              <img
                src={`${process.env.PUBLIC_URL}/diseno/kapi.png`}
                alt="Kapi"
                style={{ width: '100%', objectFit: 'contain' }}
              />
            </div>

            {/* 2. Componente: Texto (Frente Superior Centro) */}
            <div className="kapi-text-box-mobile" style={{
              position: 'absolute',
              top: '5%',  /* 👈 JUEGA CON ESTE VALOR */
              left: '46%', /* 👈 JUEGA CON ESTE VALOR */
              width: '60%',
              zIndex: 3    /* 👈 ORDEN DE CAPAS (3 está hasta el frente) */
            }}>
              <h3 className="text-block-general kapi-text-1" style={{ textAlign: 'left', color: '#000000', margin: '0', lineHeight: '1.2' }}>
                Toma la decisión de regalar diferente
              </h3>
              <p className="text-block-general kapi-text-2" style={{ textAlign: 'left', maxWidth: '100%', color: '#FF8B6F', fontWeight: 'bold', margin: '0', lineHeight: '1.2' }}>
                ¡Y llévate S/15 de regalos hoy mismo!
              </p>
              <p className="text-block-general kapi-text-3" style={{ textAlign: 'left', maxWidth: '100%', color: '#000000', margin: '0', lineHeight: '1.1' }}>
                Descarga la app de Wala y empieza<br />
                a crear regalos con verdadero significado.<br />
                Al completar tus fechas importantes,<br />
                recibirás S/.15 en KapiCoins como<br />
                regalo de Bienvenida.
              </p>
            </div>

            {/* 3. Componente: 15 kapi.png (Frente Inferior Derecho) */}
            <div style={{
              position: 'absolute',
              bottom: '17%', /* 👈 JUEGA CON ESTE VALOR (0% es pegado abajo) */
              right: '12%',  /* 👈 JUEGA CON ESTE VALOR */
              width: '24%',
              zIndex: 2    /* 👈 ORDEN DE CAPAS (2 está en el medio de los 3) */
            }}>
              <img
                src={`${process.env.PUBLIC_URL}/diseno/15 kapi.png`}
                alt="15 Kapi"
                style={{ width: '100%', objectFit: 'contain' }}
              />
            </div>

          </div>

          {/* SÉPTIMO BLOQUE: BOTÓN DE DESCARGA (REEMPLAZADO POR IMAGEN) */}
          <div className="download-section">
            <a href="#" target="_blank" rel="noopener noreferrer" className="download-img-wrapper">
              <img
                src={`${process.env.PUBLIC_URL}/diseno/dfdf.png`}
                alt="Descarga la App"
                style={{ width: '100%', height: 'auto', cursor: 'pointer', objectFit: 'contain' }}
              />
            </a>
          </div>

          {/* OCTAVO BLOQUE: FRANJA DE TEXTO */}
          <div style={{
            marginTop: '-13rem',
            marginBottom: '1rem',
            width: '100%', /* 100% de la pantalla */
            backgroundColor: 'rgba(217, 135, 115, 0.66)', /* Fondo Salmón con Opacidad */
            padding: '1rem 5%',
            display: 'flex',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          }}>
            <h2 className="banner-line1" style={{
              margin: 0,
              color: '#000000',
              fontWeight: 'bold',
              textAlign: 'center'
            }}>
              Ellos ya están Regalando <br />
              <span className="banner-line2">
                Momentos inolvidables...
              </span>
            </h2>
          </div>

          {/* NOVENO BLOQUE: SLIDER DE TARJETAS */}
          <div style={{
            width: '100%',
            maxWidth: '1000px',
            padding: '0 1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '15px',
              width: '100%'
            }}>
              {/* Flecha Izquierda */}
              <div className="vs-arrow-btn" onClick={handlePrevReview}>
                &#10094;
              </div>

              {/* Tarjetas Visibles (3 a la vez) */}
              <div style={{
                display: 'flex',
                gap: '15px',
                width: '100%',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {[0, 1, 2].map((offset) => {
                  const reviewIndex = (reviewsSlideIndex + offset) % reviewsData.length;
                  const review = reviewsData[reviewIndex];
                  return (
                    <div key={review.id + '-' + offset} className="review-card" style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '5px',
                      border: '2px solid #FF8B6F', /* Borde del color principal */
                      flex: '1 1 30%', /* Garantiza que siempre quepan 3 */
                      minWidth: '0', /* Quitamos el límite para pantallas pequeñas */
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      {/* Zona Superior: Fondo del color principal */}
                      <div className="review-img-wrapper" style={{
                        width: '100%',
                        backgroundColor: '#ffffff',
                      }}>
                        <div className="review-img" style={{
                          width: '100%',
                          backgroundColor: '#FF8B6F',
                          backgroundImage: `url('${review.image}')`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          borderRadius: '4px',
                          boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                          marginBottom: '-5px',
                        }} />
                      </div>

                      {/* Zona de Texto (5 partes) */}
                      <div className="review-text-zone" style={{ color: '#000000', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                        {/* Partes 1 y 2: Lugar y Fecha */}
                        <div className="review-meta" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                          <span>{review.location}</span>
                          <span>{review.date}</span>
                        </div>

                        {/* Parte 3: Título */}
                        <h3 className="review-title" style={{ margin: 0, fontWeight: '900', textAlign: 'center' }}>
                          {review.title}
                        </h3>

                        {/* Parte 4: Reseña */}
                        <p className="review-desc" style={{ margin: 0, textAlign: 'center' }}>
                          {review.review}
                        </p>

                        {/* Parte 5: Estrellas */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: 'auto' }}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className="review-star" fill="#f1a257ff" color="#f1a257ff" />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Flecha Derecha */}
              <div className="vs-arrow-btn" onClick={handleNextReview}>
                &#10095;
              </div>
            </div>
          </div>

          {/* DÉCIMO BLOQUE: ¡ENCUÉNTRANOS! */}
          <div style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: '1rem',
            marginBottom: '2rem'
          }}>
            <h2 className="enc-main-title">
              ¡ENCUÉNTRANOS!
            </h2>

            <div className="enc-container">
              {/* Franja */}
              <div className="enc-banner">

                {/* PRIMERA PARTE (Izquierda) - COMBINADO */}
                <div className="enc-izq">
                  {/* División 1 en vertical (Franja Blanca - más delgada) */}
                  <div className="enc-franja-blanca">
                    {/* Guiones (40%) */}
                    <div className="enc-guiones">
                      - - - - - - - - - - - - - - - - - - - - -
                    </div>
                    {/* Ícono de Ubicación */}
                    <img
                      src={`${process.env.PUBLIC_URL}/diseno/ubicación.png`}
                      alt="Ubicación"
                      className="enc-white-icon"
                    />
                    {/* Texto */}
                    <span className="enc-white-text">
                      Visita nuestra Fisica de:
                    </span>
                  </div>

                  {/* División 2 en vertical (80%) */}
                  <div className="enc-sub-container">
                    {/* Primera subdivision izquierda inferior (20%) */}
                    <div className="enc-sub-izq">
                      <span className="enc-no-llegues">
                        ¡No llegues <br className="hide-mobile" /> tarde!...
                      </span>
                    </div>
                    {/* Segunda subdivision derecha inferior (70%) */}
                    <div className="enc-sub-der">
                      <span className="enc-horario">
                        Lunes a Viernes 9am a 6pm
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center', gap: '5px', marginLeft: '10px' }}>
                        {/* Botón Izquierdo */}
                        <div className="vs-arrow-btn enc-btn" style={{ position: 'static', transform: 'none' }}>
                          &#10094;
                        </div>

                        {/* Caja de Imagen */}
                        <div className="enc-caja-img" style={{ overflow: 'hidden' }}>
                          <img src={`https://picsum.photos/400/400?random=20`} alt="Tienda Wala" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>

                        {/* Botón Derecho */}
                        <div className="vs-arrow-btn enc-btn" style={{ position: 'static', transform: 'none' }}>
                          &#10095;
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SEGUNDA PARTE (Derecha) - VISTA DEL MAPA */}
                <div className="enc-der">
                  {/* Google Maps Embed */}
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d975.8504224873767!2d-77.06130106375515!3d-11.94666653232308!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9105d1f845a69fad%3A0x9087d0a48380741b!2sCon%20Amor%20Market!5e0!3m2!1ses-419!2spe!4v1778832509730!5m2!1ses-419!2spe"
                    width="100%"
                    height="100%"
                    style={{ border: 0, borderRadius: '18px', minHeight: '100px', boxShadow: '0 0 8px rgba(0,0,0,0.4)' }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Ubicación Con Amor Market"
                  ></iframe>
                </div>

              </div>

              {/* Imagen de Kapi */}
              <div className="enc-kapi-container">
                <img
                  src={`${process.env.PUBLIC_URL}/diseno/ya.png`}
                  alt="Kapi mascot"
                  className="enc-kapi-img"
                />
              </div>
            </div>
          </div>

        </div>

      </div>
    </>
  );
};

export default NuevosUsuariosPage;
