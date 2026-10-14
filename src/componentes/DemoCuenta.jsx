import React, { useCallback, useMemo, useState } from 'react';
import { User, Package, MapPin, Settings, Gift, Ticket, Trophy, Users, Sparkles, Heart, Calendar } from 'lucide-react';
import {
  MarcoCuenta, PaginaCuentaInvitado, PaginaResumenCuenta, PaginaPerfil, PaginaDirecciones, PaginaAjustes, PaginaPedidos,
} from './kit';
import { DEPARTAMENTOS, getProvincias } from '../constants/peruUbigeo';
import { distritosSugeridos, lugarLegible } from '../utils/ubicacionErp';

/*
 * "Mi cuenta" de la Tienda de prueba: las páginas de /cuenta dentro de
 * MarcoCuenta (menú lateral en escritorio, accesos en el celular). Los
 * números (C0, C1…) son los de kit/guia/CUENTA.md.
 * Datos inventados (no son de un cliente real); el ubigeo sí es el de la
 * tienda (constants/peruUbigeo y utils/ubicacionErp).
 */

/* Los mismos accesos que useCuentaNavGroups, con el tono del sello por grupo. */
export const GRUPOS_CUENTA_COMPLETO = [
  { titulo: 'Cuenta', tono: 'degradado', items: [
    { to: '/cuenta/perfil', texto: 'Mi perfil', Icono: User },
    { to: '/cuenta/pedidos', texto: 'Mis pedidos', Icono: Package },
    { to: '/cuenta/direcciones', texto: 'Mis direcciones', Icono: MapPin },
    { to: '/cuenta/ajustes', texto: 'Ajustes', Icono: Settings },
  ] },
  { titulo: 'Recompensas', tono: 'oro', items: [
    { to: '/cuenta/catalogo', texto: 'Catálogo de recompensas', Icono: Gift },
    { to: '/cuenta/cupones', texto: 'Mis cupones', Icono: Ticket, cuenta: 2 },
    { to: '/cuenta/misiones', texto: 'Misiones', Icono: Trophy },
    { to: '/cuenta/referidos', texto: 'Mis referidos', Icono: Users },
  ] },
  { titulo: 'Personalización', tono: 'rosa', items: [
    { to: '/cuenta/creaciones', texto: 'Mis creaciones', Icono: Sparkles },
    { to: '/cuenta/wishlist', texto: 'Lista de deseos', Icono: Heart },
    { to: '/cuenta/fechas-importantes', texto: 'Fechas importantes', Icono: Calendar },
  ] },
];

/** Módulos de /cuenta armados en la demo, con su número de la guía. */
export const MODULOS_CUENTA = [
  { ruta: '/cuenta', texto: 'Resumen', n: 'C1', componente: 'PaginaResumenCuenta' },
  { ruta: '/cuenta/perfil', texto: 'Mi perfil', n: 'C2', componente: 'PaginaPerfil' },
  { ruta: '/cuenta/pedidos', texto: 'Mis pedidos', n: 'C3', componente: 'PaginaPedidos (P2)' },
  { ruta: '/cuenta/direcciones', texto: 'Mis direcciones', n: 'C4', componente: 'PaginaDirecciones' },
  { ruta: '/cuenta/ajustes', texto: 'Ajustes', n: 'C5', componente: 'PaginaAjustes' },
];

/** Estados para probar (chips de la demo). */
export const ESTADOS_CUENTA = [
  ['incompleto', 'Perfil incompleto'],
  ['sinDirecciones', 'Sin direcciones'],
  ['cargando', 'Cargando'],
];

const LUGARES = {
  departamentos: DEPARTAMENTOS,
  provincias: getProvincias,
  distritos: (d) => distritosSugeridos({ country: d.pais, city: d.ciudad, department: d.departamento, province: d.provincia }),
  legible: (d) => lugarLegible({ country: d.pais, city: d.ciudad, district: d.distrito, department: d.departamento, province: d.provincia }),
};

const DIRECCIONES = [
  {
    id: 'dir-1', principal: true, nombre: 'Isaac Castro', tipoDocumento: 'DNI', documento: '45871236', telefono: '987654321',
    pais: 'PE', ciudad: 'Lima', departamento: '', provincia: '', distrito: 'Miraflores', direccion: 'Av. Larco 1150, dpto. 502 (frente al parque)',
  },
  {
    id: 'dir-2', principal: false, nombre: 'María Castro', tipoDocumento: 'DNI', documento: '41236587', telefono: '956123478',
    pais: 'PE', ciudad: 'Provincias', departamento: 'Arequipa', provincia: 'Arequipa', distrito: 'Yanahuara', direccion: 'Calle Jerusalén 214, casa de rejas verdes',
  },
];

const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

