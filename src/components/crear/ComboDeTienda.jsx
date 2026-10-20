import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { renombrarCreacion } from '../../services/designs';
import { publicarEnComunidad, retirarDeComunidad } from '../../services/comunidad';
import { creacionLista } from '../../pages/Crear/creacionCarrito';
import { piezaVacia } from '../../pages/Crear/fotosCombo';
import { fondoColorGuardado } from '../../utils/prendaBase';
import useComboCrear from './useComboCrear';
import { PaginaCombo } from '../../componentes/kit/paginas/Combo';

/*
 * Un combo de Crear (/combo/:id) con el kit (paso 6, CREAR.md P11):
 * PaginaCombo. La lógica es la de ComboCrearViejo, en useComboCrear: el
 * armado en el navegador, ?nuevo / ?plantilla / ?mio, "Mi combo" guardado
 * solo, las tallas (una para el conjunto), y al comprar las prendas de la
 * comunidad se guardan en la cuenta, el combo entra al carrito como una línea
 * y se va al carrito. Aquí solo se pasa a las props del kit: cada prenda
 * (diseñar, editar una copia si otra prenda lleva el mismo diseño, copiar de
 * otra, Mis creaciones, usar en las demás, quitar, renombrar), la galería
 * ("Todo el combo" y los lados de cada prenda) y la comunidad (admins).
 * Diferente: "Agregar al carrito" se activa con los diseños listos y, si
 * falta una talla, la pide en una hoja (antes, el botón esperaba la talla);
 * "N de N listas" cuenta los diseños; la publicación también se actualiza.
 * Lo de antes: pages/Crear/ComboCrearViejo.jsx (interruptor crearViejo).
 */

const PERMISOS = ['superadmin', 'manage_design'];
const HECHO = { publicar: 'Publicada en la comunidad.', actualizar: 'Publicación actualizada.', retirar: 'Retirada de la comunidad.' };

/** El color de una creación para el kit: su nombre y el fondo de la muestra. */
const colorKit = (c) => (c?.nombre ? { nombre: c.nombre, fondo: fondoColorGuardado(c) || c.hex } : undefined);

