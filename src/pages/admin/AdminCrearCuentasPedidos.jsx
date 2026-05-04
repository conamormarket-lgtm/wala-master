import React, { useState, useCallback } from 'react';
import { getPedidosForAccountSync } from '../../services/erp/firebase';
import {
  ensureAccountFromOrderData,
  extraerDatosClienteDesdePedido,
  migrateLegacyAutoCreatedUsers,
} from '../../services/accountFromOrder';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal/Modal';
import styles from './AdminCrearCuentasPedidos.module.css';

const LIMIT_PER_PAGE = 100;
const BATCH_SIZE = 15;
const DELAY_MS = 400;

function hasValidEmail(pedido) {
  const { email } = extraerDatosClienteDesdePedido(pedido);
  return email && typeof email === 'string' && email.trim().length >= 5 && email.includes('@');
}

const AdminCrearCuentasPedidos = () => {
  const [pedidos, setPedidos] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [migratingLegacy, setMigratingLegacy] = useState(false);
  const [legacyMigrationResult, setLegacyMigrationResult] = useState(null);
  const [confirmLegacyMigrationOpen, setConfirmLegacyMigrationOpen] = useState(false);
  const [result, setResult] = useState({ created: 0, existing: 0, errors: 0, errorDetails: [] });
  const [showDetails, setShowDetails] = useState(false);

  const pedidosConEmail = pedidos.filter(hasValidEmail);
  const seenEmails = new Set();
  const pedidosUnicosPorEmail = pedidosConEmail.filter((p) => {
    const { email } = extraerDatosClienteDesdePedido(p);
    if (!email || seenEmails.has(email.toLowerCase())) return false;
    seenEmails.add(email.toLowerCase());
    return true;
  });

  const loadPedidos = useCallback(async (append = false) => {
    setLoadError(null);
    setLoading(true);
    try {
      const start = append ? lastDoc : null;
      const { data, lastDoc: nextLast, error } = await getPedidosForAccountSync(
        LIMIT_PER_PAGE,
        start
      );
      if (error) {
        setLoadError(error);
        setLoading(false);
        return;
      }
      setPedidos((prev) => (append ? [...prev, ...data] : data));
      setLastDoc(nextLast);
      if (!append) setResult({ created: 0, existing: 0, errors: 0, errorDetails: [] });
    } catch (err) {
      setLoadError(err?.message || 'Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [lastDoc]);

  const runSync = useCallback(async () => {
    if (pedidosUnicosPorEmail.length === 0) return;
    setSyncing(true);
    setResult({ created: 0, existing: 0, errors: 0, errorDetails: [] });
    let created = 0;
    let existing = 0;
    let errors = 0;
    const errorDetails = [];

    const delay = () => new Promise((r) => setTimeout(r, DELAY_MS));

    for (let i = 0; i < pedidosUnicosPorEmail.length; i += BATCH_SIZE) {
      const batch = pedidosUnicosPorEmail.slice(i, i + BATCH_SIZE);
      for (const pedido of batch) {
        const res = await ensureAccountFromOrderData(pedido, { linkOrderId: true });
        if (res.created) created += 1;
        else if (res.existing) existing += 1;
        else {
          errors += 1;
          const { email } = extraerDatosClienteDesdePedido(pedido);
          errorDetails.push(`${email || pedido.id}: ${res.error || 'Error'}`);
        }
      }
      setResult({ created, existing, errors, errorDetails: [...errorDetails] });
      if (i + BATCH_SIZE < pedidosUnicosPorEmail.length) await delay();
    }

    setSyncing(false);
  }, [pedidosUnicosPorEmail]);

  const runLegacyMigration = useCallback(async () => {
    setMigratingLegacy(true);
    setLegacyMigrationResult(null);
    const { data, error } = await migrateLegacyAutoCreatedUsers({ maxPedidos: 5000 });
    if (error) {
      setLegacyMigrationResult({ error });
    } else {
      setLegacyMigrationResult({ data });
    }
    setMigratingLegacy(false);
  }, []);

  const runLegacyMigrationDryRun = useCallback(async () => {
    setMigratingLegacy(true);
    setLegacyMigrationResult(null);
    const { data, error } = await migrateLegacyAutoCreatedUsers({ maxPedidos: 5000, dryRun: true });
    if (error) {
      setLegacyMigrationResult({ error });
    } else {
      setLegacyMigrationResult({ data });
    }
    setMigratingLegacy(false);
  }, []);

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Crear cuentas desde pedidos</h1>
      <p className={styles.subtitle}>
        Carga pedidos del ERP con correo electrónico y crea cuentas en el Portal para quienes aún no
        tienen. La contraseña inicial será el DNI. No se creará más de una cuenta por correo.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Cargar pedidos</h2>
        <p className={styles.hint}>
          Se cargan los pedidos más recientes del ERP (hasta {LIMIT_PER_PAGE} por página). Solo se
          consideran pedidos con correo válido; por cada correo se crea como máximo una cuenta.
        </p>
        <div className={styles.actions}>
          <Button
            onClick={() => loadPedidos(false)}
            disabled={loading}
          >
            {loading ? 'Cargando...' : 'Cargar pedidos'}
          </Button>
          {pedidos.length > 0 && lastDoc && (
            <Button
              variant="secondary"
              onClick={() => loadPedidos(true)}
              disabled={loading}
            >
              {loading ? 'Cargando...' : 'Cargar más'}
            </Button>
          )}
        </div>
        {loadError && <p className={styles.error}>{loadError}</p>}
        {pedidos.length > 0 && (
          <p className={styles.progress}>
            Total cargados: {pedidos.length}. Con email válido (únicos): {pedidosUnicosPorEmail.length}.
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Crear cuentas faltantes</h2>
        <p className={styles.hint}>
          Para cada correo que aún no tenga cuenta se crea una con los datos del pedido (nombre, DNI,
          teléfono). El pedido se vincula a la nueva cuenta (userId).
        </p>
        <div className={styles.actions}>
          <Button
            onClick={runSync}
            disabled={syncing || pedidosUnicosPorEmail.length === 0}
          >
            {syncing ? 'Creando cuentas...' : 'Crear cuentas faltantes'}
          </Button>
        </div>
        {(result.created > 0 || result.existing > 0 || result.errors > 0) && (
          <>
            <div className={styles.summary}>
              <span className={`${styles.summaryItem} ${styles.created}`}>
                Creadas: {result.created}
              </span>
              <span className={`${styles.summaryItem} ${styles.existing}`}>
                Ya existían: {result.existing}
              </span>
              <span className={`${styles.summaryItem} ${styles.errors}`}>
                Errores: {result.errors}
              </span>
            </div>
            {result.errorDetails.length > 0 && (
              <>
                <button
                  type="button"
                  className={styles.detailsToggle}
                  onClick={() => setShowDetails((d) => !d)}
                >
                  {showDetails ? 'Ocultar detalle de errores' : 'Ver detalle de errores'}
                </button>
                {showDetails && (
                  <ul className={styles.detailsList}>
                    {result.errorDetails.map((line, idx) => (
                      <li key={idx} className={styles.listItem}>
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Migrar auto-creados legacy a colección del portal</h2>
        <p className={styles.hint}>
          Mueve a la nueva colección <strong>portal_clientes_users</strong> los perfiles que se crearon
          antes en <strong>users</strong> y que están vinculados por userId en pedidos ERP.
        </p>
        <div className={styles.actions}>
          <Button
            onClick={runLegacyMigrationDryRun}
            disabled={migratingLegacy}
            variant="secondary"
          >
            {migratingLegacy ? 'Simulando...' : 'Simular migración (dry-run)'}
          </Button>
          <Button
            onClick={() => setConfirmLegacyMigrationOpen(true)}
            disabled={migratingLegacy}
            variant="secondary"
          >
            {migratingLegacy ? 'Migrando...' : 'Migrar auto-creados legacy'}
          </Button>
        </div>
        {legacyMigrationResult?.error && (
          <p className={styles.error}>{legacyMigrationResult.error}</p>
        )}
        {legacyMigrationResult?.data && (
          <div className={styles.summary}>
            {legacyMigrationResult.data.dryRun ? (
              <span className={styles.summaryItem}>
                Modo: Simulación (sin cambios)
              </span>
            ) : (
              <span className={styles.summaryItem}>
                Modo: Ejecución real
              </span>
            )}
            <span className={styles.summaryItem}>Candidatos: {legacyMigrationResult.data.candidateUserIds}</span>
            <span className={styles.summaryItem}>Migrados: {legacyMigrationResult.data.migrated}</span>
            <span className={styles.summaryItem}>Migrables (simulación): {legacyMigrationResult.data.wouldMigrate}</span>
            <span className={styles.summaryItem}>Ya en nueva colección: {legacyMigrationResult.data.alreadyInTarget}</span>
            <span className={styles.summaryItem}>Eliminados de legacy: {legacyMigrationResult.data.deletedFromLegacy}</span>
            <span className={styles.summaryItem}>Eliminados (ya migrados antes): {legacyMigrationResult.data.deletedAlreadyMigrated}</span>
            <span className={styles.summaryItem}>Se eliminarían de legacy (simulación): {legacyMigrationResult.data.wouldDeleteFromLegacy}</span>
            <span className={styles.summaryItem}>Se eliminarían ya migrados (simulación): {legacyMigrationResult.data.wouldDeleteAlreadyMigrated}</span>
            <span className={styles.summaryItem}>No encontrados en legacy: {legacyMigrationResult.data.notFoundInLegacy}</span>
          </div>
        )}
      </section>

      <Modal
        isOpen={confirmLegacyMigrationOpen}
        onClose={() => setConfirmLegacyMigrationOpen(false)}
        title="Confirmar migración real y limpieza legacy"
      >
        <p className={styles.hint}>
          Esta acción migrará perfiles legacy a <strong>portal_clientes_users</strong> y eliminará de
          <strong> users</strong> solo los que estén verificados en la nueva colección.
        </p>
        <p className={styles.hint}>
          Recomendado: ejecutar primero la simulación (dry-run) para validar cantidades.
        </p>
        <div className={styles.actions}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirmLegacyMigrationOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              setConfirmLegacyMigrationOpen(false);
              runLegacyMigration();
            }}
            disabled={migratingLegacy}
          >
            Confirmar y ejecutar
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminCrearCuentasPedidos;
