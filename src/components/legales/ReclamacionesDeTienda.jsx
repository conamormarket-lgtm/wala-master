import React, { useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createDocument } from '../../services/firebase/firestore';
import { empresa } from '../../config/empresa';
import { COUNTRIES } from '../../constants/countries';
import { limaTodayStr } from '../../utils/fechaLima';
import { tieneCuenta } from '../../utils/rutaPrivada';
import { PaginaReclamaciones } from '../../componentes/kit/paginas/Reclamaciones';
import { perfilDesdeUsuario } from '../../componentes/kit/adaptadores';

/*
 * El libro de reclamaciones (/libro-de-reclamaciones) con el kit (paso 6,
 * LEGALES.md). Público, como pide la ley: sin cuenta se llena vacío; con
 * cuenta llega con el nombre, el documento, el celular y el correo.
 *
 * Guarda el mismo documento de antes en libro_reclamaciones (lo lee el admin
 * en /admin/libro-reclamaciones): el código WALA-AAAAMMDD-NNNN, estado
 * 'pendiente', la copia de la empresa, el consumidor, el bien y el reclamo.
 * Nuevo: el país. Fuera del Perú el documento va como 'OTRO' (como en el
 * perfil) y el teléfono con el código del país.
 * Lo de antes: pages/LibroReclamacionesViejo.jsx (interruptor legalesViejo).
 */

const PAISES = COUNTRIES.map((c) => ({ valor: c.code, texto: c.name, prefijo: c.dialCode }));
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const enPalabras = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
};

const generarCodigo = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `WALA-${y}${m}${d}-${rand}`;
};

export default function ReclamacionesDeTienda() {
  const { user, userProfile, loading } = useAuth();
  const hoy = enPalabras(limaTodayStr());
  const conCuenta = tieneCuenta(user) && userProfile && !userProfile._perfilNoCargado;

  const inicial = useMemo(() => {
    if (!conCuenta) return {};
    const p = perfilDesdeUsuario(userProfile, user);
    return {
      nombre: p.nombre,
      pais: p.pais,
      tipoDocumento: p.tipoDocumento === 'OTRO' ? 'DNI' : p.tipoDocumento,
      documento: p.documento,
      telefono: p.telefono,
      email: user.email || '',
    };
  }, [conCuenta]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async (datos) => {
    const peru = (datos.pais || 'PE') === 'PE';
    const prefijo = PAISES.find((p) => p.valor === datos.pais)?.prefijo || '';
    const telefono = String(datos.telefono || '').trim();
    const codigo = generarCodigo();
    const { error } = await createDocument('libro_reclamaciones', {
      codigo,
      estado: 'pendiente', // pendiente | respondido
      // Proveedor (copia, por si los datos legales cambian luego)
      proveedor: {
        razonSocial: empresa.razonSocial,
        ruc: empresa.ruc,
        domicilioFiscal: empresa.domicilioFiscal,
      },
      consumidor: {
        nombre: String(datos.nombre || '').trim(),
        tipoDocumento: peru ? (datos.tipoDocumento || 'DNI') : 'OTRO',
        numeroDocumento: String(datos.documento || '').trim(),
        domicilio: String(datos.domicilio || '').trim(),
        telefono: peru ? telefono.replace(/\D/g, '') : `${prefijo} ${telefono}`.trim(),
        email: datos.email,
        esMenor: Boolean(datos.esMenor),
        apoderado: datos.esMenor ? String(datos.apoderado || '').trim() : null,
      },
      bien: {
        tipo: datos.tipoBien, // producto | servicio
        montoReclamado: datos.monto == null ? null : Number(datos.monto),
        descripcion: String(datos.descripcion || '').trim(),
      },
      reclamo: {
        tipo: datos.tipoReclamo, // reclamo | queja
        detalle: String(datos.detalle || '').trim(),
        pedido: String(datos.pedido || '').trim(),
      },
      respuestaProveedor: null,
    });
    if (error) {
      console.warn('[Libro de reclamaciones] guardar:', error);
      throw new Error('No pudimos registrar tu reclamación. Revisa tu conexión e inténtalo otra vez. Si sigue fallando, escríbenos por WhatsApp.');
    }
    return { codigo, fecha: hoy };
  };

  return (
    <PaginaReclamaciones
      // Al llegar la cuenta, la hoja se llena con sus datos.
      key={conCuenta ? user.uid : 'sin-cuenta'}
      estado={loading ? 'cargando' : undefined}
      empresa={empresa}
      hoy={hoy}
      inicial={inicial}
      paises={PAISES}
      urlPrivacidad="/politicas-privacidad"
      urlTienda="/"
      onEnviar={enviar}
    />
  );
}
