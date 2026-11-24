package com.wala.tienda.stickers;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * "Añadir a WhatsApp" desde la web de la app (Mis cupones): window.Capacitor
 * .Plugins.StickersWhatsapp. Quién puede usarlo lo decide la web (solo quien
 * canjeó el pack); aquí solo se habla con WhatsApp.
 *  - estado({ packId }) → { whatsapp, agregado }: si hay WhatsApp y si el pack
 *    ya está en él.
 *  - agregar({ packId }) → { agregado, cancelado? }: abre la ventana de
 *    WhatsApp para agregarlo. Si WhatsApp lo rechaza, la llamada falla con su
 *    motivo (validation_error).
 */
@CapacitorPlugin(name = "StickersWhatsapp")
public class StickersWhatsappPlugin extends Plugin {

    private static final String WHATSAPP = "com.whatsapp";
    private static final String WHATSAPP_BUSINESS = "com.whatsapp.w4b";

    private boolean instalado(String paquete) {
        try {
            getContext().getPackageManager().getPackageInfo(paquete, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    /** WhatsApp responde si el pack ya está agregado (su proveedor sticker_whitelist_check). */
    private boolean agregadoEn(String paquete, String packId) {
        String proveedor = paquete + ".provider.sticker_whitelist_check";
        if (getContext().getPackageManager().resolveContentProvider(proveedor, 0) == null) return false;
        Uri uri = new Uri.Builder().scheme("content").authority(proveedor).appendPath("is_whitelisted")
            .appendQueryParameter("authority", ProveedorDeStickers.autoridadDe(getContext()))
            .appendQueryParameter("identifier", packId)
            .build();
        try (Cursor c = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getInt(c.getColumnIndexOrThrow("result")) == 1;
        } catch (RuntimeException e) {
            return false;
        }
        return false;
    }

    @PluginMethod
    public void estado(PluginCall call) {
        String packId = call.getString("packId", "");
        boolean normal = instalado(WHATSAPP);
        boolean business = instalado(WHATSAPP_BUSINESS);
        JSObject r = new JSObject();
        r.put("whatsapp", normal || business);
        r.put("agregado", (normal && agregadoEn(WHATSAPP, packId)) || (business && agregadoEn(WHATSAPP_BUSINESS, packId)));
        r.put("existe", PacksDeStickers.porId(getContext(), packId) != null);
        call.resolve(r);
    }

    @PluginMethod
    public void agregar(PluginCall call) {
        String packId = call.getString("packId", "");
        PacksDeStickers.Pack pack = PacksDeStickers.porId(getContext(), packId);
        if (pack == null) {
            call.reject("Esta versión de la app no trae ese pack. Actualiza Walá desde Google Play.", "SIN_PACK");
            return;
        }
        boolean normal = instalado(WHATSAPP);
        boolean business = instalado(WHATSAPP_BUSINESS);
        if (!normal && !business) {
            call.reject("Instala WhatsApp para añadir los stickers.", "SIN_WHATSAPP");
            return;
        }
        Intent intent = new Intent("com.whatsapp.intent.action.ENABLE_STICKER_PACK");
        intent.putExtra("sticker_pack_id", pack.id);
        intent.putExtra("sticker_pack_authority", ProveedorDeStickers.autoridadDe(getContext()));
        intent.putExtra("sticker_pack_name", pack.nombre);
        // Con los dos WhatsApp instalados, Android pregunta en cuál.
        if (normal != business) intent.setPackage(normal ? WHATSAPP : WHATSAPP_BUSINESS);
        try {
            startActivityForResult(call, intent, "alAgregar");
        } catch (ActivityNotFoundException e) {
            call.reject("Tu WhatsApp no permite agregar stickers. Actualízalo desde Google Play.", "WHATSAPP_VIEJO");
        }
    }

    @ActivityCallback
    private void alAgregar(PluginCall call, ActivityResult resultado) {
        if (call == null) return;
        JSObject r = new JSObject();
        if (resultado.getResultCode() == Activity.RESULT_OK) {
            r.put("agregado", true);
            call.resolve(r);
            return;
        }
        Intent datos = resultado.getData();
        String error = datos != null ? datos.getStringExtra("validation_error") : null;
        if (error != null && !error.isEmpty()) {
            call.reject("WhatsApp no aceptó el pack: " + error, "RECHAZADO");
            return;
        }
        // Lo cerró sin agregarlo (o ya lo tenía: WhatsApp devuelve lo mismo).
        String packId = call.getString("packId", "");
        boolean ya = (instalado(WHATSAPP) && agregadoEn(WHATSAPP, packId)) || (instalado(WHATSAPP_BUSINESS) && agregadoEn(WHATSAPP_BUSINESS, packId));
        r.put("agregado", ya);
        r.put("cancelado", !ya);
        call.resolve(r);
    }
}
