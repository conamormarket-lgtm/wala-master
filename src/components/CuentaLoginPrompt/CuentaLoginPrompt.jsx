import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDocument } from '../../services/firebase/firestore';
import { useVisualEditor } from '../../pages/Tienda/contexts/VisualEditorContext';
import EditableSection from '../admin/EditableSection';
import { LOGO_URL } from '../../utils/constants';
import Button from '../common/Button';
import styles from './CuentaLoginPrompt.module.css';
import { T } from '../../i18n/useTranslatedText';

/**
 * Vista "Mi cuenta" cuando no hay sesión: logo, frase y opciones Iniciar sesión / Crear cuenta.
 */
const CuentaLoginPrompt = () => {
  const { storeConfigDraft } = useVisualEditor();
  
  const { data: storeConfig } = useQuery({
    queryKey: ['store-config-custom'],
    queryFn: async () => {
      const { data, error } = await getDocument('storeConfig', 'homePage');
      if (error) return null;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const activeConfig = storeConfigDraft || storeConfig || {};
  
  const accountPopup = activeConfig?.accountPopup || {
    title: 'Mi cuenta',
    description: 'Inicia sesión o crea una cuenta para ver tu perfil, pedidos y creaciones.',
    loginButtonText: 'Iniciar sesión',
    loginButtonUrl: '/login',
    registerButtonText: 'Crear cuenta',
    registerButtonUrl: '/registro',
  };

  return (
    <EditableSection sectionId="accountPopup" currentConfig={activeConfig} label="Página de Login y Pop-up">
      <div className={styles.wrapper}>
        <div className={styles.branding}>
          <img src={LOGO_URL} alt="Walá" />
          <h2><T>El seguimiento de tus pedidos, más fácil que nunca.</T></h2>
          <p><T>Walá</T></p>
        </div>
        <div className={styles.ctaContainer}>
          <img src={LOGO_URL} alt="Walá" className={styles.logoMovil} />
          <h1>{accountPopup.title}</h1>
          <p>{accountPopup.description}</p>
          <div className={styles.buttons}>
            <Link to={accountPopup.loginButtonUrl || '/login'}>
              <Button variant="primary" fullWidth size="large">
                {accountPopup.loginButtonText || 'Iniciar sesión'}
              </Button>
            </Link>
            <Link to={accountPopup.registerButtonUrl || '/registro'}>
              <Button variant="secondary" fullWidth size="large">
                {accountPopup.registerButtonText || 'Crear cuenta'}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </EditableSection>
  );
};

export default CuentaLoginPrompt;