export default function ComboDeTienda() {
  const c = useComboCrear();
  const { user, isAdmin, adminPermissions } = useAuth();
  const toast = useGlobalToast();
  const queryClient = useQueryClient();
  const uid = user?.uid;

  if (c.cargando) return <PaginaCombo estado="cargando" />;
  if (c.error) return <PaginaCombo estado="error" onReintentar={c.reintentar} />;
  if (!c.disponible) return <PaginaCombo estado="noDisponible" />;

  const { piezas, fotosPiezas: fotos, piezasCombo, miCombo } = c;

  // Lo mismo que el nombre editable de antes: queda al día en la caché.
  const renombrar = async (id, nombre) => {
    const limpio = nombre.trim().slice(0, 60);
    const { error } = await renombrarCreacion(id, limpio);
    if (error) {
      toast.error('No pudimos cambiar el nombre. Inténtalo de nuevo.');
      return;
    }
    queryClient.setQueryData(['creacion', id, uid], (prev) => (prev ? { ...prev, name: limpio } : prev));
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    toast.success('Nombre actualizado.');
  };

  const piezasKit = piezas.map((p, k) => {
    const otra = piezas.find((o) => o.i !== p.i && o.creacion && creacionLista(o.creacion));
    const vaciasIguales = piezas.filter((o) => o.i !== p.i && !o.designId && piezasCombo[o.i].prendaId === piezasCombo[p.i].prendaId).length;
    // Si otra prenda lleva este mismo diseño (combos de antes), o es una
    // creación suelta del cliente (elegida antes de que se copiaran), se edita
    // una copia: cambiarlo aquí no debe cambiar la otra prenda ni la original.
    const compartido = piezas.some((o) => o.i !== p.i && o.designId === p.designId)
      || Boolean(p.creacion && !p.creacion.combo?.id);
    const estado = p.cargando ? 'cargando'
      : p.creacion ? (p.lista ? 'disenada' : p.creacion.estado === 'borrador' ? 'borrador' : 'vieja')
        : p.plantilla ? 'plantilla'
          : p.esperando ? 'cargando' : 'vacia';
    return {
      i: p.i,
      prenda: p.prenda?.name,
      foto: fotos[k]?.lados[0]?.url,
      estado,
      nombre: p.cargando ? p.respaldo?.nombre : p.creacion ? (p.creacion.name || 'Mi creación') : p.plantilla?.nombre,
      color: colorKit(p.creacion?.color || p.plantilla?.color),
      lados: p.creacion ? fotos[k]?.conDiseno || [] : [],
      lista: p.lista,
      agotada: c.agotada(p.prenda),
      tallas: p.tallas,
      talla: p.talla,
      onTalla: (t) => c.ponerEn(p.i, { talla: t }),
      urlDisenar: p.plantilla ? c.urlPlantilla(p.i) : c.urlEstudio(p.i),
      urlEditar: p.designId ? c.urlEstudio(p.i, compartido ? `&copiar=${p.designId}` : `&designId=${p.designId}`) : undefined,
      copiarDe: otra ? { numero: otra.i + 1, url: c.urlEstudio(p.i, `&copiar=${otra.designId}`) } : undefined,
      usarEnLasDemas: vaciasIguales === 1 ? 'la otra' : 'las demás',
      onUsarEnLasDemas: vaciasIguales > 0 ? () => c.usarEnLasDemas(p.i) : undefined,
      onQuitar: p.creacion ? () => c.quitar(p.i) : undefined,
      onRenombrar: p.creacion ? (nombre) => renombrar(p.creacion.id, nombre) : undefined,
    };
  });

  // La galería: primero "Todo el combo" (las prendas juntas), luego los lados
  // de cada prenda. La prenda en blanco va con aire y atenuada.
  const conAire = (k) => (fotos[k]?.origen === 'prenda' ? '6%' : undefined);
  const frentes = piezas.map((p, k) => ({ p, k, url: fotos[k]?.lados[0]?.url })).filter((f) => f.url);
  const galeria = [
    ...(frentes.length ? [{
      nombre: 'Todo el combo',
      corto: 'Combo',
      juntas: frentes.map((f) => ({ url: f.url, relleno: conAire(f.k), atenuada: piezaVacia(f.p) })),
    }] : []),
    ...piezas.flatMap((p, k) => (fotos[k]?.lados || []).map((l) => ({
      url: l.url,
      nombre: `Prenda ${p.i + 1}${l.nombre ? ` · ${l.nombre}` : ''}`,
      corto: l.nombre ? `${p.i + 1} · ${l.nombre}` : `Prenda ${p.i + 1}`,
      pieza: p.i,
      relleno: conAire(k),
      atenuada: piezaVacia(p),
    }))),
  ];

  // "Mi combo": se renombra y, si es admin, se publica en la comunidad.
  const puedePublicar = Boolean(miCombo && user && isAdmin && (adminPermissions || []).some((x) => PERMISOS.includes(x))
    && miCombo.tipo === 'comboCrear' && miCombo.userId === uid && miCombo.estado !== 'borrador');
  const enComunidad = async (accion) => {
    const { error } = accion === 'retirar' ? await retirarDeComunidad(miCombo.id) : await publicarEnComunidad(miCombo.id);
    if (error) {
      toast.error(error);
      throw new Error(error);
    }
    toast.success(HECHO[accion]);
    queryClient.invalidateQueries({ queryKey: ['comunidad'] });
    queryClient.invalidateQueries({ queryKey: ['comunidad-diseno'] });
    queryClient.invalidateQueries({ queryKey: ['mis-creaciones-crear'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['creacion', miCombo.id] });
  };
  const pendientePlantilla = piezas.find((p) => p.plantilla);

  return (
    <PaginaCombo
      combo={{ nombre: c.combo.name, descripcion: c.combo.description, publicado: Boolean(c.combo.publicado) }}
      mio={miCombo ? {
        nombre: miCombo.name || c.combo.name,
        estado: miCombo.estado === 'borrador' ? 'borrador' : 'guardado',
        onRenombrar: (nombre) => renombrar(miCombo.id, nombre),
      } : undefined}
      piezas={piezasKit}
      galeria={galeria}
      precio={c.precio}
      sueltas={c.sueltas}
      unaTalla={c.unaTalla}
      tallas={c.tallasConjunto}
      talla={c.tallaConjunto}
      onTalla={c.elegirTallaConjunto}
      plantilla={pendientePlantilla && c.plantillaCombo ? { nombre: c.plantillaCombo.nombre, urlPersonalizar: c.urlPlantilla(pendientePlantilla.i) } : undefined}
      misCreaciones={uid ? (i) => c.opcionesMias(i).map((d) => ({
        id: d.id, nombre: d.name, imagen: d.vistasPrevias?.[0]?.url || d.imagenConjunta || d.previewUrl,
      })) : undefined}
      onElegirCreacion={c.elegirCreacion}
      onAgregar={c.agregar}
      preparando={c.preparando}
      estadoEnlaces={c.estadoEstudio}
      comunidad={puedePublicar ? {
        estado: miCombo.comunidad || null,
        onPublicar: () => enComunidad('publicar'),
        onActualizar: () => enComunidad('actualizar'),
        onRetirar: () => enComunidad('retirar'),
      } : undefined}
    />
  );
}
