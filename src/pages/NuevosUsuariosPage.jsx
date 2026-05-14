import React from 'react';
import './NuevosUsuariosPage.module.css';

const NuevosUsuariosPage = () => {
  const [vsSlideIndex, setVsSlideIndex] = React.useState(0);

  // ARREGLO DE PARES DE IMÁGENES PARA EL BLOQUE VS (4 imágenes = 2 pares)
  const vsSlidesData = [
    { left: 'imagen_izquierda_1.png', right: 'imagen_derecha_1.png' },
    { left: 'imagen_izquierda_2.png', right: 'imagen_derecha_2.png' }
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

        /* --- CLASES PARA EL BLOQUE VS --- */
        .vs-arrow-btn {
          width: 45px;
          height: 45px;
          border-radius: 50%;
          background-color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #d98773;
          font-weight: bold;
          font-size: 1.2rem;
          box-shadow: 0 4px 10px rgba(0,0,0,0.15);
          cursor: pointer;
          flex-shrink: 0;
        }

        .vs-box {
          background-color: #d98773;
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
          padding: 1rem;
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
          font-size: 2rem; /* Título Grande para PC */
          color: #000000;
          -webkit-text-stroke: 1px #000000;
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

        /* --- CLASES SEXTO BLOQUE (COLLAGE KAPI) --- */
        .kapi-collage-container {
          position: relative;
          width: 100%;
          max-width: 1000px;
          aspect-ratio: 1000 / 600; /* 👈 Esto hace que el lienzo actúe como una imagen y se reduzca proporcionalmente en celular */
          margin: 0 auto 4rem auto;
        }

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
            width: 30px; /* Flechas más chicas en móvil */
            height: 30px;
            font-size: 0.9rem;
          }
          
          /* --- TERCER BLOQUE TAMAÑOS REDUCIDOS PARA MÓVIL --- */
          .text-block-general {
            font-size: 0.75rem; /* El tamaño general que pusiste en móvil */
          }
          .text-block-title {
            font-size: 1.1rem; /* El tamaño de la primera línea en móvil */
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

          /* --- SEXTO BLOQUE (KAPI COLLAGE) MÓVIL --- */
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
            <p className="text-block-general">
              <strong className="text-block-title"><span style={{ fontFamily: 'Georgia, serif' }}>¿</span>Por qué regalar algo personalizado?</strong> <br />
              Por que hay fechas que merecen más que un <strong style={{ color: '#000000', WebkitTextStroke: '0.8px #000000' }}>regalo</strong> <br />
              de último minuto. Un detalle <strong style={{ color: '#000000', WebkitTextStroke: '0.8px #000000' }}>personalizado</strong> se usa, <br />
              se abraza y <strong style={{ color: '#000000', WebkitTextStroke: '0.8px #000000' }}>se guarda para siempre</strong>.
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
                    src={`${process.env.PUBLIC_URL}/diseno/${vsSlidesData[vsSlideIndex].left}`} /* 👇 NOMBRE DINÁMICO 👇 */
                    alt="Opción Común"
                    className="vs-animate"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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
                  color: '#d98773',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                  zIndex: 10
                }}>
                  <span style={{
                    fontSize: '1.3rem', /* Letra más grande */
                    WebkitTextStroke: '1px #d98773', /* Lo hace más grueso de forma artificial */
                    marginTop: '4px' /* Lo empuja un poco hacia abajo para centrarlo visualmente */
                  }}>
                    VS
                  </span>
                </div>

                {/* Caja Derecha */}
                <div className="vs-box">
                  <img
                    key={`vs-right-${vsSlideIndex}`}
                    src={`${process.env.PUBLIC_URL}/diseno/${vsSlidesData[vsSlideIndex].right}`} /* 👇 NOMBRE DINÁMICO 👇 */
                    alt="Nuestra App"
                    className="vs-animate"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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
              backgroundColor: '#d98773',
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
            marginBottom: '4rem'
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
                {Array(10).fill([
                  'logo_1.png',
                  // Puedes agregar 'logo_2.png', 'logo_3.png' separándolos por comas
                ]).flat().map((imagen, index) => (
                  <div key={index} className="logo-circle-wrapper">
                    <div className="logo-circle" style={{
                      flexShrink: 0,
                      width: '90px',
                      height: '90px',
                      backgroundColor: '#ffffff',
                      border: '6px solid #ffffff', /* Borde grueso y blanco como las cajas anteriores */
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
              top: '1%',   /* 👈 JUEGA CON ESTE VALOR (arriba/abajo) */
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
              top: '1%',  /* 👈 JUEGA CON ESTE VALOR */
              left: '45%', /* 👈 JUEGA CON ESTE VALOR */
              width: '50%',
              zIndex: 3    /* 👈 ORDEN DE CAPAS (3 está hasta el frente) */
            }}>
              <h3 className="text-block-title" style={{ textAlign: 'left', margin: '0 0 1rem 0' }}>
                El toque perfecto
              </h3>
              <p className="text-block-general" style={{ textAlign: 'left', maxWidth: '100%' }}>
                Este es un lienzo libre. Cambiando los porcentajes de "top" y "left" en el código puedes mover este texto libremente sobre Kapi y la otra imagen hasta lograr la superposición exacta que deseas.
              </p>
            </div>

            {/* 3. Componente: 15 kapi.png (Frente Inferior Derecho) */}
            <div style={{
              position: 'absolute',
              bottom: '0%', /* 👈 JUEGA CON ESTE VALOR (0% es pegado abajo) */
              right: '50%',  /* 👈 JUEGA CON ESTE VALOR */
              width: '40%',
              zIndex: 2    /* 👈 ORDEN DE CAPAS (2 está en el medio de los 3) */
            }}>
              <img
                src={`${process.env.PUBLIC_URL}/diseno/15 kapi.png`}
                alt="15 Kapi"
                style={{ width: '100%', objectFit: 'contain' }}
              />
            </div>

          </div>

        </div>

      </div>
    </>
  );
};

export default NuevosUsuariosPage;
