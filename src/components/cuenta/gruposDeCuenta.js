import { useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useCuentaNavGroups } from '../../pages/cuenta/useCuentaNavGroups';

/*
 * Los grupos de la cuenta para el kit (MenuCuenta lateral y AccesosCuenta),
 * desde la misma fuente que el menú de siempre (useCuentaNavGroups): los
 * textos pasan por el diccionario (t) y cada grupo lleva el tono de su sello.
 */

// Cuenta violeta, Recompensas oro, Personalización rosa (CUENTA.md).
const TONOS = {
  'account.grupoCuenta': 'degradado',
  'account.grupoRecompensas': 'oro',
  'account.grupoPersonalizacion': 'rosa',
};

export function useGruposDeCuenta() {
  const { t } = useLanguage();
  const grupos = useCuentaNavGroups();
  return useMemo(() => grupos.map((g) => ({
    titulo: t(g.label, g.labelFallback),
    tono: TONOS[g.label] || 'degradado',
    items: g.items.map((it) => ({ to: it.to, texto: t(it.labelKey, it.label), Icono: it.icon })),
  })), [grupos, t]);
}

/** Qué esqueleto de /cuenta toca mientras carga la sesión (EsqueletoPagina forma="cuenta"). */
const MODULOS = {
  perfil: 'perfil',
  pedidos: 'pedidos',
  direcciones: 'direcciones',
  ajustes: 'ajustes',
  catalogo: 'catalogo',
  cupones: 'cupones',
  misiones: 'misiones',
  referidos: 'referidos',
  creaciones: 'creaciones',
  wishlist: 'deseos',
  'fechas-importantes': 'fechas',
};

export const moduloDeRuta = (ruta) => MODULOS[String(ruta || '').split('/')[2]] || 'resumen';

/** La ruta sin la barra final ("/cuenta/" → "/cuenta"). */
export const rutaLimpia = (ruta) => String(ruta || '').replace(/\/+$/, '') || '/';
