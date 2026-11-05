import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminRoles, setAdminRole, deleteAdminRole } from '../../services/adminRoles';
import { getLockedPages, saveLockedPages } from '../../services/lockedPages';
import { getLandingPages } from '../../pages/Tienda/services/landingPages';
import { reconvertirImagenesAWebp, contarImagenesPorConvertir, AMBITO_DISENO, AMBITO_PRODUCTOS } from '../../services/imagenesWebp';
import { PaginaConfiguracionAdmin } from '../../componentes/kit/paginas/admin/Configuracion';
import { adminDesdeFirestore, adminAFirestore, paginasBloqueables, conBloqueo } from '../../componentes/kit/adaptadoresAdmin';
import { sinError, useInvalidar } from './comun';

/*
 * Configuración (D8a, /admin/configuracion, solo Super Admin): el equipo con
 * sus permisos, las páginas bloqueadas para el editor y el mantenimiento
 * (imágenes viejas a WebP y publicar las traducciones). Los mismos servicios
 * que AdminConfiguracion; lo que se escribe en adminRoles y en
 * storeConfig/lockedPages sale de los adaptadores del kit (adminAFirestore,
 * conBloqueo).
 *
 * getAdminRoles, getLockedPages y getLandingPages no devuelven { data, error }:
 * la lista sola (y [] si fallan), como antes. Nadie más lee adminRoles ni
 * lockedPages con React Query (AuthContext y el editor van directo a
 * Firestore); las landing pages comparten ['admin-landing-pages'] con
 * LandingsDelPanel (la misma lista cruda).
 */

const ADMINS = ['admin-roles'];
const BLOQUEADAS = ['admin-locked-pages'];
const LANDINGS = ['admin-landing-pages'];

const coleccionesDe = (ambito) => (ambito === 'productos' ? AMBITO_PRODUCTOS : AMBITO_DISENO);

/**
 * /admin/configuracion: esSuperadmin y yo de useAuth; las lecturas solo si es
 * Super Admin (como antes). Bloquear marca la lista al instante (como antes)
 * y la guarda; si falla, se vuelve a leer la de verdad.
 */
export default function ConfiguracionDelPanel() {
  const { adminPermissions, user } = useAuth();
  const esSuperadmin = Boolean(adminPermissions?.includes('superadmin'));
  const queryClient = useQueryClient();
  const invalidar = useInvalidar();

  const adminsQ = useQuery({ queryKey: ADMINS, queryFn: getAdminRoles, enabled: esSuperadmin });
  const bloqueadasQ = useQuery({ queryKey: BLOQUEADAS, queryFn: getLockedPages, enabled: esSuperadmin });
  const landingsQ = useQuery({ queryKey: LANDINGS, queryFn: getLandingPages, enabled: esSuperadmin });

  // La lista y las páginas se copian en la página: los mismos objetos entre render y render.
  const admins = useMemo(() => (adminsQ.data || []).map(adminDesdeFirestore), [adminsQ.data]);
  const paginas = useMemo(() => paginasBloqueables(landingsQ.data || [], bloqueadasQ.data || []), [landingsQ.data, bloqueadasQ.data]);

  const errorDe = (q, texto) => (q.error ? q.error.message || texto : undefined);

  return (
    <PaginaConfiguracionAdmin
      esSuperadmin={esSuperadmin}
      yo={user?.email || ''}
      admins={admins}
      cargando={adminsQ.isLoading}
      error={errorDe(adminsQ, 'No se pudo cargar el equipo.')}
      onReintentar={() => adminsQ.refetch()}
      onGuardarAdmin={async (d) => {
        // Al editar, el correo no cambia (es la llave del documento).
        const { correo, datos } = adminAFirestore(d);
        await sinError(setAdminRole(correo, datos));
        await invalidar(ADMINS);
      }}
      onEliminarAdmin={async (id) => {
        await sinError(deleteAdminRole(id));
        await invalidar(ADMINS);
      }}
      paginas={paginas}
      cargandoPaginas={bloqueadasQ.isLoading || landingsQ.isLoading}
      errorPaginas={errorDe(bloqueadasQ, 'No se pudieron leer los bloqueos.') || errorDe(landingsQ, 'No se pudieron leer las landing pages.')}
      onReintentarPaginas={() => { bloqueadasQ.refetch(); landingsQ.refetch(); }}
      onBloquear={async (id, bloquear) => {
        // Sobre la última lista (no la de este dibujo): dos clics seguidos no se pisan.
        const nueva = conBloqueo(queryClient.getQueryData(BLOQUEADAS) || [], id, bloquear);
        queryClient.setQueryData(BLOQUEADAS, nueva);
        try {
          await sinError(saveLockedPages(nueva));
        } catch (err) {
          await invalidar(BLOQUEADAS);
          throw err;
        }
      }}
      onRevisarImagenes={(ambito) => contarImagenesPorConvertir({ colecciones: coleccionesDe(ambito) })}
      onConvertirImagenes={(ambito, { alAvanzar } = {}) => reconvertirImagenesAWebp({ colecciones: coleccionesDe(ambito), onProgreso: alAvanzar })}
    />
  );
}
