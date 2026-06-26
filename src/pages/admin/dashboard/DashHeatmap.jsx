import React from 'react';
import { motion } from 'framer-motion';
import HeatmapViewer from '../../../components/dashboard/HeatmapViewer';
import { DashBackground, DashHeader, containerVariants, itemVariants } from './dashShared';
import styles from '../AdminDashboard.module.css';

/**
 * DashHeatmap — sub-página dedicada al MAPA DE CALOR a tamaño grande.
 *
 * El HeatmapViewer hace su propia lectura (getHeatmapByPage) una sola vez al
 * montar, por lo que esta página NO depende del rango de fechas global ni del
 * selector 7/30/90 (el heatmap agrega clics globalmente). Por eso el header no
 * muestra el selector de rango.
 */
export default function DashHeatmap() {
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
            title="Mapa de calor"
            subtitle="Dónde hacen clic tus visitantes, página por página"
            showRange={false}
          />
        </motion.div>

        <motion.div className={styles.heatmapFull} variants={itemVariants}>
          <HeatmapViewer />
        </motion.div>
      </motion.div>
    </div>
  );
}
