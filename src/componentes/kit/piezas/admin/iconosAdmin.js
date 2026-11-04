import {
  Home, Package, CreditCard, BookOpen, LayoutGrid, Shirt, Tag, Layers, Store, SlidersHorizontal,
  Truck, Target, BarChart3, Eye, Users, MessageCircle, Wrench, Share2, Gift, ListChecks,
  Trophy, Bell, CalendarHeart, ClipboardList, Megaphone, Ticket, Repeat, Link2, MessageSquare, PanelsTopLeft,
  Palette, Brush, Paintbrush, Star, PawPrint, SpellCheck, Disc3, FlaskConical, Settings, ShieldCheck,
  MessageCircleMore, History,
} from 'lucide-react';

/*
 * Los íconos del menú del admin por nombre (adaptadoresAdmin.js los nombra
 * sin importarlos, para poder probarse solo). Un ícono que no está aquí
 * cae en el del grupo o en LayoutGrid.
 */
export const ICONOS_ADMIN = {
  inicio: Home,
  pedidos: Package,
  pagos: CreditCard,
  reclamos: BookOpen,
  catalogo: LayoutGrid,
  productos: Shirt,
  categorias: Tag,
  colecciones: Layers,
  marcas: Store,
  atributos: SlidersHorizontal,
  envios: Truck,
  recomendar: Target,
  resultados: BarChart3,
  visitantes: Eye,
  clientes: Users,
  opiniones: MessageCircle,
  tecnico: Wrench,
  referidos: Share2,
  recompensas: Gift,
  misiones: ListChecks,
  retos: Trophy,
  notificaciones: Bell,
  fechas: CalendarHeart,
  encuesta: ClipboardList,
  campanas: Megaphone,
  sorteos: Ticket,
  suscripcion: Repeat,
  enlaces: Link2,
  popups: MessageSquare,
  landings: PanelsTopLeft,
  temas: Palette,
  diseno: Brush,
  editar: Paintbrush,
  destacados: Star,
  kapi: PawPrint,
  palabra: SpellCheck,
  ruleta: Disc3,
  bolitas: FlaskConical,
  ajustes: Settings,
  admins: ShieldCheck,
  whatsapp: MessageCircleMore,
  historial: History,
};

export const iconoAdmin = (nombre, respaldo) => ICONOS_ADMIN[nombre] || ICONOS_ADMIN[respaldo] || LayoutGrid;
