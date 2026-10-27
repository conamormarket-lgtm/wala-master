// Generated from wala-mobile. Regenerate with export-payment-domain.mjs.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.toAppError = toAppError;
class AppError extends Error {
    code;
    retryable;
    constructor(code, message, retryable = false) {
        super(message);
        this.code = code;
        this.retryable = retryable;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
// Mensajes controlados: no exponer respuestas del SDK, contraseñas ni tokens.
function toAppError(error) {
    if (error instanceof AppError)
        return error;
    const rawCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const code = rawCode.split('/').pop();
    if (['invalid-credential', 'wrong-password', 'user-not-found', 'invalid-login-credentials', 'user-disabled'].includes(code ?? '')) {
        return new AppError('credentials', 'No pudimos iniciar sesión. Revisa tu correo y contraseña.');
    }
    if (['network-request-failed', 'unavailable', 'deadline-exceeded'].includes(code ?? '')) {
        return new AppError('network', 'No pudimos conectarnos. Revisa tu conexión e inténtalo otra vez.', true);
    }
    if (['permission-denied', 'unauthenticated'].includes(code ?? ''))
        return new AppError('permission', 'No tienes acceso a esta información.');
    if (code === 'too-many-requests')
        return new AppError('credentials', 'Hubo muchos intentos. Espera antes de intentarlo otra vez.');
    if (code === 'email-already-in-use')
        return new AppError('credentials', 'No pudimos crear la cuenta con este correo. Prueba iniciar sesión o recuperar tu contraseña.');
    if (['weak-password', 'password-does-not-meet-requirements'].includes(code ?? ''))
        return new AppError('validation', 'La contraseña no cumple la política de seguridad. Usa 8 caracteres, mayúscula, minúscula, número y símbolo.');
    if (code === 'invalid-email')
        return new AppError('validation', 'Escribe un correo válido.');
    if (code === 'requires-recent-login')
        return new AppError('credentials', 'Por seguridad, vuelve a iniciar sesión y repite la operación.');
    if (code === 'operation-not-allowed')
        return new AppError('configuration', 'Este método de acceso no está habilitado. Usa tu método habitual.');
    if (code === 'account-exists-with-different-credential' || code === 'credential-already-in-use') {
        return new AppError('credentials', 'Esta cuenta usa otro método de acceso. Entra con el método habitual; tus datos se conservarán.');
    }
    return new AppError('unexpected', 'Ocurrió un problema. Inténtalo nuevamente.');
}
