import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { GlassCard } from '../../components/ui';
import { T } from '../../i18n/useTranslatedText';
import { obtenerDirecciones, guardarDirecciones, MAX_DIRECCIONES } from '../../services/direcciones';
import styles from './MisDireccionesPage.module.css';

const CIUDADES = { Lima: 'Lima Metropolitana', Callao: 'Callao', Provincias: 'Otras Provincias' };
const VACIA = { customerName: '', docType: 'DNI', dni: '', phone: '', country: 'PE', city: 'Lima', district: '', address: '' };

// Mismos mínimos que el checkout, para que una dirección guardada siempre sirva.
const validar = (d) => {
  if (d.customerName.trim().length < 3) return 'Escribe el nombre de quien recibe.';
  if (d.dni.trim().length < 6) return 'Escribe un número de documento válido.';
  if (d.phone.replace(/\D/g, '').length < 6) return 'Escribe un teléfono válido.';
  if (!d.district.trim()) return 'Escribe el distrito.';
  if (d.address.trim().length < 5) return 'Escribe la dirección exacta.';
  return null;
};

/**
 * Libreta de direcciones de la cuenta (wala_direcciones/{uid}). El checkout
 * muestra la principal como tarjeta "Enviar a" y deja elegir otra.
 */
// Destinatario completo: nombre, documento y teléfono.
const destinatarioCompleto = (d) => !!(d.customerName.trim() && d.dni.trim() && d.phone.trim());

