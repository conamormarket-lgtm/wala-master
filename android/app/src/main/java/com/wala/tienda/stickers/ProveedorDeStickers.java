package com.wala.tienda.stickers;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.UriMatcher;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.Collections;
import java.util.List;

/**
 * Lo que WhatsApp lee para agregar un pack (el contrato de su ejemplo oficial,
 * github.com/WhatsApp/stickers): la lista de packs, los stickers de uno y cada
 * archivo. Solo lo puede leer WhatsApp (permiso com.whatsapp.sticker.READ en
 * el manifiesto). Los archivos se sirven sin copiar desde assets, por eso el
 * build no comprime webp ni png (build.gradle, androidResources.noCompress).
 */
public class ProveedorDeStickers extends ContentProvider {

    private static final String METADATA = "metadata";
    private static final String STICKERS = "stickers";
    private static final String STICKERS_ASSET = "stickers_asset";

    private static final int LISTA = 1;
    private static final int UN_PACK = 2;
    private static final int SUS_STICKERS = 3;
    private static final int ARCHIVO = 4;

    private final UriMatcher rutas = new UriMatcher(UriMatcher.NO_MATCH);
    private String autoridad;

    public static String autoridadDe(android.content.Context contexto) {
        return contexto.getPackageName() + ".stickercontentprovider";
    }

    @Override
    public boolean onCreate() {
        autoridad = autoridadDe(getContext());
        rutas.addURI(autoridad, METADATA, LISTA);
        rutas.addURI(autoridad, METADATA + "/*", UN_PACK);
        rutas.addURI(autoridad, STICKERS + "/*", SUS_STICKERS);
        rutas.addURI(autoridad, STICKERS_ASSET + "/*/*", ARCHIVO);
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        switch (rutas.match(uri)) {
            case LISTA:
                return fichas(uri, PacksDeStickers.todos(getContext()));
            case UN_PACK: {
                PacksDeStickers.Pack p = PacksDeStickers.porId(getContext(), uri.getLastPathSegment());
                return fichas(uri, p == null ? Collections.<PacksDeStickers.Pack>emptyList() : Collections.singletonList(p));
            }
            case SUS_STICKERS: {
                PacksDeStickers.Pack p = PacksDeStickers.porId(getContext(), uri.getLastPathSegment());
                MatrixCursor c = new MatrixCursor(new String[] { "sticker_file_name", "sticker_emoji", "sticker_accessibility_text" });
                if (p != null) {
                    for (PacksDeStickers.Sticker s : p.stickers) {
                        c.addRow(new Object[] { s.archivo, android.text.TextUtils.join(",", s.emojis), s.textoAccesible });
                    }
                }
                c.setNotificationUri(getContext().getContentResolver(), uri);
                return c;
            }
            default:
                throw new IllegalArgumentException("Ruta desconocida: " + uri);
        }
    }

    private Cursor fichas(Uri uri, List<PacksDeStickers.Pack> packs) {
        MatrixCursor c = new MatrixCursor(new String[] {
            "sticker_pack_identifier", "sticker_pack_name", "sticker_pack_publisher", "sticker_pack_icon",
            "android_play_store_link", "ios_app_download_link", "sticker_pack_publisher_email",
            "sticker_pack_publisher_website", "sticker_pack_privacy_policy_website",
            "sticker_pack_license_agreement_website", "image_data_version", "whatsapp_will_not_cache_stickers",
            "animated_sticker_pack",
        });
        String tienda = "https://play.google.com/store/apps/details?id=" + getContext().getPackageName();
        for (PacksDeStickers.Pack p : packs) {
            c.addRow(new Object[] {
                p.id, p.nombre, p.editor, p.bandeja, tienda, "", "", p.web, p.privacidad, p.licencia,
                p.versionDeImagenes, p.sinCache ? 1 : 0, p.animado ? 1 : 0,
            });
        }
        c.setNotificationUri(getContext().getContentResolver(), uri);
        return c;
    }

    @Override
    public AssetFileDescriptor openAssetFile(Uri uri, String mode) throws FileNotFoundException {
        if (rutas.match(uri) != ARCHIVO) throw new FileNotFoundException("No es un archivo: " + uri);
        List<String> partes = uri.getPathSegments();
        if (partes.size() != 3) throw new FileNotFoundException("Ruta incompleta: " + uri);
        String pack = partes.get(1);
        String archivo = partes.get(2);
        PacksDeStickers.Pack p = PacksDeStickers.porId(getContext(), pack);
        if (p == null || !esDelPack(p, archivo)) throw new FileNotFoundException("No está en el pack: " + uri);
        try {
            return getContext().getAssets().openFd(PacksDeStickers.CARPETA + "/" + pack + "/" + archivo);
        } catch (IOException e) {
            throw new FileNotFoundException("No se pudo abrir " + archivo + ": " + e.getMessage());
        }
    }

    private static boolean esDelPack(PacksDeStickers.Pack p, String archivo) {
        if (archivo.equals(p.bandeja)) return true;
        for (PacksDeStickers.Sticker s : p.stickers) if (s.archivo.equals(archivo)) return true;
        return false;
    }

    @Override
    public String getType(Uri uri) {
        switch (rutas.match(uri)) {
            case LISTA:
                return "vnd.android.cursor.dir/vnd." + autoridad + "." + METADATA;
            case UN_PACK:
                return "vnd.android.cursor.item/vnd." + autoridad + "." + METADATA;
            case SUS_STICKERS:
                return "vnd.android.cursor.dir/vnd." + autoridad + "." + STICKERS;
            case ARCHIVO:
                return uri.getLastPathSegment().endsWith(".png") ? "image/png" : "image/webp";
            default:
                throw new IllegalArgumentException("Ruta desconocida: " + uri);
        }
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Solo lectura");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Solo lectura");
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Solo lectura");
    }
}
