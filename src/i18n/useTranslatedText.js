// ──────────────────────────────────────────────────────────────────────────────
// useTranslatedText.js — Hook + componente para traducir contenido DINÁMICO
//
// Conecta el motor de traducción (services/translate.js) con React y el idioma
// actual (LanguageContext). Permite traducir strings que NO están en los
// diccionarios estáticos: nombres de producto, descripciones, etc.
//
// Clave del diseño: la traducción entra por ESTADO de React. Mientras se resuelve
// la petición se muestra el texto ORIGINAL, por lo que el DOM nunca se rompe ni
// queda vacío (a diferencia del widget de Google Translate, que sí lo rompería).
//
// Endurecimiento (aditivo, retrocompatible):
//   - No se llama a la red si target === 'es' o el texto está vacío.
//   - Se evita re-traducir/parpadear: el estado sólo cambia cuando el valor
//     resultante realmente cambia (no se hace setState con el mismo string).
//   - El efecto depende sólo de (text, lang); no provoca renders en bucle.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translateText, translateMany } from '../services/translate';

// ¿Hace falta traducir? Sólo si hay texto y el idioma destino no es el origen.
function needsTranslation(text, lang) {
  return !!text && lang !== 'es';
}

// Hook: devuelve `text` traducido al idioma actual (string).
//   - Si lang === 'es' o no hay texto: devuelve el original sin tocar la red.
//   - Si no: arranca mostrando el original y, al resolverse, actualiza al traducido.
//   - Usa un guard de desmontaje para no hacer setState sobre un componente muerto.
export function useTranslatedText(text) {
  const { lang } = useLanguage();

  // Estado inicial = texto original: el render nunca queda vacío (se sembra una vez).
  const [out, setOut] = useState(text);

  useEffect(() => {
    // Sin traducción necesaria: reflejamos el original y salimos (cero red).
    // Sólo hacemos setState si el valor mostrado difiere, para no forzar un render
    // extra innecesario.
    if (!needsTranslation(text, lang)) {
      setOut((prev) => (prev === text ? prev : text));
      return undefined;
    }

    // Guard: si el componente se desmonta (o cambian text/lang) antes de resolver,
    // evitamos actualizar estado obsoleto.
    let activo = true;

    // Mientras resuelve mostramos el original para no parpadear a vacío. Si ya es
    // el original, evitamos un setState redundante.
    setOut((prev) => (prev === text ? prev : text));

    // translateText nunca lanza: ante fallo total devuelve el texto original.
    translateText(text, lang).then((traducido) => {
      if (!activo) return;
      // Sólo actualizamos si el resultado cambia algo: evita renders inútiles y
      // posibles bucles si el valor traducido coincide con el original.
      setOut((prev) => (prev === traducido ? prev : traducido));
    });

    return () => {
      activo = false;
    };
  }, [text, lang]);

  return out;
}

// Componente: toma un string como children y renderiza su traducción.
// Uso: <T>{product.name}</T>
// Si children NO es un string (p.ej. un nodo JSX), lo devuelve tal cual.
export function T({ children }) {
  // Sólo traducimos strings; cualquier otro tipo se pasa sin cambios.
  // Los hooks deben llamarse incondicionalmente, así que siempre invocamos el hook;
  // cuando children no es string, le pasamos undefined (el hook lo trata como vacío).
  const esString = typeof children === 'string';
  const traducido = useTranslatedText(esString ? children : undefined);
  return esString ? traducido : children;
}


// ──────────────────────────────────────────────────────────────────────────────
// useTranslatedHtml — traduce contenido con ETIQUETAS (descripcion de producto)
//
// La descripcion se guarda como HTML y se pinta con dangerouslySetInnerHTML, asi
// que <T> no sirve: solo acepta texto plano. Y mandar el HTML entero al traductor
// tampoco, porque devuelve las etiquetas rotas o traducidas.
//
// Lo que se hace: se parsea el HTML, se traducen SOLO los nodos de texto y se
// vuelve a serializar. Las etiquetas, atributos, enlaces e imagenes quedan
// intactos porque nunca se tocan.
//
// Igual de tolerante que el resto: mientras resuelve se muestra el HTML original,
// y si algo falla se devuelve tal cual.
// ──────────────────────────────────────────────────────────────────────────────
export function useTranslatedHtml(html) {
  const { lang } = useLanguage();
  const [out, setOut] = useState(html);

  useEffect(() => {
    if (!html || lang === 'es' || typeof DOMParser === 'undefined') {
      setOut((prev) => (prev === html ? prev : html));
      return undefined;
    }

    let activo = true;
    setOut((prev) => (prev === html ? prev : html));

    (async () => {
      try {
        const doc = new DOMParser().parseFromString(`<div id="raiz">${html}</div>`, 'text/html');
        const raiz = doc.getElementById('raiz');
        if (!raiz) return;

        // Se recogen los nodos de TEXTO con contenido real. Se saltan los que
        // solo tienen espacios y los que estan dentro de <script>/<style>.
        const nodos = [];
        const paseo = doc.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
        while (paseo.nextNode()) {
          const n = paseo.currentNode;
          const padre = n.parentNode && n.parentNode.nodeName;
          if (padre === 'SCRIPT' || padre === 'STYLE') continue;
          if (n.nodeValue && n.nodeValue.trim().length > 1) nodos.push(n);
        }
        if (nodos.length === 0) return;

        const traducidos = await translateMany(nodos.map((n) => n.nodeValue.trim()), lang);
        if (!activo) return;

        nodos.forEach((n, i) => {
          const nuevo = traducidos[i];
          if (typeof nuevo === 'string' && nuevo) {
            // Se conservan los espacios de alrededor para no pegar palabras.
            const original = n.nodeValue;
            const izq = original.match(/^\s*/)[0];
            const der = original.match(/\s*$/)[0];
            n.nodeValue = izq + nuevo + der;
          }
        });

        const resultado = raiz.innerHTML;
        setOut((prev) => (prev === resultado ? prev : resultado));
      } catch {
        // Ante cualquier problema se deja el HTML original: nunca se rompe.
      }
    })();

    return () => { activo = false; };
  }, [html, lang]);

  return out;
}

export default useTranslatedText;
