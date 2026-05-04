import React, { useState, useEffect, useRef } from 'react';
import styles from './AvatarStudio.module.css';

export default function AvatarStudio({ config, setConfig, onSave, isSaving }) {
    const [showCreator, setShowCreator] = useState(false);
    const iframeRef = useRef(null);
    const subdomain = "demo"; // Sandbox domain for Ready Player Me

    useEffect(() => {
        const handleMessage = (event) => {
            try {
                const json = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

                if (json?.source !== 'readyplayerme') return;

                if (json.eventName === 'v1.avatar.exported') {
                    // La URL puede venir en 'json.data.url' o en 'json.data' dependiendo de la plataforma de IFrame
                    const avatarUrl = json.data?.url || json.data;

                    if (typeof avatarUrl === 'string' && avatarUrl.includes('.glb')) {
                        const renderedPngUrl = avatarUrl.replace('.glb', '.png') + '?scene=fullbody-portrait-v1&blendShapes[Wolf3D_Head][mouthSmile]=0.5';

                        setConfig(prev => ({
                            ...prev,
                            isRpm: true,
                            avatarUrl: renderedPngUrl,
                            glbUrl: avatarUrl
                        }));

                        setShowCreator(false);
                    }
                }
            } catch (err) {
                // Ignore parse errors from unknown frames
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [setConfig]);

    const openAvatarCreator = () => {
        setShowCreator(true);
    };

    const hasRpmAvatar = config?.isRpm && config?.avatarUrl;

    return (
        <div className={styles.studioContainer}>
            {!showCreator ? (
                <div className={styles.studioMain}>
                    <div className={styles.previewArea}>
                        <div className={styles.avatarStage}>
                            {hasRpmAvatar ? (
                                <img
                                    src={config.avatarUrl}
                                    alt="3D AI Avatar"
                                    className={styles.rpmAvatarImg}
                                />
                            ) : (
                                <div className={styles.avatarPlaceholder}>
                                    <svg viewBox="0 0 24 24" width="70" height="70" fill="none" stroke="var(--gris-texto-secundario)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                    <p>Tu Avatar IA</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.controlsArea}>
                        <div className={styles.infoBox}>
                            <h3>Generador de Avatares con IA</h3>
                            <p>¡Sube una selfie y nuestra inteligencia artificial creará tu propio avatar realista y de cuerpo completo! Podrás vestirlo, probarle distintos tipos de cabello y rasgos faciales.</p>
                        </div>

                        <div className={styles.actionButtons}>
                            <button
                                type="button"
                                onClick={openAvatarCreator}
                                className={styles.btnSecondary}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                {hasRpmAvatar ? 'Editar Avatar' : 'Crear Avatar con Foto'}
                            </button>

                            <button
                                type="button"
                                onClick={onSave}
                                disabled={isSaving || !hasRpmAvatar}
                                className={styles.btnPrimary}
                            >
                                {isSaving ? 'Guardando...' : 'Guardar Avatar'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className={styles.iframeWrapper}>
                    <div className={styles.iframeHeader}>
                        <h4>Diseñando tu Avatar 3D...</h4>
                        <button type="button" onClick={() => setShowCreator(false)} className={styles.closeBtn}>Terminar luego</button>
                    </div>
                    {/* The ?frameApi=true param tells RPMe to send postMessage events */}
                    <iframe
                        ref={iframeRef}
                        id="rpm-frame"
                        className={styles.rpmIframe}
                        title="Ready Player Me Avatar Creator"
                        allow="camera *; microphone *; clipboard-write; clipboard-read; display-capture; fullscreen"
                        src={`https://${subdomain}.readyplayer.me/avatar?frameApi&clearCache=true&selectBodyType`}
                    />
                </div>
            )}
        </div>
    );
}