export function CuentaDemo({ ruta = '/cuenta', sesion, usuario, monedas, tema, onTema, onCerrarSesion, estados = [], toast, Parte, pedidos, onIrATienda }) {
  const incompleto = estados.includes('incompleto');
  const [perfil, setPerfil] = useState({
    nombre: usuario?.nombre, email: usuario?.email, avatar: null, pais: 'PE', tipoDocumento: 'DNI',
    documento: '45871236', telefono: '987654321', cumpleanos: '2001-07-12',
  });
  const [whatsapp, setWhatsapp] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [direcciones, setDirecciones] = useState(DIRECCIONES);
  const [idioma, setIdioma] = useState('es');
  const perfilVisto = incompleto ? { ...perfil, documento: '', telefono: '' } : perfil;
  const listaDirecciones = estados.includes('sinDirecciones') ? [] : direcciones;
  const avisar = useCallback((titulo, texto, tipo = 'exito') => toast({ tipo, titulo, texto, duracion: 2200 }), [toast]);

  const guardarDireccion = useCallback(async (d) => {
    await espera(700);
    setDirecciones((lista) => {
      if (d.id) return lista.map((x) => (x.id === d.id ? { ...x, ...d } : x));
      return [...lista, { ...d, id: `dir-${Date.now().toString(36)}`, principal: lista.length === 0 }];
    });
    avisar('Dirección guardada');
  }, [avisar]);

  const modulo = MODULOS_CUENTA.find((m) => m.ruta === ruta) || MODULOS_CUENTA[0];
  const usuarioMarco = useMemo(() => ({ ...usuario, nombre: perfil.nombre, avatar: perfil.avatar }), [usuario, perfil.nombre, perfil.avatar]);

  if (!sesion) {
    return (
      <Parte n={modulo.n} nombre="PaginaCuentaInvitado">
        <PaginaCuentaInvitado pedidos={ruta === '/cuenta/pedidos'} />
      </Parte>
    );
  }

  let pagina;
  if (ruta === '/cuenta/perfil') {
    pagina = (
      <PaginaPerfil
        perfil={perfilVisto}
        monedas={monedas}
        enEspera={50}
        whatsapp={whatsapp}
        onWhatsapp={(v) => { setWhatsapp(v); avisar(v ? 'Te avisaremos de ofertas por WhatsApp' : 'Ya no te enviaremos ofertas por WhatsApp', undefined, 'info'); }}
        onGuardar={async (datos) => { await espera(700); setPerfil((p) => ({ ...p, ...datos })); avisar('Datos actualizados'); }}
        onCambiarFoto={async (archivo) => { setSubiendo(true); await espera(800); setPerfil((p) => ({ ...p, avatar: URL.createObjectURL(archivo) })); setSubiendo(false); }}
        onQuitarFoto={() => setPerfil((p) => ({ ...p, avatar: null }))}
        subiendoFoto={subiendo}
        paises={[{ valor: 'PE', texto: 'Perú', prefijo: '+51' }, { valor: 'CL', texto: 'Chile', prefijo: '+56' }, { valor: 'MX', texto: 'México', prefijo: '+52' }]}
      />
    );
  } else if (ruta === '/cuenta/pedidos') {
    pagina = <PaginaPedidos pedidos={pedidos} onIrATienda={onIrATienda} />;
  } else if (ruta === '/cuenta/direcciones') {
    pagina = (
      <PaginaDirecciones
        direcciones={listaDirecciones}
        cargando={estados.includes('cargando')}
        lugares={LUGARES}
        perfil={perfilVisto}
        onGuardar={guardarDireccion}
        onPrincipal={(id) => { setDirecciones((l) => l.map((x) => ({ ...x, principal: x.id === id }))); avisar('Dirección principal actualizada'); }}
        onEliminar={(id) => {
          setDirecciones((l) => {
            const quedan = l.filter((x) => x.id !== id);
            if (quedan.length && !quedan.some((x) => x.principal)) quedan[0] = { ...quedan[0], principal: true };
            return quedan;
          });
          avisar('Dirección eliminada', undefined, 'info');
        }}
      />
    );
  } else if (ruta === '/cuenta/ajustes') {
    pagina = (
      <PaginaAjustes
        tema={tema === 'dark' ? 'noche' : 'claro'}
        onTema={onTema}
        idioma={idioma}
        onIdioma={(i) => { setIdioma(i); if (i !== 'es') avisar('Idioma', 'En la tienda, Walá se vería en ese idioma', 'info'); }}
        onCerrarSesion={onCerrarSesion}
      />
    );
  } else {
    pagina = <PaginaResumenCuenta usuario={usuarioMarco} monedas={monedas} enEspera={50} grupos={GRUPOS_CUENTA_COMPLETO} />;
  }

  return (
    <Parte n="C0" nombre="MarcoCuenta">
      <MarcoCuenta
        usuario={usuarioMarco}
        grupos={GRUPOS_CUENTA_COMPLETO}
        activo={modulo.ruta}
        onCerrarSesion={onCerrarSesion}
        perfilIncompleto={incompleto}
      >
        <Parte n={modulo.n} nombre={modulo.componente} rejilla>{pagina}</Parte>
      </MarcoCuenta>
    </Parte>
  );
}
