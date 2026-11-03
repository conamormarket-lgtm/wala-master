import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getRuletaPrizes, saveRuletaPrize, deleteRuletaPrize, resetStockPremio,
  getRuletaConfig, saveRuletaConfig, getRuletaWins, marcarPremioEntregado,
} from '../../services/firebase/ruleta';
import { getProducts } from '../../services/products';
import { normalizarConfig } from '../../utils/ruletaModel';
import { limaTodayStr, limaDayOfWeek } from '../../utils/fechaLima';
import { PaginaRuletaAdmin } from '../../componentes/kit/paginas/admin/Ruleta';
import { premioRuletaAFirestore, ganadoRuletaDesde, productoAdminDesde } from '../../componentes/kit/adaptadoresAdmin';
import { useLectura, useInvalidar, subirA } from './comun';

/*
 * La Ruleta semanal (D7b): los premios, cómo se ve y las entregas. Los mismos
 * servicios (services/firebase/ruleta) y payloads que AdminRuletaPage:
 * saveRuletaPrize normaliza el premio y escribe el espejo viejo
 * (name/type/probability/amount); stockUsado lo lleva el servidor.
 *
 * AdminRuletaPage no usaba React Query y leía todo al entrar: las claves son
 * nuevas, solo del admin, y se leen de nuevo cada vez que se abre la página
 * (las entregas, cada vez que se abre su pestaña). La tienda no guarda nada
 * de la ruleta en caché (pide el tablero al servidor al abrirla): no hay
 * claves suyas que invalidar.
 *
 * Los get* de la ruleta no fallan: sin conexión dan [] o la config de casa,
 * como antes.
 */

const CLAVE_PREMIOS = ['admin-ruleta-premios'];
const CLAVE_CONFIG = ['admin-ruleta-config'];
const CLAVE_GANADOS = ['admin-ruleta-ganados'];
const CLAVE_PRODUCTOS = ['admin-ruleta-productos'];

// Se vuelve a leer al entrar, como antes (el valor de casa es una hora en caché).
const FRESCA = { staleTime: 0, refetchOnMount: true };

// La imagen del centro (antes era solo una URL escrita a mano).
const subirImagen = subirA('config/ruleta', 'centro');

/** { success, error } → nada, o lanza el error con su texto. */
async function conExito(promesa) {
  const r = await promesa;
  if (!r?.success) throw new Error(r?.error?.message || (typeof r?.error === 'string' ? r.error : 'No se pudo guardar.'));
}

const textoError = (q) => (q.error ? q.error.message || 'No se pudo cargar.' : undefined);

/**
 * /admin/ruleta: getRuletaPrizes y getRuletaConfig al abrir (ya normalizados
 * por el servicio); los premios ganados (getRuletaWins(200)) solo con la
 * pestaña Entregas abierta. Guardar un premio, borrarlo o reiniciar su
 * contador vuelve a leer premios y config (el cargar() de antes).
 */
export default function RuletaDelPanel() {
  const queryClient = useQueryClient();
  const invalidar = useInvalidar();
  const [pestana, setPestana] = useState('premios');

  const premios = useQuery({ queryKey: CLAVE_PREMIOS, queryFn: () => getRuletaPrizes(), ...FRESCA });
  const config = useQuery({ queryKey: CLAVE_CONFIG, queryFn: () => getRuletaConfig(), ...FRESCA });
  const ganados = useQuery({
    queryKey: CLAVE_GANADOS,
    queryFn: () => getRuletaWins(200),
    enabled: pestana === 'entregas',
    ...FRESCA,
  });
  // El catálogo para elegir el producto del premio, como en Recompensas
  // (getProducts sin ocultos, lo mismo que leía BuscadorProducto).
  const productos = useLectura(CLAVE_PRODUCTOS, () => getProducts(), { staleTime: 5 * 60 * 1000, enabled: pestana === 'premios' });

  const listaProductos = useMemo(() => (productos.datos || []).map(productoAdminDesde).filter(Boolean), [productos.datos]);
  const listaGanados = useMemo(() => (ganados.data || []).map(ganadoRuletaDesde), [ganados.data]);
  const recargar = () => invalidar(CLAVE_PREMIOS, CLAVE_CONFIG);

  return (
    <PaginaRuletaAdmin
      pestana={pestana}
      onPestana={setPestana}
      hoy={limaTodayStr()}
      diaSemana={limaDayOfWeek()}
      // Como antes: la página espera a los premios y a la config.
      cargando={premios.isLoading || config.isLoading}
      error={textoError(premios) || textoError(config)}
      onReintentar={() => { premios.refetch(); config.refetch(); }}
      premios={premios.data || []}
      onGuardarPremio={async (datos, id) => {
        await conExito(saveRuletaPrize(premioRuletaAFirestore(datos), id));
        await recargar();
      }}
      onEliminarPremio={async (id) => {
        await conExito(deleteRuletaPrize(id));
        await recargar();
      }}
      onReiniciarContador={async (id) => {
        await conExito(resetStockPremio(id));
        await recargar();
      }}
      productos={listaProductos}
      subirImagen={subirImagen}
      config={config.data}
      onGuardarConfig={async (c) => {
        await conExito(saveRuletaConfig(c));
        // Lo que quedó escrito (saveRuletaConfig normaliza): así la barra se cierra.
        queryClient.setQueryData(CLAVE_CONFIG, normalizarConfig(c));
      }}
      ganados={listaGanados}
      cargandoGanados={ganados.isLoading}
      errorGanados={textoError(ganados)}
      onReintentarGanados={() => ganados.refetch()}
      onMarcarEntregado={async (id, entregado) => {
        await conExito(marcarPremioEntregado(id, entregado));
        // Como antes: se cambia en la lista, sin volver a leer los 200.
        queryClient.setQueryData(CLAVE_GANADOS, (lista) => (lista || []).map((g) => (g.id === id ? { ...g, entregado } : g)));
      }}
    />
  );
}
