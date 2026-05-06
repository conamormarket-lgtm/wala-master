import React from 'react';
import styles from './PoliticasPrivacidad.module.css';

const TerminosCondicionesPage = () => {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Términos y Condiciones</h1>
        <p className={styles.lastUpdated}>Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </header>

      <main className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Introducción</h2>
          <p className={styles.paragraph}>
            Bienvenido a <strong>WALÁ</strong>. Al acceder o utilizar nuestra aplicación y sitio web, aceptas cumplir y estar sujeto a los siguientes Términos y Condiciones. Te rogamos que los leas detenidamente antes de utilizar nuestro servicio. Si no estás de acuerdo con estos términos, no debes usar la aplicación.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Uso de la Aplicación</h2>
          <p className={styles.paragraph}>
            Nuestra plataforma te permite personalizar, visualizar y adquirir productos físicos (Print on Demand). Al utilizar nuestros servicios, te comprometes a:
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}>Proporcionar información verdadera, precisa y actualizada al registrarte y realizar compras.</li>
            <li className={styles.listItem}>No subir, crear ni compartir contenido que sea ilegal, ofensivo, difamatorio, que infrinja derechos de autor de terceros o que sea inapropiado. Nos reservamos el derecho de rechazar diseños que incumplan esta norma.</li>
            <li className={styles.listItem}>No utilizar la plataforma para fines ilícitos o no autorizados.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Compras y Pagos</h2>
          <p className={styles.paragraph}>
            Al realizar un pedido, te comprometes a pagar el precio total especificado, incluyendo impuestos y gastos de envío aplicables.
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}>Todos los pagos se procesan a través de pasarelas seguras.</li>
            <li className={styles.listItem}>Una vez que el pedido ha pasado a producción (al ser productos personalizados), no se podrán realizar cancelaciones ni modificaciones.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Envíos y Entregas</h2>
          <p className={styles.paragraph}>
            Nos esforzamos por cumplir con los plazos de entrega estimados mostrados al momento de la compra. Sin embargo, factores externos (como servicios de mensajería) pueden causar demoras ocasionales. WALÁ no se hace responsable por retrasos imputables a las agencias de transporte o causas de fuerza mayor.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Devoluciones y Reembolsos</h2>
          <p className={styles.paragraph}>
            Dado que nuestros productos son creados de manera 100% personalizada según tus especificaciones, <strong>no aceptamos devoluciones ni ofrecemos reembolsos por cambios de opinión o errores en la selección de talla/color por parte del cliente</strong>.
          </p>
          <p className={styles.paragraph}>
            Excepciones: Si el producto llega defectuoso, dañado o el estampado es claramente diferente al diseño final aprobado, te pedimos contactarnos en un plazo máximo de 7 días tras recibirlo para gestionar un reemplazo o reembolso.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Propiedad Intelectual</h2>
          <p className={styles.paragraph}>
            Al subir una imagen o diseño a nuestra plataforma, declaras poseer los derechos legales sobre la misma. Nos otorgas una licencia temporal exclusiva para imprimir dicho diseño en tus productos. Todo el contenido nativo de la aplicación (textos, gráficos, logotipos, mockups, etc.) es propiedad exclusiva de WALÁ.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>7. Modificaciones</h2>
          <p className={styles.paragraph}>
            Nos reservamos el derecho de modificar o reemplazar estos Términos y Condiciones en cualquier momento. El uso continuado de la aplicación tras cualquier cambio constituye la aceptación de los nuevos términos.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>8. Contacto</h2>
          <p className={styles.paragraph}>
            Para cualquier duda respecto a estos Términos y Condiciones, puedes contactarnos en:
          </p>
          <div className={styles.contactBox}>
            <p><strong>Equipo WALÁ</strong></p>
            <p>Correo electrónico: amorwala0@gmail.com</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default TerminosCondicionesPage;
