# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ─── Walá: reglas para R8 (minifyEnabled en release) ─────────────────────────
# R8 achica, optimiza y ofusca lo que no se nombra aquí (AndroidX, Firebase,
# Google Play Services traen sus propias reglas). Lo que la app encuentra por
# reflexión o desde JavaScript se queda tal cual:

# El puente web ↔ Android: MessageHandler y los plugins exponen métodos con
# @JavascriptInterface que solo llama la WebView. Sin esto, la app sale en blanco.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# Capacitor y sus plugins: se cargan por nombre (capacitor.plugins.json) y leen
# sus anotaciones (@CapacitorPlugin, @PluginMethod...) en tiempo de ejecución.
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-keep class com.codetrixstudio.capacitor.GoogleAuth.** { *; }

# Los errores de Play Console con su línea (el archivo de mapeo va en el .aab).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
