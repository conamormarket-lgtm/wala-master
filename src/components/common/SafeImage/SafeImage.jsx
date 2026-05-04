import React, { useState } from 'react';
import { getGoogleDriveFileId } from '../../../utils/imageUrl';

const SafeImage = ({ src, alt, className, style, onClick, isCarousel }) => {
    const [attempt, setAttempt] = useState(0);

    if (!src) return null;

    const fileId = getGoogleDriveFileId(src);

    // If not Google Drive, just render standard img
    if (!fileId) {
        return (
            <img
                src={src}
                alt={alt}
                className={className}
                style={style}
                onClick={onClick}
                onError={(e) => {
                    // Si el src original no tiene fileId y falla, no hay más por hacer.
                }}
            />
        );
    }

    // Strategies for Google Drive
    // 1. lh3.googleusercontent.com is often the most direct bypass currently.
    // 2. drive.google.com/thumbnail is the official intended way for thumbnails.
    // 3. drive.google.com/uc?export=view is the old legacy way.
    const strategies = [
        `https://lh3.googleusercontent.com/d/${fileId}`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
        `https://drive.google.com/uc?export=view&id=${fileId}`,
    ];

    const handleError = () => {
        if (attempt < strategies.length) {
            setAttempt((prev) => prev + 1);
        }
    };

    const currentSrc = strategies[attempt];

    // If all image strategies fail, use the infallible iframe preview
    if (attempt >= strategies.length) {
        if (isCarousel) {
            return (
                <iframe
                    src={`https://drive.google.com/file/d/${fileId}/preview`}
                    title={alt}
                    className={className}
                    style={{ ...style, border: 'none', background: '#f3f4f6', width: '100%', height: '100%' }}
                    allow="autoplay"
                />
            );
        }

        return (
            <div
                className={className}
                style={{
                    ...style,
                    overflow: 'hidden',
                    position: 'relative',
                    background: '#f3f4f6',
                    cursor: onClick ? 'pointer' : 'default',
                }}
                onClick={onClick}
            >
                <iframe
                    src={`https://drive.google.com/file/d/${fileId}/preview`}
                    title={alt}
                    style={{
                        position: 'absolute',
                        top: '-50px',
                        left: '-10px',
                        width: 'calc(100% + 20px)',
                        height: 'calc(100% + 100px)',
                        border: 'none',
                        pointerEvents: 'none',
                    }}
                    tabIndex={-1}
                />
            </div>
        );
    }

    return (
        <img
            src={currentSrc}
            alt={alt}
            className={className}
            style={style}
            onClick={onClick}
            onError={handleError}
        />
    );
};

export default SafeImage;
