import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '../../../contexts/CartContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useWishlist } from '../../../contexts/WishlistContext';
import { getCategories } from '../../../services/products';
import { getCollections } from '../../../services/collections';
import { getDocument } from '../../../services/firebase/firestore';
import { useVisualEditor } from '../../../pages/Tienda/contexts/VisualEditorContext';
import { useLayoutContext } from '../../../contexts/LayoutContext';
import EditableSection from '../../admin/EditableSection';
import { Heart, User, ShoppingBag, Gamepad2, ArrowLeft, Home } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { logout } from '../../../services/firebase/auth';
import styles from './Header.module.css';
import NotificationTray from './NotificationTray';
import OptimizedImage from '../OptimizedImage/OptimizedImage';

const navLinkClass = ({ isActive }) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;

const Header = () => {
  const { items: cartItems, getTotalItems, getTotalPrice } = useCart();
  const { user, userProfile, isAdmin, updateUserProfile, activeMainCoins } = useAuth();
  const navigate = useNavigate();
  const { wishlistItems } = useWishlist();
  const { storeConfigDraft } = useVisualEditor();
  const { isHeaderVisible } = useLayoutContext();
  const location = useLocation();
  const isArcadeZone = location.pathname.startsWith('/minijuegos') || location.pathname.startsWith('/ruleta') || location.pathname.startsWith('/ball-sort');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileWalletOpen, setMobileWalletOpen] = useState(false);
  const [forceHideDropdowns, setForceHideDropdowns] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);

  const mobileWalletRef = useRef(null);
  const cartItemsCount = getTotalItems();
  const realCoins = activeMainCoins || 0;
  
  const [displayCoins, setDisplayCoins] = useState(realCoins);
  const pendingCoinsRef = useRef(0);
  const [isCoinBouncing, setIsCoinBouncing] = useState(false);

  const realKapiCoins = userProfile?.kapiCoins || 0;
  const [displayKapiCoins, setDisplayKapiCoins] = useState(realKapiCoins);
  const [isKapiBouncing, setIsKapiBouncing] = useState(false);

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
      setDisplayCoins(activeMainCoins || 0); // sync por si hubo desface
    };

    window.addEventListener('coins-animation-start', handleStart);
    window.addEventListener('coin-reached-target', handleReached);
    window.addEventListener('coins-animation-end', handleEnd);

    return () => {
      window.removeEventListener('coins-animation-start', handleStart);
      window.removeEventListener('coin-reached-target', handleReached);
      window.removeEventListener('coins-animation-end', handleEnd);
    };
  }, [activeMainCoins]);

  useEffect(() => {
    setDisplayKapiCoins(realKapiCoins);
  }, [realKapiCoins]);

  useEffect(() => {
    const handleKapiStart = (e) => {
      const inc = e.detail?.amount || 1;
      setDisplayKapiCoins(prev => prev + inc);
      setIsKapiBouncing(true);
      setTimeout(() => setIsKapiBouncing(false), 200);
    };
    window.addEventListener('kapi-coins-animation-start', handleKapiStart);
    return () => window.removeEventListener('kapi-coins-animation-start', handleKapiStart);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      // Para billetera móvil
      if (mobileWalletRef.current && !mobileWalletRef.current.contains(e.target)) {
        setMobileWalletOpen(false);
      }
      // Cerrar el dropdown activo en móviles/escritorio si se da clic afuera de un contenedor de dropdown
      const isDropdownContainer = e.target.closest('.' + styles.accountDropdownContainer);
      if (!isDropdownContainer) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    // Para dispositivos móviles táctiles
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    closeDropdowns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);


  const closeDropdowns = () => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    setMobileMenuOpen(false);
    setMobileWalletOpen(false);
    setActiveDropdown(null);
    setForceHideDropdowns(true);
    setTimeout(() => {
      const handlePointerMove = () => {
        setForceHideDropdowns(false);
        window.removeEventListener('pointermove', handlePointerMove);
      };
      window.addEventListener('pointermove', handlePointerMove);
    }, 100);
  };

  const handleMobileDropdownClick = (e, dropdownName) => {
    if (window.innerWidth <= 768 || Capacitor.isNativePlatform()) {
      e.preventDefault();
      setActiveDropdown(prev => prev === dropdownName ? null : dropdownName);
    }
  };

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

  const isNativeApp = Capacitor.isNativePlatform();

  return (
    <>
    <header className={`${styles.header} ${forceHideDropdowns ? styles.forceHideHover : ''}`}>
      <div className={styles.container}>
        {isNativeApp ? (
          <Link to="/" className={styles.nativeBackBtn}>
            <Home size={20} />
          </Link>
        ) : (
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
        )}

        <EditableSection sectionId="header" currentConfig={activeConfig} label="Menú de Navegación">
          <nav className={`${styles.nav} ${mobileMenuOpen ? styles.navOpen : ''}`} aria-label="Navegación principal">
            
            {navLinks.map((link) => {
              const linkStyle = {
                color: (link.color || 'inherit'),
                fontFamily: link.fontFamily || 'inherit',
                fontWeight: link.bold ? 'bold' : 'normal',
                fontStyle: link.italic ? 'italic' : 'normal',
              };

              const getActiveStyle = (isActive) => ({
                ...linkStyle,
                ...(isActive ? { color: 'var(--rojo-principal)' } : {})
              });

              if (link.type === 'link') {
                return (
                  <NavLink key={link.id} to={link.url || '#'} className={navLinkClass} end style={({ isActive }) => getActiveStyle(isActive)}>
                    {link.text}
                  </NavLink>
                );
              }

              if (link.type === 'dropdown') {
                return (
                  <div key={link.id} className={styles.navItemWithDropdown}>
                    <NavLink to={link.url || '#'} className={navLinkClass} end style={({ isActive }) => getActiveStyle(isActive)}>{link.text}</NavLink>
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

            <NavLink to="/minijuegos" className={(props) => `${navLinkClass(props)} ${styles.desktopOnlyItem}`} end>Minijuegos</NavLink>

            {user && (
              <NavLink to="/cuenta" className={(props) => `${navLinkClass(props)} ${styles.desktopOnlyItem}`}>Mi cuenta</NavLink>
            )}
            
            {isAdmin && (
              <NavLink to="/admin" className={navLinkClass} end>Administración</NavLink>
            )}
          </nav>
        </EditableSection>

        <div className={styles.actions}>
          <div className={styles.walletsContainer}>
            {user && (
              <>
                {/* --- DESKTOP VIEW --- */}
                <div className={styles.desktopWalletsOnly}>
                  {/* Billetera Principal (Wala Coins) */}
                  <div 
                    className={`${styles.coinsDisplayTarget} ${styles.tooltipContainer} global-coins-target`} 
                    onClick={handleResetCoinsForTesting}
                    style={user?.email === 'yorh001@gmail.com' ? { cursor: 'pointer' } : {}}
                  >
                    <div className={`${styles.coinsDisplay} ${isCoinBouncing ? styles.bounce : ''}`}>
                      🪙 {Math.floor(displayCoins)}
                    </div>
                    <div className={styles.tooltipText}>
                      Billetera Principal - ¡Canjea tus monedas en el catálogo o checkout!
                      {user?.email === 'yorh001@gmail.com' && <br/>}
                      {user?.email === 'yorh001@gmail.com' && <small style={{color:'#f1c40f'}}>(Click para Reset Test)</small>}
                    </div>
                  </div>

                  {/* Billetera Diaria (Kapi Coins) */}
                  <div className={`${styles.coinsDisplayTarget} ${styles.tooltipContainer}`}>
                    <div className={`${styles.coinsDisplay} ${isKapiBouncing ? styles.bounce : ''}`} style={{ backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba' }}>
                      🍖 {displayKapiCoins}
                    </div>
                    <div className={styles.tooltipText}>
                      Billetera Diaria - Kapi Coins (Vencen a fin de mes)
                    </div>
                  </div>
                </div>

                {/* --- MOBILE VIEW --- */}
                <div className={`${styles.accountDropdownContainer} ${activeDropdown === 'billetera' ? styles.activeDropdown : ''} ${activeDropdown && activeDropdown !== 'billetera' ? styles.forceHideHover : ''} ${styles.mobileWalletsOnly}`}>
                  <button 
                    className={styles.mobileWalletsBtn} 
                    onClick={(e) => handleMobileDropdownClick(e, 'billetera')}
                    style={{ background: 'transparent', border: 'none', display: 'flex', gap: '6px', padding: 0 }}
                  >
                    <div className={`${styles.nativeCoinBadge} ${isCoinBouncing || isKapiBouncing ? styles.bounce : ''} global-coins-target`} style={{ color: 'var(--rojo-principal)', background: '#ffe4e6', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '12px' }}>
                      <span style={{fontSize: '13px'}}>🪙</span> <strong>{Math.floor(displayCoins) + displayKapiCoins}</strong>
                    </div>
                  </button>

                  <div className={`${styles.accountPopup} ${styles.mobileCenteredPopup}`}>
                    <div className={styles.accountPopupContent} style={{ padding: '12px' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#333' }}>Mis Billeteras</h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>🪙</span>
                            <span style={{ fontSize: '14px', fontWeight: '500', color: '#334155' }}>Wala Coins</span>
                          </div>
                          <strong style={{ color: 'var(--rojo-principal)', fontSize: '15px' }}>{Math.floor(displayCoins)}</strong>
                        </li>
                        <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>🍖</span>
                            <span style={{ fontSize: '14px', fontWeight: '500', color: '#334155' }}>Kapi Coins</span>
                          </div>
                          <strong style={{ color: '#b45309', fontSize: '15px' }}>{displayKapiCoins}</strong>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className={`${styles.accountDropdownContainer} ${activeDropdown === 'favoritos' ? styles.activeDropdown : ''} ${activeDropdown && activeDropdown !== 'favoritos' ? styles.forceHideHover : ''}`}>
            <Link to={user ? "/cuenta/wishlist" : "/login"} className={styles.iconButton} onClick={(e) => handleMobileDropdownClick(e, 'favoritos')} aria-label="Favoritos">
              <Heart strokeWidth={1.5} className={styles.icon} />
            </Link>
            
            <div className={`${styles.accountPopup} ${styles.mobileCenteredPopup}`}>
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
                    if (wishlistItems.length > 0) {
                      return (
                        <>
                          <h3>Tu Lista de Deseos</h3>
                          <p style={textStyle}>Tienes {wishlistItems.length} productos guardados en tu lista.</p>
                          <div className={styles.accountButtons}>
                            <Link to="/cuenta/wishlist" className={styles.primaryButton} onClick={closeDropdowns}>
                              Ver mi lista
                            </Link>
                          </div>
                        </>
                      );
                    }
                    return (
                      <>
                        <h3>{favConfig.loggedInTitle || 'Tus Favoritos'}</h3>
                        <p style={textStyle}>{favConfig.loggedInText || 'Aún no has marcado nada como favorito.'}</p>
                        <div className={styles.accountButtons}>
                          <Link to={favConfig.buttonLink || '/tienda'} className={styles.primaryButton} onClick={closeDropdowns}>
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
                        <Link to="/login" className={styles.primaryButton} onClick={closeDropdowns}>
                          Iniciar sesión
                        </Link>
                        <Link to="/tienda" className={styles.secondaryButton} onClick={closeDropdowns}>
                          Explorar tienda
                        </Link>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
          
          {user && <NotificationTray />}

          {!isNativeApp && (
          <div className={`${styles.accountDropdownContainer} ${activeDropdown === 'cuenta' ? styles.activeDropdown : ''} ${activeDropdown && activeDropdown !== 'cuenta' ? styles.forceHideHover : ''}`}>
            <Link to="/cuenta" className={styles.iconButton} onClick={(e) => handleMobileDropdownClick(e, 'cuenta')} aria-label="Mi cuenta">
              <User strokeWidth={1.5} className={styles.icon} />
            </Link>
            
            <div className={`${styles.accountPopup} ${styles.mobileCenteredPopup}`}>
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
                          <Link to="/encuesta-suscripcion" className={styles.primaryButton} onClick={closeDropdowns} style={{ background: '#8b5cf6', color: 'white', padding: '0.5rem', fontSize: '0.85rem' }}>
                            Completar Encuesta
                          </Link>
                        </div>
                      )}

                      <div className={styles.accountButtons}>
                        <Link to="/cuenta" className={styles.primaryButton} onClick={closeDropdowns}>
                          Mi Perfil
                        </Link>
                        <button onClick={() => { logout(); closeDropdowns(); }} className={styles.secondaryButton} style={{ width: '100%', cursor: 'pointer', border: '1px solid #ccc' }}>
                          Cerrar sesión
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3>{accountPopup.title}</h3>
                      <p>{accountPopup.description}</p>
                      
                      <div className={styles.accountButtons}>
                        <Link to={accountPopup.loginButtonUrl || '/login'} className={styles.primaryButton} onClick={closeDropdowns}>
                          {accountPopup.loginButtonText || 'Iniciar sesión'}
                        </Link>
                        <Link to={accountPopup.registerButtonUrl || '/registro'} className={styles.secondaryButton} onClick={closeDropdowns}>
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
          )}

          <div className={`${styles.accountDropdownContainer} ${activeDropdown === 'carrito' ? styles.activeDropdown : ''} ${activeDropdown && activeDropdown !== 'carrito' ? styles.forceHideHover : ''}`}>
            <Link to="/carrito" className={styles.iconButton} onClick={(e) => handleMobileDropdownClick(e, 'carrito')} aria-label="Carrito de compras">
              <ShoppingBag strokeWidth={1.5} className={styles.icon} />
              {cartItemsCount > 0 && (
                <span className={styles.cartBadge}>{cartItemsCount}</span>
              )}
            </Link>

            <div className={`${styles.accountPopup} ${styles.cartPopupWidth} ${styles.mobileCenteredPopup}`}>
              <div className={styles.accountPopupContent}>
                <h3 style={{textAlign: 'left', borderBottom: '1px solid #eee', paddingBottom: '0.75rem', marginBottom: '0.75rem'}}>Mi Carrito</h3>
                {cartItems.length === 0 ? (
                  <>
                    <p>Tu carrito está vacío en este momento.</p>
                    <div className={styles.accountButtons}>
                      <Link to="/tienda" className={styles.primaryButton} onClick={closeDropdowns}>Explorar tienda</Link>
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
                      <Link to="/carrito" className={styles.primaryButton} onClick={closeDropdowns} style={{width: '100%', boxSizing: 'border-box'}}>
                        Ir a pagar
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </header>

      {user && !userProfile?.hasCompletedSurvey && location.pathname !== '/encuesta-suscripcion' && (
        <Link to="/encuesta-suscripcion" className={styles.floatingSurveyBtn} onClick={closeDropdowns}>
          <span className={styles.floatingSurveyIcon}>🎁</span>
          <span className={styles.floatingSurveyLabel}>Completar Encuesta</span>
        </Link>
      )}
    </>
  );
};

export default Header;
