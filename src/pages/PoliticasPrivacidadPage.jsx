import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import styles from './PoliticasPrivacidad.module.css';
import { T } from '../i18n/useTranslatedText';

// Fecha del último cambio REAL del texto, escrita a mano.
// Antes esto era `new Date()`, así que el documento decía haberse actualizado
// HOY cada día que alguien lo abría: en un texto legal eso no es un detalle
// estético, es una fecha falsa. Al tocar el contenido, cambia esta línea.
const ULTIMA_ACTUALIZACION = '8 de septiembre de 2026';

const PoliticasPrivacidadPage = () => {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <p className={styles.eyebrow}><T>Legal</T></p>
        <h1 className={styles.title}><T>Política de Privacidad</T></h1>
        <p className={styles.lastUpdated}><T>Última actualización</T>: {ULTIMA_ACTUALIZACION}</p>
      </header>

      <main className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><T>1. Introducción</T></h2>
          <p className={styles.paragraph}>
            En <strong><T>WALÁ</T></strong> ("nosotros", "nuestro", "la Aplicación"), respetamos profundamente su privacidad y nos comprometemos a proteger sus datos personales. Esta Política de Privacidad explica cómo recopilamos, utilizamos, compartimos y protegemos su información cuando utiliza nuestra aplicación móvil (Android/iOS) y nuestro entorno web.
          </p>
          <p className={styles.paragraph}>
            <T>{'Al descargar, acceder o utilizar nuestra Plataforma, usted acepta las prácticas descritas en esta política. Si no está de acuerdo con ellas, por favor no utilice nuestros servicios.'}</T>
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><T>2. Información que Recopilamos</T></h2>
          <p className={styles.paragraph}>
            <T>{'Para brindar un servicio de comercio electrónico y personalización de productos funcional, recopilamos los siguientes tipos de información:'}</T>
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}><strong><T>Datos de Identificación y Contacto:</T></strong> <T>Nombre, apellidos, dirección de correo electrónico y número de teléfono proporcionados durante el registro (vía formulario o proveedores de autenticación como Google/Google Play).</T></li>
            <li className={styles.listItem}><strong><T>Datos de Facturación y Envío:</T></strong> <T>Direcciones de entrega y datos fiscales necesarios para el procesamiento de sus pedidos.</T></li>
            <li className={styles.listItem}><strong><T>Datos de Contenido y Personalización:</T></strong> <T>Imágenes subidas, diseños personalizados y configuraciones elegidas en nuestro editor para crear sus pedidos especiales.</T></li>
            <li className={styles.listItem}><strong><T>Datos del Dispositivo y Uso (Permisos):</T></strong> 
              <br/>- <em><T>Audio/Micrófono:</T></em> Si elige utilizar la función de búsqueda por voz dentro de la aplicación, requeriremos acceso temporal a su micrófono. El audio no se graba ni se almacena de forma permanente, solo se utiliza en tiempo real para procesar su búsqueda.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><T>3. Uso de la Información</T></h2>
          <p className={styles.paragraph}>
            <T>{'Utilizamos su información personal estrictamente para los siguientes propósitos:'}</T>
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}><T>Gestionar su cuenta, procesar sus compras, pagos y entregar sus productos personalizados.</T></li>
            <li className={styles.listItem}><T>Brindar soporte técnico y atención al cliente.</T></li>
            <li className={styles.listItem}><T>Gestionar el acceso a nuestro sistema de recompensas ("Monedas") y sistema de Referidos ("Mis Referidos").</T></li>
            <li className={styles.listItem}><T>Enviar notificaciones transaccionales sobre el estado de su pedido o avisos importantes de la aplicación.</T></li>
            <li className={styles.listItem}><T>Garantizar la seguridad de la plataforma y prevenir actividades fraudulentas.</T></li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><T>4. Compartición de la Información</T></h2>
          <p className={styles.paragraph}>
            <T>{'No vendemos, alquilamos ni comercializamos sus datos personales. Solo compartimos información con terceros de confianza que son estrictamente esenciales para el funcionamiento del servicio:'}</T>
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}><strong><T>Proveedores de Servicios Cloud:</T></strong> <T>Utilizamos Google Cloud y Firebase (Google) para alojar nuestra base de datos, imágenes de manera segura y gestionar la autenticación.</T></li>
            <li className={styles.listItem}><strong><T>Pasarelas de Pago:</T></strong> <T>Proveedores financieros autorizados encargados de procesar pagos de forma encriptada. (WALÁ no almacena números de tarjetas de crédito).</T></li>
            <li className={styles.listItem}><strong><T>Logística:</T></strong> <T>Empresas de transporte para poder entregar su producto físico en la dirección indicada.</T></li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><T>5. Retención y Eliminación de Datos</T></h2>
          <p className={styles.paragraph}>
            <T>{'Usted tiene el derecho absoluto de acceder, rectificar o eliminar sus datos personales en cualquier momento.'}</T>
          </p>
          <p className={styles.paragraph}>
            <T>{'Si desea eliminar su cuenta y borrar por completo su historial de pedidos, diseños guardados y monedas acumuladas, puede solicitarlo enviándonos un correo a nuestro equipo de soporte. Todo dato personal será eliminado de nuestros servidores, exceptuando aquellos documentos financieros que la ley nos obligue a conservar por periodos fiscales determinados.'}</T>
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><T>6. Privacidad de Menores</T></h2>
          <p className={styles.paragraph}>
            <T>{'Nuestra aplicación y servicio no están dirigidos a niños menores de 13 años. No recopilamos conscientemente información personal de menores. Si descubrimos que un menor nos ha proporcionado información personal, procederemos a eliminarla inmediatamente de nuestros servidores.'}</T>
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}><T>7. Cambios en la Política de Privacidad</T></h2>
          <p className={styles.paragraph}>
            <T>{'Nos reservamos el derecho de actualizar esta política en cualquier momento para reflejar cambios en nuestras prácticas o exigencias legales. Le notificaremos sobre cambios significativos a través de un aviso destacado en nuestra aplicación o web antes de que el cambio entre en vigencia.'}</T>
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>8. Contacto</h2>
          <p className={styles.paragraph}>
            <T>{'Si tiene alguna pregunta, inquietud o solicitud relacionada con esta Política de Privacidad o sus datos, no dude en contactarnos:'}</T>
          </p>
          <div className={styles.contactBox}>
            <p><strong><T>Equipo de Soporte WALÁ</T></strong></p>
            <p><T>Correo electrónico: amorwala0@gmail.com</T></p>
            <p><T>Atención continua a través de nuestra App / Portal Web (Sección WhatsApp).</T></p>
          </div>
        </section>
      </main>

      <nav className={styles.pie}>
        <span><T>¿Buscabas las condiciones del servicio?</T></span>
        <Link to="/terminos-y-condiciones" className={styles.pieEnlace}>
          <T>Términos y Condiciones</T>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
};

export default PoliticasPrivacidadPage;
