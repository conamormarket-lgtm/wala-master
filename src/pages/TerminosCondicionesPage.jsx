import React from 'react';
import styles from './PoliticasPrivacidad.module.css';
import { T } from '../i18n/useTranslatedText';

const TerminosCondicionesPage = () => {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}><T>Términos y Condiciones</T></h1>
        <p className={styles.lastUpdated}>Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </header>

      <main className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><T>1. Introducción</T></h2>
          <p className={styles.paragraph}>
            Bienvenido a <strong><T>WALÁ</T></strong>. Al acceder o utilizar nuestra aplicación y sitio web, aceptas cumplir y estar sujeto a los siguientes Términos y Condiciones. Te rogamos que los leas detenidamente antes de utilizar nuestro servicio. Si no estás de acuerdo con estos términos, no debes usar la aplicación.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><T>2. Uso de la Aplicación</T></h2>
          <p className={styles.paragraph}>
            <T>{'Nuestra plataforma te permite personalizar, visualizar y adquirir productos físicos (Print on Demand). Al utilizar nuestros servicios, te comprometes a:'}</T>
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}><T>Proporcionar información verdadera, precisa y actualizada al registrarte y realizar compras.</T></li>
            <li className={styles.listItem}><T>No subir, crear ni compartir contenido que sea ilegal, ofensivo, difamatorio, que infrinja derechos de autor de terceros o que sea inapropiado. Nos reservamos el derecho de rechazar diseños que incumplan esta norma.</T></li>
            <li className={styles.listItem}><T>No utilizar la plataforma para fines ilícitos o no autorizados.</T></li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Compras y Pagos</h2>
          <p className={styles.paragraph}>
            <T>{'Al realizar un pedido, te comprometes a pagar el precio total especificado, incluyendo impuestos y gastos de envío aplicables.'}</T>
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}><T>Todos los pagos se procesan a través de pasarelas seguras.</T></li>
            <li className={styles.listItem}><T>Una vez que el pedido ha pasado a producción (al ser productos personalizados), no se podrán realizar cancelaciones ni modificaciones.</T></li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><T>4. Envíos y Entregas</T></h2>
          <p className={styles.paragraph}>
            <T>{'Nos esforzamos por cumplir con los plazos de entrega estimados mostrados al momento de la compra. Sin embargo, factores externos (como servicios de mensajería) pueden causar demoras ocasionales. WALÁ no se hace responsable por retrasos imputables a las agencias de transporte o causas de fuerza mayor.'}</T>
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Devoluciones y Reembolsos</h2>
          <p className={styles.paragraph}>
            {/* La clausula va ENTERA dentro de <T>. Estaba partida por el
                <strong>: la primera mitad se quedaba en espanol y la
                segunda salia traducida. En una politica de devoluciones
                eso no es un detalle de estilo. */}
            <T>Dado que nuestros productos son creados de manera 100% personalizada según tus especificaciones, no aceptamos devoluciones ni ofrecemos reembolsos por cambios de opinión o errores en la selección de talla/color por parte del cliente.</T>
          </p>
          <p className={styles.paragraph}>
            <T>{'Excepciones: Si el producto llega defectuoso, dañado o el estampado es claramente diferente al diseño final aprobado, te pedimos contactarnos en un plazo máximo de 7 días tras recibirlo para gestionar un reemplazo o reembolso.'}</T>
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Propiedad Intelectual</h2>
          <p className={styles.paragraph}>
            <T>{'Al subir una imagen o diseño a nuestra plataforma, declaras poseer los derechos legales sobre la misma. Nos otorgas una licencia temporal exclusiva para imprimir dicho diseño en tus productos. Todo el contenido nativo de la aplicación (textos, gráficos, logotipos, mockups, etc.) es propiedad exclusiva de WALÁ.'}</T>
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>7. Modificaciones</h2>
          <p className={styles.paragraph}>
            <T>{'Nos reservamos el derecho de modificar o reemplazar estos Términos y Condiciones en cualquier momento. El uso continuado de la aplicación tras cualquier cambio constituye la aceptación de los nuevos términos.'}</T>
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>8. Contacto</h2>
          <p className={styles.paragraph}>
            <T>{'Para cualquier duda respecto a estos Términos y Condiciones, puedes contactarnos en:'}</T>
          </p>
          <div className={styles.contactBox}>
            <p><strong><T>Equipo WALÁ</T></strong></p>
            <p><T>Correo electrónico: amorwala0@gmail.com</T></p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default TerminosCondicionesPage;
