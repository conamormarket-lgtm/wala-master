/**
 * Tests UNITARIOS de la lógica pura en functions/ruletaLogic.js.
 * Usa SOLO 'assert' de Node (sin jest/mocha, sin firebase-admin).
 * Ejecutar:  node functions/test/ruletaLogic.test.js
 *
 * Lo que se protege aquí es el contrato cliente/servidor: el servidor sortea y
 * el cliente pinta la rueda con la MISMA lista. Si el filtro o el orden cambian
 * en un lado, la rueda para en un gajo que no es el premio ganado.
 */
const assert = require("assert");
const r = require("../ruletaLogic");

let count = 0;
function check(name, fn) {
  fn();
  count += 1;
}

// Contexto de un martes cualquiera, sin premios ganados.
const CTX = { hoy: "2026-09-08", diaSemana: 2, ganados: {} };

function run() {
  // ────────────────────────────────────────────────────────────────────────
  // Normalización (esquema nuevo y premios viejos)
  // ────────────────────────────────────────────────────────────────────────
  check("normaliza un premio del esquema viejo", () => {
    const p = r.normalizarPremio({
      id: "a", name: "10 Kapicoins", type: "Monedas", probability: 25, amount: 10,
    });
    assert.strictEqual(p.tipo, "monedas");
    assert.strictEqual(p.nombre, "10 Kapicoins");
    assert.strictEqual(p.etiqueta, "10 Kapicoins"); // sin etiqueta propia, cae al nombre
    assert.strictEqual(p.probabilidad, 25);
    assert.strictEqual(p.monedas, 10);
    // Los premios viejos no traen estos campos: deben quedar "sin restricción".
    assert.strictEqual(p.activo, true);
    assert.deepStrictEqual(p.dias, []);
    assert.strictEqual(p.stockTotal, null);
    assert.strictEqual(p.maxPorUsuario, null);
  });

  check("traduce todos los tipos viejos", () => {
    const t = (type) => r.normalizarPremio({ id: "x", type }).tipo;
    assert.strictEqual(t("Monedas"), "monedas");
    assert.strictEqual(t("Descuento"), "descuento");
    assert.strictEqual(t("Producto"), "producto_gratis");
    assert.strictEqual(t("Beneficio"), "envio_gratis");
    // No hay inventario de accesorios: se entrega a mano, no se finge acreditar.
    assert.strictEqual(t("Accesorio"), "manual");
    // Un tipo desconocido no debe reventar ni acreditar nada.
    assert.strictEqual(t("Marciano"), "nada");
  });

  check("acota los valores fuera de rango", () => {
    const p = r.normalizarPremio({
      id: "a", tipo: "descuento", descuentoPct: 500, probabilidad: -3, stockTotal: 0,
    });
    assert.strictEqual(p.descuentoPct, 100);
    assert.strictEqual(p.probabilidad, 0);
    assert.strictEqual(p.stockTotal, null); // 0 = ilimitado, no "agotado"
  });

  check("descarta días de la semana inválidos", () => {
    const p = r.normalizarPremio({ id: "a", dias: [1, 9, "3", -2, null] });
    assert.deepStrictEqual(p.dias, [1, 3]);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Disponibilidad
  // ────────────────────────────────────────────────────────────────────────
  const base = { id: "p", tipo: "monedas", probabilidad: 10 };
  const disponible = (extra) =>
    r.premioDisponible(r.normalizarPremio(Object.assign({}, base, extra)), CTX);

  check("un premio sin restricciones está disponible", () => {
    assert.strictEqual(disponible({}), true);
  });

  check("respeta el interruptor de activo", () => {
    assert.strictEqual(disponible({ activo: false }), false);
  });

  check("un premio con probabilidad 0 no puede salir", () => {
    // Si no, el sorteo podría devolverlo por el fallback del último elemento.
    assert.strictEqual(disponible({ probabilidad: 0 }), false);
  });

  check("filtra por día de la semana", () => {
    assert.strictEqual(disponible({ dias: [2] }), true, "martes incluido");
    assert.strictEqual(disponible({ dias: [5, 6] }), false, "solo finde");
    assert.strictEqual(disponible({ dias: [] }), true, "vacío = todos los días");
  });

  check("filtra por ventana de campaña", () => {
    assert.strictEqual(disponible({ desde: "2026-09-01", hasta: "2026-12-31" }), true);
    assert.strictEqual(disponible({ desde: "2026-10-01" }), false, "aún no empieza");
    assert.strictEqual(disponible({ hasta: "2026-09-07" }), false, "ya terminó");
    // Los bordes son inclusivos: el último día la campaña sigue viva.
    assert.strictEqual(disponible({ desde: "2026-09-08", hasta: "2026-09-08" }), true);
  });

  check("filtra por stock agotado", () => {
    assert.strictEqual(disponible({ stockTotal: 10, stockUsado: 3 }), true);
    assert.strictEqual(disponible({ stockTotal: 10, stockUsado: 10 }), false);
    assert.strictEqual(disponible({ stockTotal: 10, stockUsado: 99 }), false);
    assert.strictEqual(disponible({ stockUsado: 999 }), true, "sin stockTotal = ilimitado");
  });

  check("filtra por tope de premios por usuario", () => {
    const ctx = { hoy: CTX.hoy, diaSemana: CTX.diaSemana, ganados: { p: 1 } };
    const conTope = (max) =>
      r.premioDisponible(r.normalizarPremio(Object.assign({}, base, { maxPorUsuario: max })), ctx);
    assert.strictEqual(conTope(2), true, "le queda uno");
    assert.strictEqual(conTope(1), false, "ya lo ganó una vez");
    assert.strictEqual(
      r.premioDisponible(r.normalizarPremio(base), ctx), true, "sin tope, ilimitado");
  });

  // ────────────────────────────────────────────────────────────────────────
  // premiosDeHoy: el contrato que comparten cliente y servidor
  // ────────────────────────────────────────────────────────────────────────
  check("premiosDeHoy filtra y ordena de forma estable", () => {
    const crudos = [
      { id: "zz", nombre: "Z", tipo: "nada", probabilidad: 10 },
      { id: "aa", nombre: "A", tipo: "monedas", probabilidad: 10 },
      { id: "ff", nombre: "Finde", tipo: "monedas", probabilidad: 10, dias: [6] },
      { id: "off", nombre: "Off", tipo: "monedas", probabilidad: 10, activo: false },
    ];
    const hoy = r.premiosDeHoy(crudos, CTX);
    assert.deepStrictEqual(hoy.map((p) => p.id), ["aa", "zz"]);
    // El orden NO puede depender del orden de llegada de Firestore: si el cliente
    // y el servidor ordenan distinto, el gajo ganador no coincide.
    const alReves = r.premiosDeHoy(crudos.slice().reverse(), CTX);
    assert.deepStrictEqual(alReves.map((p) => p.id), ["aa", "zz"]);
  });

  check("premiosDeHoy aguanta entradas basura", () => {
    assert.deepStrictEqual(r.premiosDeHoy(null, CTX), []);
    assert.deepStrictEqual(r.premiosDeHoy([null, undefined], CTX), []);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Sorteo
  // ────────────────────────────────────────────────────────────────────────
  check("sortearPremio reparte según el peso", () => {
    const premios = [{ id: "a", probabilidad: 70 }, { id: "b", probabilidad: 30 }];
    assert.strictEqual(r.sortearPremio(premios, 0).id, "a");
    assert.strictEqual(r.sortearPremio(premios, 0.69).id, "a");
    assert.strictEqual(r.sortearPremio(premios, 0.70).id, "b");
    assert.strictEqual(r.sortearPremio(premios, 0.999).id, "b");
  });

  check("sortearPremio renormaliza cuando la rueda de hoy no suma 100", () => {
    // Este es el bug que evita: con el catálogo filtrado (aquí sobra un 40%),
    // sin renormalizar ese 40% caía SIEMPRE en el último premio por el fallback.
    const premios = [{ id: "a", probabilidad: 30 }, { id: "b", probabilidad: 30 }];
    assert.strictEqual(r.sortearPremio(premios, 0.49).id, "a");
    assert.strictEqual(r.sortearPremio(premios, 0.51).id, "b");
  });

  check("sortearPremio no se sale del rango", () => {
    const premios = [{ id: "a", probabilidad: 1 }, { id: "b", probabilidad: 1 }];
    assert.strictEqual(r.sortearPremio(premios, 1).id, "b", "r=1 no debe caer fuera");
    assert.strictEqual(r.sortearPremio(premios, -5).id, "a");
    assert.strictEqual(r.sortearPremio([], 0.5), null);
    assert.strictEqual(r.sortearPremio(null, 0.5), null);
  });

  check("sortearPremio con todo a cero devuelve algo, no null", () => {
    const premios = [{ id: "a", probabilidad: 0 }, { id: "b", probabilidad: 0 }];
    assert.strictEqual(r.sortearPremio(premios, 0.5).id, "a");
  });

  // ────────────────────────────────────────────────────────────────────────
  // Ángulo de parada
  // ────────────────────────────────────────────────────────────────────────
  check("anguloDeParada deja el gajo bajo el puntero", () => {
    // La comprobación de verdad: girar ese ángulo y ver dónde cae el centro del
    // gajo. Debe quedar en 0° (arriba, donde apunta el puntero), no a medio gajo.
    const total = 8;
    const anguloGajo = 360 / total;
    for (let i = 0; i < total; i++) {
      const rot = r.anguloDeParada(i, total, 6);
      const centroGajo = i * anguloGajo + anguloGajo / 2;
      const donde = (((centroGajo + rot) % 360) + 360) % 360;
      assert.strictEqual(Math.round(donde), 0, "el gajo " + i + " no quedó arriba");
    }
  });

  check("anguloDeParada incluye las vueltas de adorno", () => {
    // Sin vueltas completas la rueda salta al premio en vez de girar.
    assert.ok(r.anguloDeParada(0, 8, 6) >= 360 * 6);
    assert.ok(r.anguloDeParada(0, 8, 2) >= 360 * 2);
  });

  check("anguloDeParada aguanta entradas imposibles", () => {
    assert.strictEqual(r.anguloDeParada(0, 0, 5), 0);
    assert.strictEqual(r.anguloDeParada(-1, 8, 5), 0);
    assert.strictEqual(r.anguloDeParada(1.5, 8, 5), 0);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Configuración
  // ────────────────────────────────────────────────────────────────────────
  check("normalizarConfig funciona sin doc guardado", () => {
    // ruletaConfig/settings puede no existir: la ruleta debe funcionar igual.
    const c = r.normalizarConfig(null);
    assert.strictEqual(c.activa, true);
    assert.strictEqual(c.tema.preset, "aurora");
    assert.strictEqual(c.reglas.modoDesbloqueo, "racha7");
    assert.ok(c.tema.colores.length > 0);
  });

  check("normalizarConfig descarta colores inválidos", () => {
    const c = r.normalizarConfig({ tema: { colores: ["#ff0000", "rojo", "", null] } });
    assert.deepStrictEqual(c.tema.colores, ["#ff0000"]);
  });

  check("normalizarConfig cae a la paleta de casa si no queda ningún color", () => {
    const c = r.normalizarConfig({ tema: { preset: "oro", colores: ["nada"] } });
    assert.deepStrictEqual(c.tema.colores, r.PRESETS_TEMA.oro.colores);
  });

  check("normalizarConfig acota vueltas y duración", () => {
    const c = r.normalizarConfig({ reglas: { vueltas: 999, duracionGiroMs: 999999 } });
    assert.strictEqual(c.reglas.vueltas, 12);
    assert.strictEqual(c.reglas.duracionGiroMs, 10000);
  });

  check("normalizarConfig rechaza un modo de desbloqueo desconocido", () => {
    const c = r.normalizarConfig({ reglas: { modoDesbloqueo: "gratis_total" } });
    assert.strictEqual(c.reglas.modoDesbloqueo, "racha7");
  });

  // ────────────────────────────────────────────────────────────────────────
  // Colores de los gajos
  // ────────────────────────────────────────────────────────────────────────
  check("colorDeGajo usa el color propio del premio si lo tiene", () => {
    assert.strictEqual(r.colorDeGajo({ color: "#123456" }, 0, 4, ["#a", "#b"]), "#123456");
  });

  check("colorDeGajo evita que el primer y el último gajo coincidan", () => {
    // Con 5 gajos y 4 colores, el gajo 4 tocaría el color 0 y quedaría pegado al
    // primero: dos gajos idénticos juntos (el defecto de la rueda vieja).
    const paleta = ["#a", "#b", "#c", "#d"];
    const ultimo = r.colorDeGajo(null, 4, 5, paleta);
    assert.notStrictEqual(ultimo, r.colorDeGajo(null, 0, 5, paleta));
    assert.notStrictEqual(ultimo, r.colorDeGajo(null, 3, 5, paleta));
  });

  check("colorDeGajo aguanta una paleta vacía", () => {
    assert.ok(r.colorDeGajo(null, 0, 3, []));
    assert.ok(r.colorDeGajo(null, 0, 3, null));
  });

  // ────────────────────────────────────────────────────────────────────────
  // Textos y cupones
  // ────────────────────────────────────────────────────────────────────────
  check("esCupon distingue lo que se entrega como cupón", () => {
    assert.strictEqual(r.esCupon("descuento"), true);
    assert.strictEqual(r.esCupon("producto_gratis"), true);
    assert.strictEqual(r.esCupon("envio_gratis"), true);
    assert.strictEqual(r.esCupon("monedas"), false, "las monedas se acreditan solas");
    assert.strictEqual(r.esCupon("manual"), false, "se entrega a mano");
    assert.strictEqual(r.esCupon("nada"), false);
  });

  check("textoPremio describe cada tipo", () => {
    const t = (raw) => r.textoPremio(r.normalizarPremio(raw));
    assert.strictEqual(t({ id: "a", tipo: "monedas", monedas: 10 }), "10 monedas");
    assert.strictEqual(t({ id: "a", tipo: "descuento", descuentoPct: 15 }), "15% de descuento");
    assert.strictEqual(t({ id: "a", tipo: "descuento", descuentoMonto: 20 }), "S/ 20.00 de descuento");
    assert.strictEqual(t({ id: "a", tipo: "envio_gratis" }), "Envío gratis");
    assert.strictEqual(
      t({ id: "a", tipo: "producto_gratis", productName: "Caja Kapi" }), "Caja Kapi gratis");
    assert.strictEqual(t({ id: "a", tipo: "nada", nombre: "Casi" }), "Casi");
    assert.strictEqual(r.textoPremio(null), "");
  });

  check("sumaProbabilidades cuenta esquema viejo y nuevo", () => {
    assert.strictEqual(
      r.sumaProbabilidades([{ probability: 40 }, { probabilidad: 60 }]), 100);
    assert.strictEqual(r.sumaProbabilidades([]), 0);
    assert.strictEqual(r.sumaProbabilidades(null), 0);
  });

  console.log(`ruletaLogic.test.js: ${count} casos OK`);
}

run();
