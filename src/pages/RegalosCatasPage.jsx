import React from 'react';
import { motion } from 'framer-motion';

const RegalosCatasPage = () => {
  return (
    <div className="landing-page-container flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-2xl mx-auto space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100"
      >
        <div className="text-pink-500 mb-6">
          <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 tracking-tight">
          ¡Algo increíble se acerca!
        </h1>
        
        <p className="text-xl text-gray-600 leading-relaxed">
          Estamos preparando una experiencia única de catas y regalos. 
          Vuelve pronto para descubrir todas las sorpresas que tenemos para ti.
        </p>

        <div className="mt-10 pt-8 border-t border-gray-100">
          <p className="text-sm text-gray-400 font-medium tracking-wide uppercase">
            Regalos Con Amor
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default RegalosCatasPage;
