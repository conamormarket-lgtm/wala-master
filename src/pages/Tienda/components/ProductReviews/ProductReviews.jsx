import React, { useState, useEffect } from 'react';
import { Star, Upload, X } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useGlobalToast } from '../../../../contexts/ToastContext';
import { addReview, getProductReviews } from '../../../../services/reviews';
import Button from '../../../../components/common/Button';
import styles from './ProductReviews.module.css';

const ProductReviews = ({ productId }) => {
  const { user } = useAuth();
  const toast = useGlobalToast();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
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
      // Limpiar formulario
      setRating(5);
      setComment('');
      setImages([]);
      imagePreviews.forEach(URL.revokeObjectURL);
      setImagePreviews([]);
    } else {
      toast.error(error || "Error al enviar la reseña");
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Opiniones de Clientes</h2>

      {user ? (
        <form className={styles.formContainer} onSubmit={handleSubmit}>
          <h3 className={styles.formTitle}>Escribe una reseña</h3>
          
          <div className={styles.ratingSelect}>
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                className={`${styles.starBtn} ${star <= rating ? styles.starBtnActive : ''}`}
                onClick={() => setRating(star)}
              >
                <Star fill={star <= rating ? "currentColor" : "none"} size={24} />
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
      )}

      <div className={styles.reviewsList}>
        {loading ? (
          <p>Cargando reseñas...</p>
        ) : reviews.length > 0 ? (
          reviews.map(review => (
            <div key={review.id} className={styles.reviewItem}>
              <div className={styles.reviewHeader}>
                <span className={styles.reviewerName}>{review.userName}</span>
                <span className={styles.reviewDate}>
                  {review.createdAt instanceof Date 
                    ? review.createdAt.toLocaleDateString() 
                    : new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
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
              <p className={styles.reviewComment}>{review.comment}</p>
              
              {review.imageUrls && review.imageUrls.length > 0 && (
                <div className={styles.reviewImages}>
                  {review.imageUrls.map((url, i) => (
                    <img key={i} src={url} alt={`Reseña ${i+1}`} className={styles.reviewImg} loading="lazy" />
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className={styles.emptyState}>No hay reseñas aún. ¡Sé el primero en opinar!</p>
        )}
      </div>
    </div>
  );
};

export default ProductReviews;
