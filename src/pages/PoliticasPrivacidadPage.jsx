import React from 'react';
import styles from './PoliticasPrivacidad.module.css';

const PoliticasPrivacidadPage = () => {
  return (
    <div className={styles.container}>


      <header className={styles.header}>
        <h1 className={styles.title}>Política de Privacidad</h1>
        <p className={styles.lastUpdated}>Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </header>

      <main className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Introducción</h2>
          <p className={styles.paragraph}>
            En <strong>WALÁ</strong> ("nosotros", "nuestro", "la Aplicación"), respetamos profundamente su privacidad y nos comprometemos a proteger sus datos personales. Esta Política de Privacidad explica cómo recopilamos, utilizamos, compartimos y protegemos su información cuando utiliza nuestra aplicación móvil (Android/iOS) y nuestro entorno web.
          </p>
          <p className={styles.paragraph}>
            Al descargar, acceder o utilizar nuestra Plataforma, usted acepta las prácticas descritas en esta política. Si no está de acuerdo con ellas, por favor no utilice nuestros servicios.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Información que Recopilamos</h2>
          <p className={styles.paragraph}>
            Para brindar un servicio de comercio electrónico y personalización de productos funcional, recopilamos los siguientes tipos de información:
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}><strong>Datos de Identificación y Contacto:</strong> Nombre, apellidos, dirección de correo electrónico y número de teléfono proporcionados durante el registro (vía formulario o proveedores de autenticación como Google/Google Play).</li>
            <li className={styles.listItem}><strong>Datos de Facturación y Envío:</strong> Direcciones de entrega y datos fiscales necesarios para el procesamiento de sus pedidos.</li>
            <li className={styles.listItem}><strong>Datos de Contenido y Personalización:</strong> Imágenes subidas, diseños personalizados y configuraciones elegidas en nuestro editor para crear sus pedidos especiales.</li>
            <li className={styles.listItem}><strong>Datos del Dispositivo y Uso (Permisos):</strong> 
              <br/>- <em>Audio/Micrófono:</em> Si elige utilizar la función de búsqueda por voz dentro de la aplicación, requeriremos acceso temporal a su micrófono. El audio no se graba ni se almacena de forma permanente, solo se utiliza en tiempo real para procesar su búsqueda.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Uso de la Información</h2>
          <p className={styles.paragraph}>
            Utilizamos su información personal estrictamente para los siguientes propósitos:
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}>Gestionar su cuenta, procesar sus compras, pagos y entregar sus productos personalizados.</li>
            <li className={styles.listItem}>Brindar soporte técnico y atención al cliente.</li>
            <li className={styles.listItem}>Gestionar el acceso a nuestro sistema de recompensas ("Walá Coins") y sistema de Referidos ("Mis Referidos").</li>
            <li className={styles.listItem}>Enviar notificaciones transaccionales sobre el estado de su pedido o avisos importantes de la aplicación.</li>
            <li className={styles.listItem}>Garantizar la seguridad de la plataforma y prevenir actividades fraudulentas.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Compartición de la Información</h2>
          <p className={styles.paragraph}>
            No vendemos, alquilamos ni comercializamos sus datos personales. Solo compartimos información con terceros de confianza que son estrictamente esenciales para el funcionamiento del servicio:
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}><strong>Proveedores de Servicios Cloud:</strong> Utilizamos Google Cloud y Firebase (Google) para alojar nuestra base de datos, imágenes de manera segura y gestionar la autenticación.</li>
            <li className={styles.listItem}><strong>Pasarelas de Pago:</strong> Proveedores financieros autorizados encargados de procesar pagos de forma encriptada. (WALÁ no almacena números de tarjetas de crédito).</li>
            <li className={styles.listItem}><strong>Logística:</strong> Empresas de transporte para poder entregar su producto físico en la dirección indicada.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Retención y Eliminación de Datos</h2>
          <p className={styles.paragraph}>
            Usted tiene el derecho absoluto de acceder, rectificar o eliminar sus datos personales en cualquier momento.
          </p>
          <p className={styles.paragraph}>
            Si desea eliminar su cuenta y borrar por completo su historial de pedidos, diseños guardados y monedas acumuladas, puede solicitarlo enviándonos un correo a nuestro equipo de soporte. Todo dato personal será eliminado de nuestros servidores, exceptuando aquellos documentos financieros que la ley nos obligue a conservar por periodos fiscales determinados.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Privacidad de Menores</h2>
          <p className={styles.paragraph}>
            Nuestra aplicación y servicio no están dirigidos a niños menores de 13 años. No recopilamos conscientemente información personal de menores. Si descubrimos que un menor nos ha proporcionado información personal, procederemos a eliminarla inmediatamente de nuestros servidores.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>7. Cambios en la Política de Privacidad</h2>
          <p className={styles.paragraph}>
            Nos reservamos el derecho de actualizar esta política en cualquier momento para reflejar cambios en nuestras prácticas o exigencias legales. Le notificaremos sobre cambios significativos a través de un aviso destacado en nuestra aplicación o web antes de que el cambio entre en vigencia.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>8. Contacto</h2>
          <p className={styles.paragraph}>
            Si tiene alguna pregunta, inquietud o solicitud relacionada con esta Política de Privacidad o sus datos, no dude en contactarnos:
          </p>
          <div className={styles.contactBox}>
            <p><strong>Equipo de Soporte WALÁ</strong></p>
            <p>Correo electrónico: amorwala0@gmail.com</p>
            <p>Atención continua a través de nuestra App / Portal Web (Sección WhatsApp).</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default PoliticasPrivacidadPage;
