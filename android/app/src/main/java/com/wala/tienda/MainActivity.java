package com.wala.tienda;

import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.animation.PathInterpolator;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.splashscreen.SplashScreenViewProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    // Tope: si la web no llega a pintar, el splash no se queda para siempre.
    private static final long ESPERA_MAXIMA_MS = 4000;
    // En la carga de la web (index.html) el conjunto etiqueta + WALÁ + barra
    // mide 215 dp de alto y la etiqueta (88 x 118 dp) queda 48,5 dp por encima
    // del centro; en el splash del sistema va al centro, en un lienzo de 288 dp.
    private static final float ETIQUETA_SOBRE_EL_CENTRO_DP = 48.5f;
    private static final float LIENZO_ICONO_DP = 288f;

    private volatile boolean webPintada = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        long inicio = SystemClock.uptimeMillis();
        splash.setKeepOnScreenCondition(() -> !webPintada && SystemClock.uptimeMillis() - inicio < ESPERA_MAXIMA_MS);
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                // Cargada no es pintada: se espera a que ese estado ya se dibuje.
                webView.postVisualStateCallback(1, new WebView.VisualStateCallback() {
                    @Override
                    public void onComplete(long requestId) {
                        webPintada = true;
                    }
                });
            }
        });
        splash.setOnExitAnimationListener(this::salirDelSplash);
    }

    // La etiqueta sube (y toma su tamaño) hasta donde está la de la web, que ya
    // está pintada debajo con el degradado y WALÁ; recién ahí el splash se funde.
    private void salirDelSplash(SplashScreenViewProvider proveedor) {
        View vista = proveedor.getView();
        View icono;
        try {
            icono = proveedor.getIconView();
        } catch (RuntimeException sinIcono) {
            icono = null;
        }
        WebView web = bridge != null ? bridge.getWebView() : null;
        PathInterpolator curva = new PathInterpolator(0.22f, 1f, 0.36f, 1f);
        if (icono != null && web != null && icono.getWidth() > 0) {
            float densidad = getResources().getDisplayMetrics().density;
            int[] posWeb = new int[2];
            int[] posIcono = new int[2];
            web.getLocationOnScreen(posWeb);
            icono.getLocationOnScreen(posIcono);
            float destino = posWeb[1] + web.getHeight() / 2f - ETIQUETA_SOBRE_EL_CENTRO_DP * densidad;
            float desde = posIcono[1] + icono.getHeight() / 2f;
            float escala = LIENZO_ICONO_DP * densidad / icono.getWidth();
            icono.animate().translationY(destino - desde).scaleX(escala).scaleY(escala)
                .setDuration(320).setInterpolator(curva).start();
        }
        vista.animate().alpha(0f).setStartDelay(180).setDuration(220).setInterpolator(curva)
            .withEndAction(proveedor::remove).start();
    }
}
