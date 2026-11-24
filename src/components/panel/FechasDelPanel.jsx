import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getFechasFestivas, saveFechasFestivas, FESTIVAS_QUERY_KEY,
  getRecordatorioPersonal, saveRecordatorioPersonal, RECORDATORIO_QUERY_KEY, probarAvisoFechas,
} from '../../services/fechasFestivas';
import {
  getUserDates, getSuggestedPackages, saveSuggestedPackage, updateSuggestedPackage, deleteSuggestedPackage,
} from '../../services/fechasImportantes';
import { useProducts } from '../../hooks/useProducts';
import { useGiftCatalog } from '../../hooks/useGiftCatalog';
import { normalizarFestiva, normalizarDiasAviso, hoyLocal } from '../../utils/fechasFestivas.mjs';
import { PaginaFechasAdmin } from '../../componentes/kit/paginas/admin/Fechas';
import {
  fechaClienteDesde, paqueteDesdeFirestore, paqueteAFirestore, paquetesDeFecha, cambiosAlElegir,
  siguienteElegido, productoAdminDesde,
} from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useInvalidar } from './comun';

/*
 * /admin/fechas-importantes (D5c): el calendario, las fechas festivas con sus
 * avisos y las fechas de los clientes con sus paquetes. Los mismos servicios,
 * claves e invalidaciones que AdminFechasImportantesPage y
 * components/admin/fechas/* (GlobalCalendarView, FechasFestivasView,
 * UsuariosView, PackageCreatorModal); ?ver= elige la pestaña.
 * Los productos de un paquete se guardan con las claves de antes (id, name,
 * price, image), como PackageCreatorModal: nunca con las del kit.
 */

const PESTANAS = ['calendario', 'festivas', 'clientes'];
// UsuariosView y PackageCreatorModal no usaban React Query: claves nuevas, solo del admin.
const CLAVE_FECHAS = ['admin-fechas-usuarios'];
const CLAVE_PAQUETES = ['admin-paquetes-sugeridos'];

/*
 * Un producto del paquete como lo guardaba PackageCreatorModal. Lo que se
 * agrega desde el catálogo va con su precio de lista y su primera foto
 * (p.price, p.images[0]); lo que ya estaba en el paquete se guarda tal cual
 * estaba (antes se perdía la foto: buscaba images en un producto guardado).
 */
const productoDePaquete = (crudoDe) => (x) => {
  const p = crudoDe.get(x);
  if (p) return { id: p.id, name: p.name, price: p.price, image: p.images?.[0] || '' };
  return { id: x.id, name: x.nombre, price: x.precio, image: x.imagen || '' };
};

