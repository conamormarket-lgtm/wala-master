import { useMemo } from 'react';
import {
  User,
  Package,
  Truck,
  Gift,
  Ticket,
  Trophy,
  Users,
  Sparkles,
  Heart,
  Calendar,
  Settings,
} from 'lucide-react';

// Fuente única de "todas las opciones a donde se quiere dirigir" dentro de
// /cuenta: la usan tanto CuentaLayout (sidebar de escritorio + selector
// móvil) como CuentaResumenPage (grilla de accesos directos, la que ve el
// usuario apenas entra). Antes vivía solo dentro de CuentaLayout — al
// duplicarla en la grilla, un ítem nuevo (o una ruta que cambia) quedaba
// desincronizado entre los dos lugares.
export const useCuentaNavGroups = () => {
  return useMemo(() => ([
    {
      label: 'account.grupoCuenta',
      labelFallback: 'Cuenta',
      items: [
        { to: '/cuenta/perfil', labelKey: 'account.perfil', label: 'Mi Perfil', icon: User },
        { to: '/cuenta/pedidos', labelKey: 'account.misPedidos', label: 'Mis Pedidos', icon: Package },
        { to: '/cuenta/rastreo', labelKey: 'account.rastreo', label: 'Rastreo del Pedido', icon: Truck },
        { to: '/cuenta/ajustes', labelKey: 'account.ajustes', label: 'Ajustes', icon: Settings },
      ],
    },
    {
      label: 'account.grupoRecompensas',
      labelFallback: 'Recompensas',
      items: [
        { to: '/cuenta/catalogo', labelKey: 'account.catalogo', label: 'Catálogo Recompensas', icon: Gift },
        { to: '/cuenta/cupones', labelKey: 'account.cupones', label: 'Mis Cupones', icon: Ticket },
        { to: '/cuenta/misiones', labelKey: 'account.misiones', label: 'Misiones', icon: Trophy },
        { to: '/cuenta/referidos', labelKey: 'account.referidos', label: 'Mis Referidos', icon: Users },
      ],
    },
    {
      label: 'account.grupoPersonalizacion',
      labelFallback: 'Personalización',
      items: [
        { to: '/cuenta/creaciones', labelKey: 'account.creaciones', label: 'Mis Creaciones', icon: Sparkles },
        { to: '/cuenta/wishlist', labelKey: 'account.wishlist', label: 'Lista de Deseos', icon: Heart },
        { to: '/cuenta/fechas-importantes', labelKey: 'account.fechas', label: 'Fechas Importantes', icon: Calendar },
      ],
    },
  ]), []);
};

export default useCuentaNavGroups;
