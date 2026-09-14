import React, { useRef, useState } from 'react';
import { uploadFile, deleteFile } from '../../services/firebase/storage';
import styles from './AvatarStudio.module.css';
import { T } from '../../i18n/useTranslatedText';

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
export default function AvatarStudio({ config, setConfig, onSave, isSaving, uid }) {
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    // "Guardar foto" antes solo aparecía si HAY foto (avatarUrl truthy) —
    // servía para subir, pero no había forma de persistir un QUITAR (volver a
    // sin foto). dirty cubre ese caso: se prende también al quitar, para que
    // el link de guardar siga visible y el usuario pueda confirmar el cambio.
    const [dirty, setDirty] = useState(false);

    const avatarUrl = config?.avatarUrl || null;

    // Abre el selector de archivos nativo.
    const handlePickFile = () => {
        if (isUploading || isSaving) return;
        fileInputRef.current?.click();
    };

    // Sube la imagen elegida a Firebase Storage y la guarda en el config.
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        // Permite volver a elegir el mismo archivo en una nueva selección.
        e.target.value = '';
        if (!file) return;

        // Las reglas de Storage (firebase/storage.rules) exigen que la ruta sea
        // users/{tu-propio-uid}/... para poder escribir ahí. Antes esta ruta era
        // literalmente "users/avatars/..." -"avatars" como si fuera el uid-, así
        // que SIEMPRE se rechazaba por permisos: la subida nunca funcionaba,
        // para NINGÚN usuario. Sin uid no hay a dónde subir con permiso.
        if (!uid) {
            setUploadError('No se pudo identificar tu cuenta. Refresca la página e inténtalo de nuevo.');
            return;
        }

        setUploadError(null);
        setIsUploading(true);
        try {
            const path = `users/${uid}/avatars/${Date.now()}_${file.name}`;
            const { url, error } = await uploadFile(file, path);
            if (error || !url) {
                setUploadError(error || 'No se pudo subir la foto. Inténtalo de nuevo.');
                return;
            }
            // Limpiamos los restos del antiguo avatar 3D: isRpm:false y glbUrl:null.
            setConfig(prev => ({ ...prev, isRpm: false, avatarUrl: url, glbUrl: null }));
            setDirty(true);
        } catch (err) {
            setUploadError('No se pudo subir la foto. Inténtalo de nuevo.');
        } finally {
            setIsUploading(false);
        }
    };

    // Quita la foto actual: la borra de Storage (best-effort — si la URL no
    // es de Storage o ya no existe, simplemente se ignora, como en
    // AdminProductoFormV2/AdminProductos) y limpia el avatar localmente. El
    // cambio recién queda guardado cuando el usuario confirma con "Guardar
    // foto" (mismo flujo que subir una nueva), para no borrar en Firestore
    // sin que el usuario lo pida explícitamente.
    const handleRemovePhoto = async () => {
        if (!avatarUrl || isUploading || isSaving || isRemoving) return;
        if (!window.confirm('¿Quitar tu foto de perfil?')) return;

        setUploadError(null);
        setIsRemoving(true);
        try {
            await deleteFile(avatarUrl).catch(() => {});
            setConfig(prev => ({ ...prev, avatarUrl: null }));
            setDirty(true);
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
                    disabled={isUploading || isSaving || isRemoving}
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
                        disabled={isUploading || isSaving || isRemoving}
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

            {(avatarUrl || dirty) && (
                <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving || isUploading || isRemoving}
                    className={styles.saveLink}
                >
                    {isSaving ? <T>Guardando...</T> : <T>Guardar foto</T>}
                </button>
            )}

            {uploadError && (
                <p className={styles.uploadError}>{uploadError}</p>
            )}
        </div>
    );
}