export default function FechasDelPanel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pestana = PESTANAS.includes(searchParams.get('ver')) ? searchParams.get('ver') : 'calendario';
  const queryClient = useQueryClient();
  const invalidar = useInvalidar();
  const hoy = hoyLocal();

  // Fechas festivas (FechasFestivasView): si no se pudo leer, no se deja editar (guardar pisaría lo que haya).
  const festivas = useQuery({
    queryKey: ['admin-fechas-festivas'],
    queryFn: () => sinError(getFechasFestivas()),
    staleTime: 0,
  });
  // Los días de aviso de las fechas de cada persona (AvisosPersonales).
  const recordatorio = useQuery({
    queryKey: ['admin-recordatorio-personal'],
    queryFn: () => sinError(getRecordatorioPersonal()),
    staleTime: 0,
  });

  // Las fechas que anotaron los clientes y sus paquetes (UsuariosView). Los dos
  // servicios no fallan: si algo sale mal devuelven [] (como antes). El
  // calendario también las muestra, así que se leen en todas las pestañas.
  const filas = useQuery({ queryKey: CLAVE_FECHAS, queryFn: getUserDates });
  const paquetesCrudos = useQuery({ queryKey: CLAVE_PAQUETES, queryFn: getSuggestedPackages });

  // La fila de getUserDates de cada fecha, para armar la persona como PackageCreatorModal.
  const { fechas, crudaDe } = useMemo(() => {
    const mapa = new Map();
    const lista = (filas.data || []).map((r) => {
      const f = fechaClienteDesde(r, hoy);
      mapa.set(f.id, r);
      return f;
    });
    return { fechas: lista, crudaDe: mapa };
  }, [filas.data, hoy]);
  const paquetes = useMemo(() => (paquetesCrudos.data || []).map(paqueteDesdeFirestore), [paquetesCrudos.data]);

  // El catálogo de PackageCreatorModal (getProducts(), la misma caché que el
  // buscador de regalos). Antes se pedía al abrir el modal: ahora, en Clientes.
  const enClientes = pestana === 'clientes';
  const catalogo = useProducts([], null, { enabled: enClientes });
  const { recomendar } = useGiftCatalog({ activo: enClientes });
  const { productos, crudoDe, porId } = useMemo(() => {
    const crudos = new Map();
    const ids = new Map();
    const lista = (catalogo.data || []).map((p) => {
      const x = productoAdminDesde(p);
      if (x) { crudos.set(x, p); ids.set(p.id, x); }
      return x;
    }).filter(Boolean);
    return { productos: lista, crudoDe: crudos, porId: ids };
  }, [catalogo.data]);
  const aFirestore = productoDePaquete(crudoDe);
  const refrescarPaquetes = () => invalidar(CLAVE_PAQUETES);

  return (
    <PaginaFechasAdmin
      pestana={pestana}
      onPestana={(p) => navigate(p === 'calendario' ? '/admin/fechas-importantes' : `/admin/fechas-importantes?ver=${p}`)}
      hoy={hoy}
      festivas={festivas.data || []}
      cargandoFestivas={festivas.isLoading}
      errorFestivas={festivas.error ? `No se pudo cargar el calendario: ${festivas.error.message}` : undefined}
      onReintentarFestivas={() => festivas.refetch()}
      onGuardarFestivas={async (lista) => {
        await sinError(saveFechasFestivas(lista));
        queryClient.setQueryData(['admin-fechas-festivas'], lista.map(normalizarFestiva));
        await invalidar(FESTIVAS_QUERY_KEY);
      }}
      diasAviso={recordatorio.data || []}
      // Sin poder leerlos, el campo queda apagado (como antes).
      cargandoDiasAviso={recordatorio.isLoading || Boolean(recordatorio.error)}
      onGuardarDiasAviso={async (dias) => {
        const nuevos = normalizarDiasAviso(dias);
        await sinError(saveRecordatorioPersonal(nuevos));
        queryClient.setQueryData(['admin-recordatorio-personal'], nuevos);
        await invalidar(RECORDATORIO_QUERY_KEY);
      }}
      onProbarAviso={async (id) => {
        const r = await sinError(probarAvisoFechas(id));
        return { titulo: r?.titulo, cuerpo: r?.cuerpo, imagen: r?.image, tieneApp: r?.tieneApp, push: r?.push };
      }}
      fechas={fechas}
      paquetes={paquetes}
      cargandoFechas={filas.isLoading || paquetesCrudos.isLoading}
      errorFechas={filas.error || paquetesCrudos.error ? 'No se pudieron cargar las fechas de los clientes.' : undefined}
      onReintentarFechas={() => { filas.refetch(); paquetesCrudos.refetch(); }}
      productos={productos}
      sugerirProductos={async (f) => {
        // La persona como la espera el buscador, con los nombres de getUserDates (PackageCreatorModal).
        const d = crudaDe.get(f.id) || {};
        const persona = {
          roleKey: d.recipientRoleKey || d.roleKey,
          gender: d.recipientGender || d.gender,
          budget: d.recipientBudget || d.budget,
          selectedCategories: d.selectedCategories || [],
          categoryAnswers: d.categoryAnswers || {},
        };
        return recomendar(persona, { ocasion: d.eventType || '', limite: 3 })
          .map((x) => porId.get(x.producto?.id) || productoAdminDesde(x.producto))
          .filter(Boolean);
      }}
      onGuardarPaquete={async (lista, f, id) => {
        const products = lista.map(aFirestore);
        if (id) await updateSuggestedPackage(id, { products });
        // El primero de la fecha sale elegido (isFirstPackage).
        else await saveSuggestedPackage({ ...paqueteAFirestore(lista, f, paquetesDeFecha(paquetes, f).length === 0), products });
        await refrescarPaquetes();
      }}
      onElegirPaquete={async (paquete, f) => {
        // Uno por uno, como UsuariosView: el elegido a true y el que estaba elegido a false.
        try {
          for (const c of cambiosAlElegir(paquetesDeFecha(paquetes, f), paquete.id)) {
            await updateSuggestedPackage(c.id, { isSelected: c.elegido });
          }
        } finally {
          await refrescarPaquetes();
        }
      }}
      onEliminarPaquete={async (paquete, f) => {
        // Si era el elegido, el siguiente de la misma fecha pasa a elegido.
        const siguiente = siguienteElegido(paquetesDeFecha(paquetes, f), paquete);
        try {
          await deleteSuggestedPackage(paquete.id);
          if (siguiente) await updateSuggestedPackage(siguiente, { isSelected: true });
        } finally {
          await refrescarPaquetes();
        }
      }}
    />
  );
}
