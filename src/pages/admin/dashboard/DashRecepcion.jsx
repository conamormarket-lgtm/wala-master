import React from 'react';
import { motion } from 'framer-motion';
import RecepcionPedidos from './RecepcionPedidos';
import { DashBackground, DashHeader, containerVariants, itemVariants } from './dashShared';
import styles from '../AdminDashboard.module.css';

/**
 * DashRecepcion — sub-página DEDICADA de "Recepción de Pedidos" (/admin/dashboard/recepcion).
 *
 * Reusa el componente RecepcionPedidos (la MISMA sección que va embebida bajo el
 * dashboard de analítica) pero en su propia página con fondo de marca + cabecera
 * con "Volver al resumen". La sección ya trae su propio encabezado interno, así
 * que aquí el DashHeader es opcional/contextual: ofrece la navegación de vuelta.
 *
 * SOLO-LECTURA (capa adminOrders.js → ERP). No toca carrito/precios/cobro.
 */
export default function DashRecepcion() {
  return (
    <div className={styles.page}>
      <DashBackground />
      <motion.div
        className={styles.content}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants}>
          <DashHeader
            title="Recepción de Pedidos"
            subtitle="Organiza los envíos del portal WALA"
            showRange={false}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <RecepcionPedidos embebido />
        </motion.div>
      </motion.div>
    </div>
  );
}
