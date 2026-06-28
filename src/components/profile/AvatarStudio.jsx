import React, { useRef, useState } from 'react';
import { uploadFile } from '../../services/firebase/storage';
import styles from './AvatarStudio.module.css';

// Subidor simple de foto de perfil.
// Reemplaza al antiguo flujo de avatar 3D (Ready Player Me, ya descontinuado).
// Mantiene la MISMA interfaz de props { config, setConfig, onSave, isSaving }
// para no romper PerfilPage. La foto se guarda en config.avatarUrl.
export default function AvatarStudio({ config, setConfig, onSave, isSaving }) {
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);

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

        setUploadError(null);
        setIsUploading(true);
        try {
            const path = 'users/avatars/' + Date.now() + '_' + file.name;
            const { url, error } = await uploadFile(file, path);
            if (error || !url) {
                setUploadError(error || 'No se pudo subir la foto. Inténtalo de nuevo.');
                return;
            }
            // Limpiamos los restos del antiguo avatar 3D: isRpm:false y glbUrl:null.
            setConfig(prev => ({ ...prev, isRpm: false, avatarUrl: url, glbUrl: null }));
        } catch (err) {
            setUploadError('No se pudo subir la foto. Inténtalo de nuevo.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className={styles.studioContainer}>
            <div className={styles.studioMain}>
                <div className={styles.previewArea}>
                    <div className={styles.avatarStage}>
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt="Foto de perfil"
                                className={styles.rpmAvatarImg}
                            />
                        ) : (
                            <div className={styles.avatarPlaceholder}>
                                <svg viewBox="0 0 24 24" width="70" height="70" fill="none" stroke="var(--gris-texto-secundario)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                <p>Sin foto de perfil</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.controlsArea}>
                    <div className={styles.infoBox}>
                        <h3>Foto de Perfil</h3>
                        <p>Sube una foto para personalizar tu perfil. Se mostrará como tu avatar en Walá.</p>
                    </div>

                    {/* Input de archivo oculto; se dispara con el botón "Subir foto de perfil". */}
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

                    <div className={styles.actionButtons}>
                        <button
                            type="button"
                            onClick={handlePickFile}
                            disabled={isUploading || isSaving}
                            className={styles.btnSecondary}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            {isUploading ? 'Subiendo...' : (avatarUrl ? 'Cambiar foto de perfil' : 'Subir foto de perfil')}
                        </button>

                        <button
                            type="button"
                            onClick={onSave}
                            disabled={isSaving || isUploading || !avatarUrl}
                            className={styles.btnPrimary}
                        >
                            {isSaving ? 'Guardando...' : 'Guardar foto'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