const MisDireccionesPage = () => {
  const { user, userProfile } = useAuth();
  const toast = useGlobalToast();
  const [lista, setLista] = useState(null);
  const [editando, setEditando] = useState(null); // null | 'nueva' | id
  const [form, setForm] = useState(VACIA);
  const [guardando, setGuardando] = useState(false);
  // Quien recibe casi siempre es el mismo cliente: sus datos vienen del perfil y
  // se muestran resumidos; los campos solo aparecen si toca "Cambiar".
  const [editarDestinatario, setEditarDestinatario] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    obtenerDirecciones(user.uid)
      .then(setLista)
      .catch(() => { setLista([]); toast.error('No pudimos cargar tus direcciones.'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const persistir = async (nueva, mensaje) => {
    setGuardando(true);
    try {
      setLista(await guardarDirecciones(user.uid, nueva));
      if (mensaje) toast.success(mensaje);
      return true;
    } catch (e) {
      toast.error('No se pudo guardar. Inténtalo de nuevo.');
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const abrir = (d) => {
    const base = d ? { ...VACIA, ...d } : {
      ...VACIA,
      customerName: userProfile?.displayName || user?.displayName || '',
      docType: userProfile?.docType || 'DNI',
      dni: userProfile?.dni || '',
      phone: userProfile?.phone || '',
    };
    setForm(base);
    setEditarDestinatario(!destinatarioCompleto(base));
    setEditando(d ? d.id : 'nueva');
  };

  const guardarFormulario = async (e) => {
    e.preventDefault();
    const error = validar(form);
    if (error) { toast.error(error); return; }
    let nueva;
    if (editando === 'nueva') {
      const primera = lista.length === 0;
      nueva = [...lista, { ...form, id: undefined, principal: primera }];
    } else {
      nueva = lista.map((d) => (d.id === editando ? { ...d, ...form } : d));
    }
    if (await persistir(nueva, 'Dirección guardada.')) setEditando(null);
  };

  const hacerPrincipal = (id) =>
    persistir(lista.map((d) => ({ ...d, principal: d.id === id })), 'Dirección principal actualizada.');

  const eliminar = (d) => {
    if (!window.confirm(`¿Eliminar la dirección de ${d.customerName}?`)) return;
    const resto = lista.filter((x) => x.id !== d.id);
    // Si se borra la principal, la primera que quede pasa a serlo (lo hace el servicio).
    persistir(resto, 'Dirección eliminada.');
  };

  const campo = (nombre) => ({
    name: nombre,
    value: form[nombre],
    onChange: (e) => setForm((f) => ({ ...f, [nombre]: e.target.value })),
  });

  if (lista === null) {
    return <GlassCard variant="solid" padding="lg" animate={false}><p className={styles.vacio}><T>Cargando tus direcciones…</T></p></GlassCard>;
  }

  return (
    <div className={styles.pagina}>
      <GlassCard variant="solid" padding="lg" animate={false}>
        <div className={styles.cardHeader}>
          <div className={styles.headerIcon}><MapPin size={18} aria-hidden="true" /></div>
          <h2><T>Mis direcciones</T></h2>
        </div>

        {lista.length === 0 && editando === null && (
          <p className={styles.vacio}>
            Aún no tienes direcciones guardadas. Se guarda sola en tu primera compra, o agrégala aquí.
          </p>
        )}

        <div className={styles.lista}>
          {lista.map((d) => (
            <div key={d.id} className={`${styles.item} ${d.principal ? styles.itemPrincipal : ''}`}>
              <div className={styles.itemTexto}>
                <p className={styles.itemNombre}>
                  {d.customerName}
                  {d.principal && <span className={styles.etiqueta}>Principal</span>}
                </p>
                <p>{d.address}</p>
                <p>{d.district}, {CIUDADES[d.city] || d.city}</p>
                <p className={styles.itemDato}>{d.docType} {d.dni} · {d.phone}</p>
              </div>
              <div className={styles.itemAcciones}>
                {!d.principal && (
                  <button type="button" className={styles.enlace} disabled={guardando} onClick={() => hacerPrincipal(d.id)}>
                    Usar como principal
                  </button>
                )}
                <button type="button" className={styles.icono} disabled={guardando} onClick={() => abrir(d)} aria-label="Editar dirección">
                  <Pencil size={16} />
                </button>
                <button type="button" className={styles.icono} disabled={guardando} onClick={() => eliminar(d)} aria-label="Eliminar dirección">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {editando !== null ? (
          <form className={`${styles.formulario} ${lista.length === 0 ? styles.formularioSolo : ''}`} onSubmit={guardarFormulario}>
            <p className={styles.formTitulo}>{editando === 'nueva' ? 'Nueva dirección' : 'Editar dirección'}</p>
            {!editarDestinatario ? (
              <div className={styles.destinatario}>
                <div className={styles.destinatarioTexto}>
                  <span className={styles.destinatarioEtiqueta}>Recibe</span>
                  <strong>{form.customerName}</strong>
                  <span>{form.docType} {form.dni} · {form.phone}</span>
                </div>
                <button type="button" className={styles.enlace} onClick={() => setEditarDestinatario(true)}>
                  Cambiar
                </button>
              </div>
            ) : (
            <>
            <label className={styles.campo}>
              <span>Nombre de quien recibe</span>
              <input {...campo('customerName')} autoComplete="name" />
            </label>
            <div className={styles.fila}>
              <label className={styles.campo}>
                <span>Documento</span>
                <div className={styles.doc}>
                  <select {...campo('docType')}>
                    <option value="DNI">DNI</option>
                    <option value="CE">Carnet de Extranjería</option>
                    <option value="Pasaporte">Pasaporte</option>
                  </select>
                  <input {...campo('dni')} inputMode="numeric" />
                </div>
              </label>
              <label className={styles.campo}>
                <span>Teléfono</span>
                <input {...campo('phone')} type="tel" autoComplete="tel-national" />
              </label>
            </div>
            </>
            )}
            <div className={styles.fila}>
              <label className={styles.campo}>
                <span>Ciudad / Región</span>
                <select {...campo('city')}>
                  {Object.entries(CIUDADES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className={styles.campo}>
                <span>Distrito</span>
                <input {...campo('district')} autoComplete="address-level2" />
              </label>
            </div>
            <label className={styles.campo}>
              <span>Dirección exacta</span>
              <input {...campo('address')} autoComplete="street-address" placeholder="Avenida, Calle, Nro, Dpto, Referencia" />
            </label>
            <div className={styles.botones}>
              <button type="button" className={styles.secundario} onClick={() => setEditando(null)} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className={styles.principal} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar dirección'}
              </button>
            </div>
          </form>
        ) : lista.length < MAX_DIRECCIONES && (
          <button type="button" className={styles.agregar} onClick={() => abrir(null)}>
            <Plus size={18} aria-hidden="true" /> Agregar dirección
          </button>
        )}
      </GlassCard>
    </div>
  );
};

export default MisDireccionesPage;
