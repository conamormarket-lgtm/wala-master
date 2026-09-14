import React, { useRef, useState } from 'react';
import { uploadFile, deleteFile } from '../../services/firebase/storage';
import AvatarCropModal from './AvatarCropModal';
import styles from './AvatarStudio.module.css';

// Subidor simple de foto de perfil.
// Reemplaza al antiguo flujo de avatar 3D (Ready Player Me, ya descontinuado).
// Mantiene la MISMA interfaz de props { config, setConfig, onSave, isSaving }
// para no romper PerfilPage. La foto se guarda en config.avatarUrl.
//
// Compacto: antes era una card propia ("Foto de Perfil" + descripción +
// avatar grande + 2 botones apilados). Ahora vive DENTRO del encabezado de
// identidad de PerfilPage, como un círculo pequeño con una insignia de
// cámara superpuesta (patrón LinkedIn/WhatsApp) — sin título ni descripción
// repetidos, porque el encabezado ya dice de quién es la foto.
//
// Elegir foto ya no sube el archivo tal cual: abre AvatarCropModal para que
// el usuario elija qué parte de la imagen se ve (círculo fijo) ANTES de que
// se suba nada. Tanto recortar como quitar guardan solos — no hay botón
// "Guardar foto" aparte, para que el cambio quede confirmado de una.
export default function AvatarStudio({ config, setConfig, onSave, isSaving, uid }) {
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    // Object URL del archivo recién elegido, pendiente de recortar. null =
    // el modal de recorte está cerrado.
    const [imageToCrop, setImageToCrop] = useState(null);

    const avatarUrl = config?.avatarUrl || null;
    const busy = isUploading || isRemoving || isSaving;

    // Abre el selector de archivos nativo.
    const handlePickFile = () => {
        if (busy) return;
        fileInputRef.current?.click();
    };

    // En vez de subir el archivo elegido tal cual, abre el modal de recorte.
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        // Permite volver a elegir el mismo archivo en una nueva selección.
        e.target.value = '';
        if (!file) return;

        // Las reglas de Storage (firebase/storage.rules) exigen que la ruta sea
        // users/{tu-propio-uid}/... para poder escribir ahí. Sin uid no hay a
        // dónde subir con permiso.
        if (!uid) {
            setUploadError('No se pudo identificar tu cuenta. Refresca la página e inténtalo de nuevo.');
            return;
        }

        setUploadError(null);
        setImageToCrop(URL.createObjectURL(file));
    };

    const handleCropCancel = () => {
        if (imageToCrop) URL.revokeObjectURL(imageToCrop);
        setImageToCrop(null);
    };

    // Recorte confirmado: sube la foto YA recortada y guarda el cambio de
    // una. Le pasamos el config actualizado a onSave EN VEZ de confiar en que
    // PerfilPage ya haya re-renderizado con el nuevo avatarUrl -setConfig es
    // async: si onSave leyera su propio estado por clausura, en este mismo
    // tick todavía tendría el valor viejo (ver handleSaveAvatar en
    // PerfilPage.jsx, que ahora acepta ese override-.
    const handleCropConfirm = async (blob) => {
        const sourceUrl = imageToCrop;
        setImageToCrop(null);
        setUploadError(null);
        setIsUploading(true);
        const oldAvatarUrl = avatarUrl;
        try {
            const path = `users/${uid}/avatars/${Date.now()}_cropped.jpg`;
            const { url, error } = await uploadFile(blob, path);
            if (error || !url) {
                setUploadError(error || 'No se pudo subir la foto. Inténtalo de nuevo.');
                return;
            }
            // Limpiamos los restos del antiguo avatar 3D: isRpm:false y glbUrl:null.
            const nextConfig = { ...config, isRpm: false, avatarUrl: url, glbUrl: null };
            setConfig(() => nextConfig);
            const { error: saveError } = (await onSave(nextConfig)) || {};
            if (saveError) {
                setUploadError('La foto se subió pero no se pudo guardar. Inténtalo de nuevo.');
            } else if (oldAvatarUrl) {
                // La foto anterior ya no hace falta — se borra recién ahora
                // que la nueva quedó confirmada en Firestore, no antes.
                deleteFile(oldAvatarUrl).catch(() => {});
            }
        } catch (err) {
            setUploadError('No se pudo subir la foto. Inténtalo de nuevo.');
        } finally {
            setIsUploading(false);
            if (sourceUrl) URL.revokeObjectURL(sourceUrl);
        }
    };

    // Quita la foto y guarda al toque, mismo criterio que recortar. El
    // archivo de Storage se borra SOLO si el guardado confirma bien, para no
    // dejar una URL rota en Firestore si el guardado fallara (ver commit
    // "Fix: quitar foto dejaba avatar roto...").
    const handleRemovePhoto = async () => {
        if (!avatarUrl || busy) return;
        if (!window.confirm('¿Quitar tu foto de perfil?')) return;

        setUploadError(null);
        setIsRemoving(true);
        const oldAvatarUrl = avatarUrl;
        try {
            const nextConfig = { ...config, avatarUrl: null };
            setConfig(() => nextConfig);
            const { error: saveError } = (await onSave(nextConfig)) || {};
            if (saveError) {
                setUploadError('No se pudo guardar el cambio. Inténtalo de nuevo.');
            } else {
                deleteFile(oldAvatarUrl).catch(() => {});
            }
        } finally {
            setIsRemoving(false);
        }
    };

    return (
        <div className={styles.compactWrap}>
            <div className={styles.avatarCircle}>
                {/* El recorte circular vive en este wrapper interno, NO en
                    .avatarCircle: si el overflow:hidden estuviera en el
                    mismo elemento que la insignia de cámara (posicionada
                    fuera del borde con right/bottom negativos), el propio
                    círculo se la recortaría y quedaba oculta. */}
                <div className={styles.avatarInner}>
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Foto de perfil" className={styles.avatarImg} />
                    ) : (
                        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.avatarPlaceholderIcon}>
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    )}
                </div>

                <button
                    type="button"
                    onClick={handlePickFile}
                    disabled={busy}
                    className={styles.editBadge}
                    aria-label="Cambiar foto de perfil"
                    title="Cambiar foto de perfil"
                >
                    {isUploading ? (
                        <span className={styles.spinner} aria-hidden="true" />
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                    )}
                </button>

                {avatarUrl && (
                    <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={busy}
                        className={styles.removeBadge}
                        aria-label="Quitar foto de perfil"
                        title="Quitar foto de perfil"
                    >
                        {isRemoving ? (
                            <span className={styles.spinner} aria-hidden="true" />
                        ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        )}
                    </button>
                )}
            </div>

            {/* Input de archivo oculto; se dispara con la insignia de cámara. */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />

            {uploadError && (
                <p className={styles.uploadError}>{uploadError}</p>
            )}

            {imageToCrop && (
                <AvatarCropModal
                    imageSrc={imageToCrop}
                    onConfirm={handleCropConfirm}
                    onCancel={handleCropCancel}
                />
            )}
        </div>
    );
}
