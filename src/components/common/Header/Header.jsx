import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '../../../contexts/CartContext';
import { useAuth } from '../../../contexts/AuthContext';
import { getCategories } from '../../../services/products';
import { getCollections } from '../../../services/collections';
import { getDocument } from '../../../services/firebase/firestore';
import { useVisualEditor } from '../../../pages/Tienda/contexts/VisualEditorContext';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import EditableSection from '../../admin/EditableSection';
import { Heart, User, ShoppingBag } from 'lucide-react';
import styles from './Header.module.css';
import OptimizedImage from '../OptimizedImage/OptimizedImage';

const navLinkClass = ({ isActive }) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;

const Header = () => {
  const { items: cartItems, getTotalItems, getTotalPrice } = useCart();
  const { user, userProfile, isAdmin, updateUserProfile, logout } = useAuth();
  const { storeConfigDraft } = useVisualEditor();
  const { isHeaderVisible } = useLayoutContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const cartItemsCount = getTotalItems();
  const realCoins = userProfile?.monedas || 0;
  
  const [displayCoins, setDisplayCoins] = useState(realCoins);
  const pendingCoinsRef = useRef(0);
  const [isCoinBouncing, setIsCoinBouncing] = useState(false);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await getCategories();
      return data || [];
    },
    staleTime: 15 * 60 * 1000,
  });

  const { data: collectionsData } = useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const { data } = await getCollections();
      return data || [];
    },
    staleTime: 15 * 60 * 1000,
  });

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
  let navLinks = activeConfig?.header?.navLinks;
  
  if (!navLinks || navLinks.length === 0) {
    // Configuración por defecto si no hay nada en Firebase
    navLinks = [
      { id: '1', text: 'Tienda', type: 'dropdown', url: '/tienda', isCategoryAuto: true },
      { id: '2', text: 'Suscripciones', type: 'link', url: '/suscripciones' },
      { id: '3', text: 'Crear', type: 'link', url: '/personalizar' }
    ];
  }

  const accountPopup = activeConfig?.accountPopup || {
    title: 'Mi cuenta',
    description: 'Inicia sesión o crea una cuenta para ver tu perfil, pedidos y creaciones.',
    loginButtonText: 'Iniciar sesión',
    loginButtonUrl: '/login',
    registerButtonText: 'Crear cuenta',
    registerButtonUrl: '/registro',
    brands: [
      { id: 'add-btn', name: 'Añadir Marca', imageUrl: 'https://cdn-icons-png.flaticon.com/512/1237/1237946.png', url: '#' }
    ]
  };

  useEffect(() => {
    // Si no hay animaciones pendientes (ej. cambio en otra pestaña o carga de perfil final), sincronizar sin demora.
    if (pendingCoinsRef.current <= 0) {
      setDisplayCoins(realCoins);
    }
  }, [realCoins]);

  useEffect(() => {
    const handleStart = (e) => {
      pendingCoinsRef.current += (e.detail?.amount || 10);
    };
    
    const handleReached = (e) => {
      const inc = e.detail?.amount || 1;
      setDisplayCoins(prev => prev + inc);
      pendingCoinsRef.current -= inc;
      
      // Animación de bounce del contenedor al recibir la moneda
      setIsCoinBouncing(true);
      setTimeout(() => setIsCoinBouncing(false), 200);
    };

    const handleEnd = () => {
      pendingCoinsRef.current = 0;
      setDisplayCoins(userProfile?.monedas || 0); // sync por si hubo desface
    };

    window.addEventListener('coins-animation-start', handleStart);
    window.addEventListener('coin-reached-target', handleReached);
    window.addEventListener('coins-animation-end', handleEnd);

    return () => {
      window.removeEventListener('coins-animation-start', handleStart);
      window.removeEventListener('coin-reached-target', handleReached);
      window.removeEventListener('coins-animation-end', handleEnd);
    };
  }, [userProfile?.monedas]);

  const handleResetCoinsForTesting = async () => {
    if (user?.email?.toLowerCase() === 'yorh001@gmail.com') {
      const confirmReset = window.confirm('DEV MODE: ¿Quieres resetear tus Kapicoins a 0 y limpiar el historial de reclamos para testear de nuevo?');
      if (confirmReset && updateUserProfile) {
        await updateUserProfile({ monedas: 0, monedasReclamadas: [] });
        setDisplayCoins(0);
        alert('Monedas e historial reseteados.');
      }
    }
  };

  if (!isHeaderVisible) return null;

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          <svg viewBox="0 0 390 120" className={styles.logoImage} style={{ height: '44px', width: 'auto' }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="walaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                 <stop offset="0%" stopColor="#8B5CF6" />
                 <stop offset="100%" stopColor="#5B21B6" />
              </linearGradient>
              <path id="tagBase" d="M 32 42 L 28 88 C 27 92 30 94 34 93 L 85 80 C 89 79 91 76 89 72 L 76 18 C 75 13 68 11 65 14 L 36 34 C 32 37 31 40 32 42 Z" />
            </defs>

            {/* ISOTIPO (Left) */}
            <g transform="translate(15, 12) scale(0.95)">
               <use href="#tagBase" fill="url(#walaGradient)" />
               <circle cx="67" cy="23" r="6.5" fill="#FFFFFF" />
               <path d="M 38 42 L 43 78 L 54 52 L 64 72 L 72 38" fill="none" stroke="#FFFFFF" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
               <path d="M 68 20 C 72 -2, 98 0, 85 28" stroke="url(#walaGradient)" strokeWidth="6" strokeLinecap="round" fill="none" />
            </g>

            {/* LOGOTIPO (Right) - Anchored right, giving 'A' a strict known position */}
            <text x="375" y="100" textAnchor="end" fontFamily="'Montserrat', 'system-ui', 'Arial Black', sans-serif" fontWeight="900" fontSize="85" fill="url(#walaGradient)" stroke="url(#walaGradient)" strokeWidth="2.5" paintOrder="stroke fill" letterSpacing="-4">WALA</text>

            {/* THE TILDE ACCENT OVER 'A' - Pinned specifically at x=353 (perfect center of A) and y=12 (floating above) */}
            <g transform="translate(353, 12) scale(0.3) rotate(5)">
               <use href="#tagBase" fill="url(#walaGradient)" />
               <circle cx="67" cy="23" r="6.5" fill="#FFFFFF" />
               <path d="M 38 42 L 43 78 L 54 52 L 64 72 L 72 38" fill="none" stroke="#FFFFFF" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
               <path d="M 68 20 C 72 45, 95 35, 85 15" stroke="url(#walaGradient)" strokeWidth="6" strokeLinecap="round" fill="none" />
            </g>
          </svg>
        </Link>

        <EditableSection sectionId="header" currentConfig={activeConfig} label="Menú de Navegación">
          <nav className={`${styles.nav} ${mobileMenuOpen ? styles.navOpen : ''}`} aria-label="Navegación principal">
            
            {navLinks.map((link) => {
              const linkStyle = {
                color: link.color || 'inherit',
                fontFamily: link.fontFamily || 'inherit',
                fontWeight: link.bold ? 'bold' : 'normal',
                fontStyle: link.italic ? 'italic' : 'normal',
              };

              if (link.type === 'link') {
                return (
                  <NavLink key={link.id} to={link.url || '#'} className={navLinkClass} end style={({ isActive }) => ({ ...linkStyle, ...(isActive ? { color: 'var(--rojo-principal)' } : {}) })}>
                    {link.text}
                  </NavLink>
                );
              }

              if (link.type === 'dropdown') {
                return (
                  <div key={link.id} className={styles.navItemWithDropdown}>
                    <NavLink to={link.url || '#'} className={navLinkClass} end style={({ isActive }) => ({ ...linkStyle, ...(isActive ? { color: 'var(--rojo-principal)' } : {}) })}>{link.text}</NavLink>
                    <div className={styles.megaMenu}>
                      <div className={styles.megaMenuContent}>
                        <h4>{link.text}</h4>
                        <ul>
                          {/* Desplegable Automático: Categorías Base */}
                          {link.isCategoryAuto && categoriesData?.slice(0, 10).map(c => (
                            <li key={`cat-${c.id}`}>
                              <Link to={`/tienda?categoria=${c.id}`} onClick={() => setMobileMenuOpen(false)}>
                                {c.name}
                              </Link>
                            </li>
                          ))}

                          {/* Desplegable Automático: Colección Específica (Ej: Anime -> Muestra Categorías) */}
                          {link.autoCollectionId && categoriesData?.slice(0, 10).map(c => (
                            <li key={`colcat-${c.id}`}>
                              <Link to={`/tienda?coleccion=${link.autoCollectionId}&categoria=${c.id}`} onClick={() => setMobileMenuOpen(false)}>
                                {c.name}
                              </Link>
                            </li>
                          ))}

                          {/* Enlaces Manuales */}
                          {(!link.isCategoryAuto && !link.autoCollectionId) && link.dropdownLinks?.map(subLink => (
                            <li key={subLink.id}>
                              <Link to={subLink.url || '#'} onClick={() => setMobileMenuOpen(false)}>
                                {subLink.text}
                              </Link>
                            </li>
                          ))}

                          {link.isCategoryAuto && (
                            <li>
                              <Link to="/tienda" onClick={() => setMobileMenuOpen(false)} style={{fontWeight: 'bold', color: 'var(--rojo-principal)'}}>
                                Ver Todo el Catálogo →
                              </Link>
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })}

            {user && (
              <NavLink to="/cuenta" className={navLinkClass}>Mi cuenta</NavLink>
            )}
            
            {isAdmin && (
              <NavLink to="/admin" className={navLinkClass} end>Administración</NavLink>
            )}
          </nav>
        </EditableSection>

        <div className={styles.actions}>
          <div 
            className={`${styles.coinsDisplayTarget} ${styles.tooltipContainer} global-coins-target`} 
            onClick={handleResetCoinsForTesting}
            style={user?.email === 'yorh001@gmail.com' ? { cursor: 'pointer' } : {}}
          >
            <div className={`${styles.coinsDisplay} ${isCoinBouncing ? styles.bounce : ''}`}>
              🪙 {Math.floor(displayCoins)}
            </div>
            <div className={styles.tooltipText}>
              ¡Canjea tus Kapicoins en el carrito por descuentos directos!
              {user?.email === 'yorh001@gmail.com' && <br/>}
              {user?.email === 'yorh001@gmail.com' && <small style={{color:'#f1c40f'}}>(Click para Reset Test)</small>}
            </div>
          </div>
          
          <div className={styles.accountDropdownContainer}>
            <Link to="/favoritos" className={styles.iconButton} aria-label="Favoritos">
              <Heart strokeWidth={1.5} className={styles.icon} />
            </Link>
            
            <div className={styles.accountPopup}>
              <div className={styles.accountPopupContent}>
                {(() => {
                  const favConfig = storeConfigDraft?.favoritesPopup || {
                    loggedOutTitle: 'Tus Favoritos',
                    loggedOutText: 'Aún no tienes artículos guardados. Inicia sesión para crear tu lista de deseos.',
                    loggedInTitle: 'Tus Favoritos',
                    loggedInText: 'Aún no has marcado nada como favorito.',
                    buttonText: 'Mira lo que te puede interesar',
                    buttonLink: '/tienda',
                    fontFamily: '',
                    fontSize: '14px',
                    color: '#666666',
                    bold: false,
                    italic: false
                  };

                  const textStyle = {
                    fontFamily: favConfig.fontFamily || 'inherit',
                    fontSize: favConfig.fontSize || '14px',
                    color: favConfig.color || '#666666',
                    fontWeight: favConfig.bold ? 'bold' : 'normal',
                    fontStyle: favConfig.italic ? 'italic' : 'normal',
                    marginBottom: '1.25rem'
                  };

                  if (user) {
                    return (
                      <>
                        <h3>{favConfig.loggedInTitle || 'Tus Favoritos'}</h3>
                        <p style={textStyle}>{favConfig.loggedInText || 'Aún no has marcado nada como favorito.'}</p>
                        <div className={styles.accountButtons}>
                          <Link to={favConfig.buttonLink || '/tienda'} className={styles.primaryButton}>
                            {favConfig.buttonText || 'Mira lo que te puede interesar'}
                          </Link>
                        </div>
                      </>
                    );
                  }

                  return (
                    <>
                      <h3>{favConfig.loggedOutTitle || 'Tus Favoritos'}</h3>
                      <p style={textStyle}>{favConfig.loggedOutText || 'Aún no tienes artículos guardados. Inicia sesión para crear tu lista de deseos.'}</p>
                      <div className={styles.accountButtons}>
                        <Link to="/login" className={styles.primaryButton}>
                          Iniciar sesión
                        </Link>
                        <Link to="/tienda" className={styles.secondaryButton}>
                          Explorar tienda
                        </Link>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
          
          <div className={styles.accountDropdownContainer}>
            <Link to="/cuenta" className={styles.iconButton} aria-label="Mi cuenta">
              <User strokeWidth={1.5} className={styles.icon} />
            </Link>
            
            <div className={styles.accountPopup}>
              <EditableSection sectionId="accountPopup" currentConfig={activeConfig} label="Pop-up de Cuenta">
                <div className={styles.accountPopupContent}>
                  {user ? (
                    <>
                      <h3>Hola, {userProfile?.displayName || userProfile?.nombre || user.email?.split('@')[0]}</h3>
                      <p>Bienvenido a tu cuenta</p>
                      
                      {!userProfile?.hasCompletedSurvey && (
                        <div style={{ background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', border: '1px solid #e2e8f0', textAlign: 'left' }}>
                          <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.9rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            🎁 Perfil de Regalos
                          </h4>
                          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: '#4b5563', lineHeight: '1.3' }}>
                            Gana recompensas diciéndonos qué te gusta.
                          </p>
                          <Link to="/encuesta-suscripcion" className={styles.primaryButton} style={{ background: '#8b5cf6', color: 'white', padding: '0.5rem', fontSize: '0.85rem' }}>
                            Completar Encuesta
                          </Link>
                        </div>
                      )}

                      <div className={styles.accountButtons}>
                        <Link to="/cuenta" className={styles.primaryButton}>
                          Mi Perfil
                        </Link>
                        <button onClick={logout} className={styles.secondaryButton} style={{ width: '100%', cursor: 'pointer', border: '1px solid #ccc' }}>
                          Cerrar sesión
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3>{accountPopup.title}</h3>
                      <p>{accountPopup.description}</p>
                      
                      <div className={styles.accountButtons}>
                        <Link to={accountPopup.loginButtonUrl || '/login'} className={styles.primaryButton}>
                          {accountPopup.loginButtonText || 'Iniciar sesión'}
                        </Link>
                        <Link to={accountPopup.registerButtonUrl || '/registro'} className={styles.secondaryButton}>
                          {accountPopup.registerButtonText || 'Crear cuenta'}
                        </Link>
                      </div>
                    </>
                  )}
                  
                  {accountPopup.brands && accountPopup.brands.length > 0 && (
                    <div className={styles.brandsSection}>
                      <h4>NUESTRAS MARCAS</h4>
                      <div className={styles.brandsList}>
                        {accountPopup.brands.map(brand => (
                          <a key={brand.id} href={brand.url || '#'} className={styles.brandLink} title={brand.name}>
                            <img src={brand.imageUrl || 'https://via.placeholder.com/150'} alt={brand.name} className={styles.brandLogo} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </EditableSection>
            </div>
          </div>

          <div className={styles.accountDropdownContainer}>
            <Link to="/carrito" className={styles.iconButton} aria-label="Carrito de compras">
              <ShoppingBag strokeWidth={1.5} className={styles.icon} />
              {cartItemsCount > 0 && (
                <span className={styles.cartBadge}>{cartItemsCount}</span>
              )}
            </Link>

            <div className={`${styles.accountPopup} ${styles.cartPopupWidth}`}>
              <div className={styles.accountPopupContent}>
                <h3 style={{textAlign: 'left', borderBottom: '1px solid #eee', paddingBottom: '0.75rem', marginBottom: '0.75rem'}}>Mi Carrito</h3>
                {cartItems.length === 0 ? (
                  <>
                    <p>Tu carrito está vacío en este momento.</p>
                    <div className={styles.accountButtons}>
                      <Link to="/tienda" className={styles.primaryButton}>Explorar tienda</Link>
                    </div>
                  </>
                ) : (
                  <div className={styles.cartPreviewContainer}>
                    <div className={styles.previewItemList}>
                      {cartItems.slice(0, 3).map((item) => (
                        <div key={item.id} className={styles.previewItem}>
                          <img src={item.productImage} alt={item.productName} className={styles.previewItemImg} />
                          <div className={styles.previewItemDetails}>
                            <span className={styles.previewItemName}>{item.productName}</span>
                            <span className={styles.previewItemPrice}>{item.quantity} x S/ {(item.price || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                      {cartItems.length > 3 && (
                        <p className={styles.moreItemsText}>+ {cartItems.length - 3} artículos más...</p>
                      )}
                    </div>
                    <div className={styles.cartPreviewFooter}>
                      <div className={styles.cartPreviewTotal}>
                        <span>Total:</span>
                        <strong>S/ {getTotalPrice().toFixed(2)}</strong>
                      </div>
                      <Link to="/carrito" className={styles.primaryButton} style={{width: '100%', boxSizing: 'border-box'}}>
                        Ir a pagar
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            className={styles.mobileMenuButton}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
