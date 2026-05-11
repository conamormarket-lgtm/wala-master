import React, { useState, useEffect } from 'react';
import { Star, Upload, X, ThumbsUp } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useGlobalToast } from '../../../../contexts/ToastContext';
import { addReview, getProductReviews, toggleHelpfulVote } from '../../../../services/reviews';
import Button from '../../../../components/common/Button';
import styles from './ProductReviews.module.css';

const ProductReviews = ({ productId }) => {
  const { user } = useAuth();
  const toast = useGlobalToast();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!productId) return;
    const fetchReviews = async () => {
      setLoading(true);
      const data = await getProductReviews(productId);
      setReviews(data);
      setLoading(false);
    };
    fetchReviews();
  }, [productId]);

  const handleImageChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      if (images.length + filesArray.length > 5) {
        toast.error("Máximo 5 imágenes permitidas");
        return;
      }
      setImages(prev => [...prev, ...filesArray]);

      const previews = filesArray.map(file => URL.createObjectURL(file));
      setImagePreviews(prev => [...prev, ...previews]);
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      toast.error("Por favor selecciona una calificación");
      return;
    }
    if (!comment.trim()) {
      toast.error("Por favor escribe un comentario");
      return;
    }

    setIsSubmitting(true);
    const { success, error, data } = await addReview(productId, user, rating, comment, images);
    setIsSubmitting(false);

    if (success && data) {
      toast.success("¡Gracias por tu reseña!");
      setReviews(prev => [data, ...prev]);
      // Limpiar formulario y cerrar
      setRating(5);
      setComment('');
      setImages([]);
      imagePreviews.forEach(URL.revokeObjectURL);
      setImagePreviews([]);
      setShowForm(false);
    } else {
      toast.error(error || "Error al enviar la reseña");
    }
  };

  const handleHelpfulVote = async (reviewId) => {
    if (!user) {
      toast.error("Inicia sesión para votar");
      return;
    }
    const { success, voted, error } = await toggleHelpfulVote(reviewId, user.uid);
    if (success) {
      setReviews(prev => prev.map(r => {
        if (r.id === reviewId) {
          const currentVotes = r.helpfulVotes || [];
          const newVotes = voted 
            ? [...currentVotes, user.uid] 
            : currentVotes.filter(id => id !== user.uid);
          return { ...r, helpfulVotes: newVotes };
        }
        return r;
      }));
    } else {
      toast.error(error || "Error al registrar el voto");
    }
  };

  // Stats calculation
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 
    ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews).toFixed(1) 
    : 0;

  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach(r => ratingCounts[r.rating]++);
  
  const ratingPercentages = {
    5: totalReviews > 0 ? Math.round((ratingCounts[5] / totalReviews) * 100) : 0,
    4: totalReviews > 0 ? Math.round((ratingCounts[4] / totalReviews) * 100) : 0,
    3: totalReviews > 0 ? Math.round((ratingCounts[3] / totalReviews) * 100) : 0,
    2: totalReviews > 0 ? Math.round((ratingCounts[2] / totalReviews) * 100) : 0,
    1: totalReviews > 0 ? Math.round((ratingCounts[1] / totalReviews) * 100) : 0,
  };

  // Collect all images across reviews
  const allReviewImages = [];
  reviews.forEach(r => {
    if (r.imageUrls) {
      r.imageUrls.forEach(url => allReviewImages.push(url));
    }
  });

  // Calculate Featured Review
  const featuredReview = React.useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    let topReview = null;
    let maxVotes = 0;

    for (const r of reviews) {
      const votes = r.helpfulVotes?.length || 0;
      if (votes > maxVotes) {
        maxVotes = votes;
        topReview = r;
      } else if (votes === maxVotes && maxVotes > 0) {
        // Empate: priorizar el que tiene imágenes
        const hasImgsA = topReview?.imageUrls?.length > 0;
        const hasImgsB = r.imageUrls?.length > 0;
        if (hasImgsB && !hasImgsA) {
          topReview = r;
        }
      }
    }
    // Solo mostrar si tiene al menos 1 voto
    return maxVotes > 0 ? topReview : null;
  }, [reviews]);

  const renderReviewItem = (review, isFeatured = false) => {
    const helpfulCount = review.helpfulVotes?.length || 0;
    const userHasVoted = user && review.helpfulVotes?.includes(user.uid);

    return (
      <div key={review.id} className={isFeatured ? styles.featuredReviewCard : styles.reviewItem}>
        {isFeatured && (
          <div className={styles.featuredBadge}>
            <Star size={12} fill="currentColor" /> Opinión destacada por la comunidad
          </div>
        )}
        <div className={styles.reviewHeader}>
          <div className={styles.reviewerAvatar}>
            {review.userName.charAt(0).toUpperCase()}
          </div>
          <span className={styles.reviewerName}>{review.userName}</span>
        </div>
        <div className={styles.reviewSubHeader}>
          <div className={styles.reviewStars}>
            {[1, 2, 3, 4, 5].map(star => (
              <Star 
                key={star} 
                size={16} 
                fill={star <= review.rating ? "currentColor" : "none"} 
                color={star <= review.rating ? "currentColor" : "#cbd5e1"} 
              />
            ))}
          </div>
          <span className={styles.reviewDate}>
            {review.createdAt instanceof Date 
              ? review.createdAt.toLocaleDateString() 
              : new Date(review.createdAt).toLocaleDateString()}
          </span>
        </div>
        <p className={styles.reviewComment}>{review.comment}</p>
        
        {review.imageUrls && review.imageUrls.length > 0 && (
          <div className={styles.reviewImages}>
            {review.imageUrls.map((url, i) => (
              <img key={i} src={url} alt={`Reseña ${i+1}`} className={styles.reviewImg} loading="lazy" />
            ))}
          </div>
        )}

        <div className={styles.reviewActions}>
          <button 
            className={`${styles.helpfulBtn} ${userHasVoted ? styles.helpfulBtnActive : ''}`}
            onClick={() => handleHelpfulVote(review.id)}
          >
            <ThumbsUp size={14} fill={userHasVoted ? "currentColor" : "none"} />
            Útil
          </button>
          {helpfulCount > 0 && (
            <span className={styles.helpfulText}>
              A {helpfulCount} persona{helpfulCount === 1 ? '' : 's'} le pareció útil
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.amazonLayout}>
        
        {/* Columna Izquierda */}
        <div className={styles.leftColumn}>
          <h2 className={styles.title}>Opiniones de Clientes</h2>
          
          <div className={styles.ratingSummary}>
            <div className={styles.averageHeader}>
              <div className={styles.averageStars}>
                {[1, 2, 3, 4, 5].map(star => (
                  <Star 
                    key={star} 
                    size={24} 
                    fill={star <= Math.round(averageRating) ? "currentColor" : "none"} 
                    color={star <= Math.round(averageRating) ? "currentColor" : "#cbd5e1"} 
                  />
                ))}
              </div>
              <span>{averageRating} de 5</span>
            </div>
            <p className={styles.totalReviews}>{totalReviews} calificaciones globales</p>
            
            <div className={styles.ratingBars}>
              {[5, 4, 3, 2, 1].map(star => (
                <div key={star} className={styles.ratingRow}>
                  <span className={styles.starLabel}>{star} estrella{star === 1 ? '' : 's'}</span>
                  <div className={styles.barContainer}>
                    <div className={styles.barFill} style={{ width: `${ratingPercentages[star]}%` }}></div>
                  </div>
                  <span className={styles.percentText}>{ratingPercentages[star]}%</span>
                </div>
              ))}
            </div>
          </div>

          <hr className={styles.divider} />

          <div className={styles.writeReviewSection}>
            <h3>Revisa este producto</h3>
            <p>Comparte tus pensamientos con otros clientes</p>
            <button className={styles.writeReviewBtn} onClick={() => setShowForm(!showForm)}>
              Escribir una opinión
            </button>
          </div>

          {showForm && (
            user ? (
              <form className={styles.formContainer} onSubmit={handleSubmit}>
                <div className={styles.formTitle}>
                  Escribe una reseña
                  <button type="button" className={styles.closeFormBtn} onClick={() => setShowForm(false)} title="Cerrar">
                    <X size={18} />
                  </button>
                </div>
                
                <div className={styles.ratingSelect}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      className={`${styles.starBtn} ${star <= rating ? styles.starBtnActive : ''}`}
                      onClick={() => setRating(star)}
                    >
                      <Star fill={star <= rating ? "currentColor" : "none"} size={28} />
                    </button>
                  ))}
                </div>

                <textarea
                  className={styles.textarea}
                  placeholder="¿Qué te pareció este producto?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={isSubmitting}
                />

                <div className={styles.uploadSection}>
                  <label className={styles.uploadLabel}>
                    <Upload size={18} />
                    Adjuntar Fotos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className={styles.fileInput}
                      onChange={handleImageChange}
                      disabled={isSubmitting || images.length >= 5}
                    />
                  </label>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '10px' }}>
                    (Max. 5 fotos)
                  </span>

                  {imagePreviews.length > 0 && (
                    <div className={styles.previewGrid}>
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className={styles.previewItem}>
                          <img src={preview} alt="preview" className={styles.previewImg} />
                          <button
                            type="button"
                            className={styles.removeImgBtn}
                            onClick={() => removeImage(index)}
                            disabled={isSubmitting}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button 
                  type="submit" 
                  variant="primary" 
                  className={styles.submitBtn}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Enviando...' : 'Publicar Reseña'}
                </Button>
              </form>
            ) : (
              <div className={styles.loginPrompt}>
                <p>Inicia sesión o regístrate para dejar una opinión sobre este producto.</p>
              </div>
            )
          )}
        </div>

        {/* Columna Derecha */}
        <div className={styles.rightColumn}>
          
          {allReviewImages.length > 0 && (
            <>
              <h3 className={styles.rightTitle} style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
                Reseñas con imágenes
              </h3>
              <div className={styles.reviewImages} style={{ marginBottom: '2.5rem' }}>
                {allReviewImages.slice(0, 12).map((url, i) => (
                  <img key={i} src={url} alt="User upload" className={styles.reviewImg} style={{ width: '80px', height: '80px' }} />
                ))}
              </div>
            </>
          )}

          {featuredReview && (
            <>
              <h3 className={styles.rightTitle} style={{ marginBottom: '1rem' }}>
                Reseña principal de Perú
              </h3>
              {renderReviewItem(featuredReview, true)}
              <hr className={styles.divider} style={{ marginTop: '0', marginBottom: '2rem' }} />
            </>
          )}

          <h3 className={styles.rightTitle}>Todas las reseñas</h3>
          <div className={styles.reviewsList}>
            {loading ? (
              <p>Cargando reseñas...</p>
            ) : reviews.length > 0 ? (
              reviews.filter(r => r.id !== featuredReview?.id).map(review => renderReviewItem(review))
            ) : (
              <p className={styles.emptyState}>No hay reseñas aún. ¡Sé el primero en opinar!</p>
            )}
            
            {/* Si solo existía la reseña destacada */}
            {!loading && reviews.length > 0 && reviews.filter(r => r.id !== featuredReview?.id).length === 0 && (
               <p className={styles.emptyState} style={{padding: '0'}}>No hay más reseñas para mostrar.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProductReviews;
