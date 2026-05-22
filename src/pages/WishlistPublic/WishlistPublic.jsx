import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getWishlistByUserCode } from '../../services/wishlist';
import { useCart } from '../../contexts/CartContext';
import { useGlobalToast } from '../../contexts/ToastContext';
import { db } from '../../services/firebase/config';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useProducts } from '../../hooks/useProducts';
import ProductCard from '../Tienda/components/ProductCard/ProductCard';
import styles from './WishlistPublic.module.css';

const WishlistPublic = () => {
  const { userCode } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToast } = useGlobalToast();
  
  const { data: allProducts, isLoading: productsLoading } = useProducts([]);
  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ownerName, setOwnerName] = useState('Alguien');

  useEffect(() => {
    const fetchWishlist = async () => {
      setLoading(true);
      const { data, error } = await getWishlistByUserCode(userCode);
      
      if (error || !data) {
        setError(error || 'Lista no encontrada');
        setLoading(false);
        return;
      }
      
      setWishlist(data);

      // Try to get the owner's name
      if (data.userId) {
        try {
          const userDoc = await getDoc(doc(db, 'portal_clientes_users', data.userId));
          if (userDoc.exists()) {
            setOwnerName(userDoc.data().displayName || userDoc.data().name || 'Alguien');
          }
        } catch (e) {
          console.error("Error fetching user name:", e);
        }
      }

      setLoading(false);

      // Notify the owner that someone visited their wishlist
      // (This could be optimized to not spam)
      try {
        if (data.userId) {
          await addDoc(collection(db, `users/${data.userId}/notifications`), {
            title: '¡Alguien visitó tu lista de deseos! 👀',
            body: 'Un amigo o familiar acaba de ver tu lista de regalos.',
            createdAt: new Date().toISOString(),
            read: false,
            type: 'wishlist_visit'
          });
        }
      } catch (e) {
        console.error("Error notifying owner:", e);
      }
    };

    if (userCode) {
      fetchWishlist();
    }
  }, [userCode]);

  const handleGift = (item) => {
    const fullProduct = typeof item === 'object' && item.id ? item : undefined;
    const price = fullProduct?.salePrice || fullProduct?.price || 0;
    
    const productMock = {
      id: item.productId || fullProduct?.id,
      name: item.productName || fullProduct?.name,
      mainImage: item.productImage || fullProduct?.mainImage,
      price: price,
      // Flag para saber que es un regalo
      isWishlistGift: true,
      wishlistUserCode: userCode
    };

    addToCart(productMock, {}, null, 1);
    addToast('¡Producto agregado a tu carrito! Podrás elegir dónde enviarlo en el Checkout.', 'success');
    navigate('/carrito');
  };

  if (loading || productsLoading) {
    return <div className={styles.container}><p>Cargando lista de deseos...</p></div>;
  }

  if (error || !wishlist) {
    return (
      <div className={styles.container}>
        <h2>Lista no encontrada</h2>
        <p>El enlace que seguiste no es válido o la lista ya no existe.</p>
        <Link to="/tienda" className={styles.primaryBtn}>Ir a la tienda</Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Lista de deseos de {ownerName} 🎁</h1>
        <p>Elige un regalo de esta lista y sorpréndele.</p>
      </div>

      {wishlist.items?.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Esta lista está vacía actualmente.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {wishlist.items.map((item) => {
            const fullProduct = allProducts?.find(p => p.id === item.productId);
            
            if (!fullProduct) return null; // No renderizar si no se encuentra en el sistema

            return (
              <div key={item.productId} className={styles.cardWrapper}>
                {item.isGifted && (
                  <div className={styles.giftedOverlay}>
                    ¡Ya regalado! 🎉
                  </div>
                )}
                
                <ProductCard 
                  product={fullProduct} 
                  onAddToCartOverride={() => handleGift(fullProduct)}
                />
                
                {!item.isGifted && (
                  <button 
                    onClick={() => handleGift(fullProduct)}
                    className={styles.giftBtnOverlay}
                  >
                    Regalar esto 🎁
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WishlistPublic;
