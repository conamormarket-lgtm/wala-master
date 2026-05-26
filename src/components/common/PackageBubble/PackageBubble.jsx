import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, X, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCart } from '../../../contexts/CartContext';
import { onSnapshot, query, collection, where } from 'firebase/firestore';
import { db } from '../../../services/firebase/config';
import styles from './PackageBubble.module.css';

export default function PackageBubble() {
  const { user, userProfile, updateUserProfile } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [packages, setPackages] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [addedPkgs, setAddedPkgs] = useState(new Set());

  // ── Listen to suggested packages in realtime ──
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'suggested_packages'),
      where('userId', '==', user.uid),
      where('isSelected', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pkgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPackages(pkgs);
    }, (error) => {
      console.error('Error fetching user suggested packages realtime:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const lastSeen = userProfile?.lastSeenPackagesAt || '';
  const unseenPackages = packages.filter((pkg) => {
    const pkgDate = pkg.updatedAt || pkg.createdAt;
    return pkgDate > lastSeen;
  });

  // ── Open modal & mark as seen ──
  const openModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    updateUserProfile({ lastSeenPackagesAt: new Date().toISOString() });
  }, [updateUserProfile]);

  // ── Add all products of a package to cart ──
  const handleAddToCart = useCallback(
    (pkg) => {
      if (!pkg.products) return;
      pkg.products.forEach((prod) => {
        addToCart({
          id: prod.id,
          name: prod.name,
          price: prod.price,
          images: [prod.image],
        });
      });
      setAddedPkgs((prev) => new Set(prev).add(pkg.id));
    },
    [addToCart]
  );

  // ── Navigate to fechas-importantes ──
  const goToFechas = useCallback(() => {
    closeModal();
    navigate('/cuenta/fechas-importantes');
  }, [navigate, closeModal]);

  // ── Guard: nothing to show ──
  if (!user || unseenPackages.length === 0) return null;

  return (
    <>
      {/* Floating bubble */}
      <button
        className={styles.bubble}
        onClick={openModal}
        aria-label="Paquetes sugeridos"
      >
        <Gift size={24} strokeWidth={2} />
        <span className={styles.badge}>{unseenPackages.length}</span>
      </button>

      {/* Modal overlay */}
      <div
        className={`${styles.overlay} ${modalOpen ? styles.overlayVisible : ''}`}
        onClick={closeModal}
      >
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          {/* Close */}
          <button className={styles.closeBtn} onClick={closeModal} aria-label="Cerrar">
            <X size={18} />
          </button>

          {/* Header */}
          <div className={styles.header}>
            <h2 className={styles.title}>Tenemos regalos pensados para ti</h2>
          </div>

          {/* Body */}
          <div className={styles.body}>
            {unseenPackages.map((pkg) => (
              <div key={pkg.id} className={styles.packageCard}>
                <p className={styles.eventType}>{pkg.eventType}</p>

                <div className={styles.productsRow}>
                  {pkg.products?.map((prod) => (
                    <div key={prod.id} className={styles.productItem}>
                      <img
                        className={styles.productImg}
                        src={prod.image}
                        alt={prod.name}
                        loading="lazy"
                      />
                      <span className={styles.productName}>{prod.name}</span>
                      <span className={styles.productPrice}>
                        ${Number(prod.price).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  className={styles.addBtn}
                  disabled={addedPkgs.has(pkg.id)}
                  onClick={() => handleAddToCart(pkg)}
                >
                  {addedPkgs.has(pkg.id) ? (
                    'Agregado'
                  ) : (
                    <>
                      <ShoppingCart size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      Agregar al carrito
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <button className={styles.viewBtn} onClick={goToFechas}>
              Ver en Fechas Importantes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
