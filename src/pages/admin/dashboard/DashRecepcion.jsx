import React from 'react';
import { motion } from 'framer-motion';
import RecepcionPedidos from './RecepcionPedidos';
import { DashBackground, DashHeader, containerVariants, itemVariants } from './dashShared';
import styles from '../AdminDashboard.module.css';

/**
 * DashRecepcion — sub-página DEDICADA de "Recepción de Pedidos" (/admin/recepcion-pedidos).
 *
 * Reusa el componente RecepcionPedidos en su propia página con fondo de marca y
 * cabecera, sin enlace de volver: es una entrada del menú, no cuelga de Resultados.
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
            conVolver={false}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <RecepcionPedidos embebido />
        </motion.div>
      </motion.div>
    </div>
  );
}
