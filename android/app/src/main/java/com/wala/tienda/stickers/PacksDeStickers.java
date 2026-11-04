package com.wala.tienda.stickers;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Los packs de stickers de WhatsApp que trae la app.
 *
 * Se leen de la web empaquetada (assets/public/stickers/packs.json, que sale
 * de public/stickers/ en wala-master): los mismos archivos que muestra la
 * página "Mis cupones". Para agregar un pack: sus archivos y su ficha en
 * public/stickers/, el id en PACKS_STICKERS_WHATSAPP del servidor y una
 * versión nueva de la app.
 */
public final class PacksDeStickers {

    /** Carpeta dentro de assets donde Capacitor deja la web (webDir). */
    public static final String CARPETA = "public/stickers";

    public static final class Sticker {
        public final String archivo;
        public final List<String> emojis;
        public final String textoAccesible;

        Sticker(String archivo, List<String> emojis, String textoAccesible) {
            this.archivo = archivo;
            this.emojis = emojis;
            this.textoAccesible = textoAccesible;
        }
    }

    public static final class Pack {
        public final String id;
        public final String nombre;
        public final String editor;
        public final String bandeja;
        public final String versionDeImagenes;
        public final boolean sinCache;
        public final boolean animado;
        public final String web;
        public final String privacidad;
        public final String licencia;
        public final List<Sticker> stickers;

        Pack(JSONObject o, List<Sticker> stickers) {
            this.id = o.optString("identifier");
            this.nombre = o.optString("name");
            this.editor = o.optString("publisher");
            this.bandeja = o.optString("tray_image_file");
            this.versionDeImagenes = o.optString("image_data_version", "1");
            this.sinCache = o.optBoolean("avoid_cache", false);
            this.animado = o.optBoolean("animated_sticker_pack", false);
            this.web = o.optString("publisher_website");
            this.privacidad = o.optString("privacy_policy_website");
            this.licencia = o.optString("license_agreement_website");
            this.stickers = stickers;
        }
    }

    private static List<Pack> cache;

    private PacksDeStickers() {}

    public static synchronized List<Pack> todos(Context contexto) {
        if (cache != null) return cache;
        List<Pack> packs = new ArrayList<>();
        try (InputStream entrada = contexto.getAssets().open(CARPETA + "/packs.json")) {
            ByteArrayOutputStream salida = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int n;
            while ((n = entrada.read(buffer)) != -1) salida.write(buffer, 0, n);
            JSONArray lista = new JSONObject(new String(salida.toByteArray(), StandardCharsets.UTF_8)).getJSONArray("packs");
            for (int i = 0; i < lista.length(); i++) {
                JSONObject o = lista.getJSONObject(i);
                JSONArray st = o.getJSONArray("stickers");
                List<Sticker> stickers = new ArrayList<>();
                for (int j = 0; j < st.length(); j++) {
                    JSONObject s = st.getJSONObject(j);
                    JSONArray e = s.optJSONArray("emojis");
                    List<String> emojis = new ArrayList<>();
                    if (e != null) for (int k = 0; k < e.length(); k++) emojis.add(e.getString(k));
                    stickers.add(new Sticker(s.getString("image_file"), emojis, s.optString("accessibility_text")));
                }
                packs.add(new Pack(o, stickers));
            }
        } catch (IOException | JSONException e) {
            // Sin la ficha no hay packs: WhatsApp no verá ninguno y el botón dirá que no se pudo.
            packs = Collections.emptyList();
        }
        cache = packs;
        return cache;
    }

    public static Pack porId(Context contexto, String id) {
        for (Pack p : todos(contexto)) if (p.id.equals(id)) return p;
        return null;
    }
}
