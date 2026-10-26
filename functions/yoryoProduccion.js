"use strict";
const config = require('./yoryoProductos.json');

function medidasValidas(p) {
  return p && p.medidasConfirmadas === true && Number(p.anchoMm) > 0 && Number(p.altoMm) > 0 && Number(p.anchoMm) <= 500 && Number(p.altoMm) <= 500;
}

function validarDisenoYoryo(diseno, producto, pieza) {
  if (!medidasValidas(producto.produccionYoryo)) return 'Falta confirmar el área útil de producción de este producto.';
  if (!diseno || diseno.productId !== pieza.id || !diseno.userId || !diseno.datosYoryo || diseno.estado === 'borrador') return 'Vuelve a guardar la personalización de este producto.';
  const produccion = diseno.produccionYoryo;
  const archivo = diseno.archivosProduccion && diseno.archivosProduccion[0];
  const previa = diseno.vistasPrevias && diseno.vistasPrevias[0];
  if (!produccion || !produccion.lista || produccion.tecnica !== pieza.tecnica || !archivo || !archivo.lista || archivo.tecnica !== pieza.tecnica || archivo.formato !== (pieza.tecnica === 'laser' ? 'svg' : 'png') || !archivo.url || !previa || !previa.url || !produccion.revision || archivo.revision !== produccion.revision || previa.revision !== produccion.revision) return 'La personalización no tiene todos sus archivos de producción.';
  if (Number(archivo.anchoMm) !== Number(producto.produccionYoryo.anchoMm) || Number(archivo.altoMm) !== Number(producto.produccionYoryo.altoMm)) return 'El área de producción cambió. Vuelve a guardar el diseño.';
  return '';
}

function esSvgLaser(texto, ancho, alto) {
  return typeof texto === 'string' && texto.length < 2000000 && /<svg\b/.test(texto) && /<path\b/.test(texto)
    && !/<(?:\w+:)?(?:image|text|script|foreignObject|use)\b|<!DOCTYPE|<!ENTITY|\bon\w+\s*=|\bhref\s*=|url\s*\(/i.test(texto)
    && texto.includes(`width="${Number(ancho)}mm"`) && texto.includes(`height="${Number(alto)}mm"`);
}

async function leerVectorProduccion(url, userId) {
  const { rutaDeUrlStorage } = require('./comunidadLogic');
  const admin = require('firebase-admin');
  const ruta = rutaDeUrlStorage(url);
  const bucket = admin.storage().bucket();
  if (!ruta || ruta.bucket !== bucket.name || !ruta.path.startsWith(`designs/${userId}/crear/vectores/`) || !ruta.path.endsWith('.svg')) throw new Error('El archivo vectorial no corresponde al diseño.');
  const file = bucket.file(ruta.path);
  const [metadata] = await file.getMetadata();
  if (metadata.contentType !== 'image/svg+xml' || Number(metadata.size) > 2000000) throw new Error('El archivo de grabado no es un SVG válido.');
  const [buffer] = await file.download();
  return buffer.toString('utf8');
}

module.exports = { config, medidasValidas, validarDisenoYoryo, esSvgLaser, leerVectorProduccion };
