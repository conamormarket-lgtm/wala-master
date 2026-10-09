/**
 * Tests UNITARIOS de functions/comunidadLogic.js (solo 'assert' de Node).
 * Ejecutar:  node functions/test/comunidadLogic.test.js
 */
const assert = require("assert");
const c = require("../comunidadLogic");

let count = 0;
function check(name, fn) {
  try {
    fn();
    count += 1;
  } catch (e) {
    console.error("FALLA:", name);
    throw e;
  }
}

const B = "sistema-gestion-3b225.firebasestorage.app";
const url = (path, token = "t1") => c.urlDescarga(B, path, token);

const diseno = (extra = {}) => ({
  id: "d1",
  userId: "admin1",
  tipo: "crear",
  estado: "guardada",
  name: "  Gato astronauta  ",
  productId: "polo",
  productName: "Polo",
  color: { id: "negro", nombre: "Negro", hex: "#000" },
  layersByView: {
    frente: [
      { id: "a", type: "image", src: url("designs/admin1/crear/originales/1_gato.webp") },
      { id: "b", type: "text", text: "Hola" },
    ],
    espalda: [],
  },
  vistasPrevias: [{ vista: "v1", nombre: "Frente", url: url("designs/admin1/crear/previas/2_v1.jpg"), zonas: ["frente"] }],
  imagenConjunta: url("designs/admin1/crear/previas/3_conjunto.jpg"),
  previewUrl: url("designs/admin1/crear/previas/3_conjunto.jpg"),
  archivosImpresion: [{ url: url("designs/admin1/crear/impresion/4_frente.png") }],
  ...extra,
});

check("lee bucket y ruta de una URL de descarga", () => {
  assert.deepStrictEqual(c.rutaDeUrlStorage(url("designs/u/crear/originales/1 a.webp")), {
    bucket: B,
    path: "designs/u/crear/originales/1 a.webp",
  });
  assert.deepStrictEqual(c.rutaDeUrlStorage(`https://storage.googleapis.com/${B}/designs/u/x.png`), {
    bucket: B,
    path: "designs/u/x.png",
  });
  assert.strictEqual(c.rutaDeUrlStorage("https://ejemplo.com/a.png"), null);
  assert.strictEqual(c.rutaDeUrlStorage("data:image/png;base64,xx"), null);
  assert.strictEqual(c.rutaDeUrlStorage(null), null);
});

check("el destino es estable y queda bajo comunidad/{id}", () => {
  assert.strictEqual(
    c.destinoComunidad("d1", "designs/admin1/crear/originales/1_gato.webp"),
    "comunidad/d1/originales/1_gato.webp"
  );
  assert.strictEqual(c.destinoComunidad("d1", "designs/admin1/subida.png"), "comunidad/d1/subida.png");
  assert.strictEqual(c.destinoComunidad("d1", "designs/admin1"), null);
  assert.strictEqual(c.destinoComunidad("d1", "designs/admin1/../x"), null);
});

check("copia capas y vistas previas del autor, no la impresión", () => {
  const urls = c.urlsACopiar(diseno(), "admin1");
  assert.strictEqual(urls.length, 3);
  assert.ok(!urls.some((u) => u.includes("impresion")));
});

check("no copia archivos de otra persona ni externos", () => {
  const d = diseno({
    layersByView: {
      frente: [
        { type: "image", src: url("designs/otro/crear/originales/x.webp") },
        { type: "image", src: "https://ejemplo.com/x.png" },
      ],
    },
    vistasPrevias: [],
    imagenConjunta: "",
    previewUrl: "",
  });
  assert.deepStrictEqual(c.urlsACopiar(d, "admin1"), []);
});

check("la publicación usa las copias y no lleva lo privado", () => {
  const d = diseno();
  const mapa = {
    [d.layersByView.frente[0].src]: "COPIA_CAPA",
    [d.vistasPrevias[0].url]: "COPIA_PREVIA",
    [d.imagenConjunta]: "COPIA_CONJUNTA",
  };
  const pub = c.datosPublicacion(d, mapa, { autorUid: "admin1" });
  assert.strictEqual(pub.layersByView.frente[0].src, "COPIA_CAPA");
  assert.strictEqual(pub.layersByView.frente[1].text, "Hola");
  assert.strictEqual(pub.layersByView.espalda, undefined);
  assert.strictEqual(pub.vistasPrevias[0].url, "COPIA_PREVIA");
  assert.strictEqual(pub.imagenConjunta, "COPIA_CONJUNTA");
  assert.strictEqual(pub.previewUrl, "COPIA_CONJUNTA");
  assert.strictEqual(pub.nombre, "Gato astronauta");
  assert.strictEqual(pub.autorNombre, "Walá");
  assert.strictEqual(pub.archivosImpresion, undefined);

  const publica = c.serializarPublica("d1", { ...pub, publicadoEn: { _seconds: 10 } });
  assert.strictEqual(publica.autorUid, undefined);
  assert.strictEqual(publica.origenDesignId, undefined);
  assert.strictEqual(publica.layersByView, undefined);
  assert.strictEqual(publica.publicadoEn, 10000);
  assert.ok(c.serializarPublica("d1", pub, { conCapas: true }).layersByView.frente);
});

check("solo se publican creaciones propias, guardadas y con algo", () => {
  assert.strictEqual(c.motivoNoPublicable(diseno(), "admin1"), null);
  assert.ok(c.motivoNoPublicable(null, "admin1"));
  assert.ok(c.motivoNoPublicable(diseno(), "otro"));
  assert.ok(c.motivoNoPublicable(diseno({ estado: "borrador" }), "admin1"));
  assert.ok(c.motivoNoPublicable(diseno({ tipo: undefined }), "admin1"));
  assert.ok(c.motivoNoPublicable(diseno({ layersByView: { frente: [] } }), "admin1"));
});

check("permiso por adminRoles: superadmin o manage_design", () => {
  assert.strictEqual(c.rolPermiteComunidad({ permissions: ["manage_design"] }), true);
  assert.strictEqual(c.rolPermiteComunidad({ permissions: ["superadmin"] }), true);
  assert.strictEqual(c.rolPermiteComunidad({ permissions: ["manage_products"] }), false);
  assert.strictEqual(c.rolPermiteComunidad(null), false);
});

check("galería: destacados primero, luego lo más reciente", () => {
  const orden = c.ordenarGaleria([
    { id: "viejo", publicadoEn: 1 },
    { id: "nuevo", publicadoEn: 3 },
    { id: "dest", publicadoEn: 0, destacado: true },
  ]).map((x) => x.id);
  assert.deepStrictEqual(orden, ["dest", "nuevo", "viejo"]);
});

check("prenda disponible", () => {
  assert.strictEqual(c.prendaDisponible({ esPrendaBase: true }), true);
  assert.strictEqual(c.prendaDisponible({ esPrendaBase: true, visible: false }), false);
  assert.strictEqual(c.prendaDisponible({ esPrendaBase: true, deleted: true }), false);
  assert.strictEqual(c.prendaDisponible(null), false);
});

console.log(`comunidadLogic: ${count} tests OK`);
