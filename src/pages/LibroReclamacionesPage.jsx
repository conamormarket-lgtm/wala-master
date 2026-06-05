import React, { useState } from 'react';
import { createDocument } from '../services/firebase/firestore';
import { empresa } from '../config/empresa';
import styles from './LibroReclamaciones.module.css';

const initialForm = {
  // Consumidor
  nombre: '',
  tipoDocumento: 'DNI',
  numeroDocumento: '',
  domicilio: '',
  telefono: '',
  email: '',
  esMenor: false,
  apoderado: '',
  // Bien contratado
  tipoBien: 'producto',
  montoReclamado: '',
  descripcionBien: '',
  // Reclamo / Queja
  tipoReclamo: 'reclamo',
  detalle: '',
  pedido: '',
  // Aceptación
  aceptaVeracidad: false,
};

const generarCodigo = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `WALA-${y}${m}${d}-${rand}`;
};

const LibroReclamacionesPage = () => {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null); // { codigo }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const validar = () => {
    if (!form.nombre.trim()) return 'Ingresa tu nombre completo.';
    if (!form.numeroDocumento.trim()) return 'Ingresa tu número de documento.';
    if (!form.domicilio.trim()) return 'Ingresa tu domicilio.';
    if (!form.telefono.trim()) return 'Ingresa un teléfono de contacto.';
    if (!form.email.trim() || !form.email.includes('@')) return 'Ingresa un correo electrónico válido.';
    if (form.esMenor && !form.apoderado.trim()) return 'Para menores de edad, indica el nombre del padre/madre o apoderado.';
    if (!form.descripcionBien.trim()) return 'Describe el producto o servicio contratado.';
    if (!form.detalle.trim()) return 'Detalla tu reclamo o queja.';
    if (!form.pedido.trim()) return 'Indica tu pedido o lo que esperas como solución.';
    if (!form.aceptaVeracidad) return 'Debes declarar la veracidad de la información para continuar.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validar();
    if (v) { setError(v); return; }

    setLoading(true);
    setError(null);

    const codigo = generarCodigo();
    const payload = {
      codigo,
      estado: 'pendiente', // pendiente | respondido
      // Proveedor (snapshot, por si los datos legales cambian luego)
      proveedor: {
        razonSocial: empresa.razonSocial,
        ruc: empresa.ruc,
        domicilioFiscal: empresa.domicilioFiscal,
      },
      // Consumidor
      consumidor: {
        nombre: form.nombre.trim(),
        tipoDocumento: form.tipoDocumento,
        numeroDocumento: form.numeroDocumento.trim(),
        domicilio: form.domicilio.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim().toLowerCase(),
        esMenor: form.esMenor,
        apoderado: form.esMenor ? form.apoderado.trim() : null,
      },
      // Bien contratado
      bien: {
        tipo: form.tipoBien, // producto | servicio
        montoReclamado: form.montoReclamado ? Number(form.montoReclamado) : null,
        descripcion: form.descripcionBien.trim(),
      },
      // Detalle
      reclamo: {
        tipo: form.tipoReclamo, // reclamo | queja
        detalle: form.detalle.trim(),
        pedido: form.pedido.trim(),
      },
      respuestaProveedor: null,
    };

    const { id, error: dbError } = await createDocument('libro_reclamaciones', payload);

    if (dbError) {
      setError(`No se pudo registrar tu reclamación: ${dbError}`);
      setLoading(false);
      return;
    }

    setResultado({ codigo, id });
    setLoading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (resultado) {
    return (
      <div className={styles.container}>
        <div className={styles.success}>
          <div className={styles.successIcon}>✅</div>
          <h1 className={styles.successTitle}>¡Reclamación registrada!</h1>
          <p className={styles.successText}>
            Tu hoja de reclamación ha sido registrada correctamente. Guarda tu código de seguimiento:
          </p>
          <div className={styles.codeBox}>{resultado.codigo}</div>
          <p className={styles.successText}>
            Te responderemos al correo <strong>{form.email}</strong> en un plazo máximo de{' '}
            <strong>{empresa.plazoRespuestaDiasHabiles} días hábiles</strong>, conforme al Código de
            Protección y Defensa del Consumidor (INDECOPI).
          </p>
          <button
            className={styles.secondaryBtn}
            onClick={() => { setForm(initialForm); setResultado(null); }}
          >
            Registrar otra reclamación
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.book}>📕</span>
        <div>
          <h1 className={styles.title}>Libro de Reclamaciones</h1>
          <p className={styles.subtitle}>
            Conforme al Código de Protección y Defensa del Consumidor (Ley N° 29571) – INDECOPI
          </p>
        </div>
      </div>

      <div className={styles.empresaBox}>
        <strong>{empresa.razonSocial}</strong><br />
        RUC: {empresa.ruc}<br />
        Domicilio: {empresa.domicilioFiscal}<br />
        Hoja de Reclamación N° <em>(se genera automáticamente al enviar)</em>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} noValidate>
        {/* 1. Identificación del consumidor */}
        <div className={styles.legend}>1. Identificación del consumidor reclamante</div>
        <div className={styles.grid}>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label}>Nombre completo <span className={styles.req}>*</span></label>
            <input className={styles.input} name="nombre" value={form.nombre} onChange={handleChange} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Tipo de documento <span className={styles.req}>*</span></label>
            <select className={styles.select} name="tipoDocumento" value={form.tipoDocumento} onChange={handleChange}>
              <option value="DNI">DNI</option>
              <option value="CE">Carné de Extranjería</option>
              <option value="Pasaporte">Pasaporte</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>N° de documento <span className={styles.req}>*</span></label>
            <input className={styles.input} name="numeroDocumento" value={form.numeroDocumento} onChange={handleChange} />
          </div>

          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label}>Domicilio <span className={styles.req}>*</span></label>
            <input className={styles.input} name="domicilio" value={form.domicilio} onChange={handleChange} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Teléfono <span className={styles.req}>*</span></label>
            <input className={styles.input} name="telefono" value={form.telefono} onChange={handleChange} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Correo electrónico <span className={styles.req}>*</span></label>
            <input className={styles.input} type="email" name="email" value={form.email} onChange={handleChange} />
          </div>

          <div className={`${styles.checkRow} ${styles.fieldFull}`}>
            <input type="checkbox" id="esMenor" name="esMenor" checked={form.esMenor} onChange={handleChange} />
            <label htmlFor="esMenor">El consumidor es menor de edad</label>
          </div>
          {form.esMenor && (
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label}>Nombre del padre/madre o apoderado <span className={styles.req}>*</span></label>
              <input className={styles.input} name="apoderado" value={form.apoderado} onChange={handleChange} />
            </div>
          )}
        </div>

        {/* 2. Bien contratado */}
        <div className={styles.legend}>2. Identificación del bien contratado</div>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.label}>Tipo <span className={styles.req}>*</span></label>
            <select className={styles.select} name="tipoBien" value={form.tipoBien} onChange={handleChange}>
              <option value="producto">Producto</option>
              <option value="servicio">Servicio</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Monto reclamado (S/) <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional)</span></label>
            <input className={styles.input} type="number" step="0.01" min="0" name="montoReclamado" value={form.montoReclamado} onChange={handleChange} />
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label}>Descripción del producto / servicio <span className={styles.req}>*</span></label>
            <textarea className={styles.textarea} name="descripcionBien" value={form.descripcionBien} onChange={handleChange} placeholder="Ej. Polo personalizado talla M, pedido #1234" />
          </div>
        </div>

        {/* 3. Detalle de la reclamación */}
        <div className={styles.legend}>3. Detalle de la reclamación</div>
        <div className={styles.radioRow}>
          <label className={`${styles.radioOption} ${form.tipoReclamo === 'reclamo' ? styles.active : ''}`}>
            <input type="radio" name="tipoReclamo" value="reclamo" checked={form.tipoReclamo === 'reclamo'} onChange={handleChange} />
            <span>
              <strong>Reclamo</strong>
              <span className={styles.radioHint}>Disconformidad con el producto o servicio recibido.</span>
            </span>
          </label>
          <label className={`${styles.radioOption} ${form.tipoReclamo === 'queja' ? styles.active : ''}`}>
            <input type="radio" name="tipoReclamo" value="queja" checked={form.tipoReclamo === 'queja'} onChange={handleChange} />
            <span>
              <strong>Queja</strong>
              <span className={styles.radioHint}>Malestar respecto a la atención al cliente.</span>
            </span>
          </label>
        </div>

        <div className={styles.grid} style={{ marginTop: 16 }}>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label}>Detalle <span className={styles.req}>*</span></label>
            <textarea className={styles.textarea} name="detalle" value={form.detalle} onChange={handleChange} placeholder="Describe con el mayor detalle lo sucedido." />
          </div>
          <div className={`${styles.field} ${styles.fieldFull}`}>
            <label className={styles.label}>Pedido del consumidor <span className={styles.req}>*</span></label>
            <textarea className={styles.textarea} name="pedido" value={form.pedido} onChange={handleChange} placeholder="¿Qué solución esperas? (cambio, reembolso, etc.)" />
          </div>
        </div>

        <div className={styles.checkRow}>
          <input type="checkbox" id="aceptaVeracidad" name="aceptaVeracidad" checked={form.aceptaVeracidad} onChange={handleChange} />
          <label htmlFor="aceptaVeracidad">
            Declaro que la información proporcionada es verídica y autorizo el uso de mis datos para
            atender la presente reclamación, según la Política de Privacidad.
          </label>
        </div>

        <button type="submit" className={styles.submit} disabled={loading}>
          {loading ? 'Registrando…' : 'Enviar reclamación'}
        </button>

        <p className={styles.note}>
          La formulación del reclamo no impide acudir a otras vías de solución de controversias ni
          es requisito previo para presentar una denuncia ante INDECOPI.
        </p>
      </form>
    </div>
  );
};

export default LibroReclamacionesPage;
