import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  FESTIVAS_DEFAULT, fechaDelAnio, proximaFecha, textoRegla, aplicaA, proximasFestivas,
  avisosFestivosDeHoy, festivasDesdeDoc, normalizarFestiva, armarAvisoFestivo,
} from './fechasFestivas.mjs';

const require = createRequire(import.meta.url);
const servidor = require('../../functions/fechasFestivasLogic.js');
const regla = (id) => FESTIVAS_DEFAULT.find((f) => f.id === id).regla;

test('fechas móviles de Perú caen el día correcto cada año', () => {
  assert.equal(fechaDelAnio(regla('dia_madre'), 2026), '2026-05-10', '2.º domingo de mayo');
  assert.equal(fechaDelAnio(regla('dia_madre'), 2027), '2027-05-09');
  assert.equal(fechaDelAnio(regla('dia_padre'), 2026), '2026-06-21', '3.er domingo de junio');
  assert.equal(fechaDelAnio(regla('dia_padre'), 2027), '2027-06-20');
  assert.equal(fechaDelAnio(regla('dia_nino'), 2026), '2026-04-12', '2.º domingo de abril');
  assert.equal(fechaDelAnio(regla('dia_amistad'), 2026), '2026-07-04', '1.er sábado de julio');
  assert.equal(fechaDelAnio(regla('navidad'), 2026), '2026-12-25');
});

test('último día de la semana del mes y 29 de febrero', () => {
  assert.equal(fechaDelAnio({ tipo: 'movil', mes: 8, diaSemana: 0, ordinal: -1 }, 2026), '2026-08-30', 'último domingo de agosto');
  assert.equal(fechaDelAnio({ tipo: 'fija', mes: 2, dia: 29 }, 2027), '2027-02-28');
});

test('próxima fecha: si ya pasó este año, la del siguiente', () => {
  assert.deepEqual(proximaFecha(regla('dia_madre'), '2026-10-06'), { fecha: '2027-05-09', dias: 215 });
  assert.deepEqual(proximaFecha(regla('navidad'), '2026-12-25'), { fecha: '2026-12-25', dias: 0 });
  assert.deepEqual(proximaFecha(regla('navidad'), '2026-12-04'), { fecha: '2026-12-25', dias: 21 });
});

test('texto de la regla', () => {
  assert.equal(textoRegla(regla('dia_madre')), '2.º domingo de mayo');
  assert.equal(textoRegla(regla('navidad')), '25 de diciembre');
  assert.equal(textoRegla({ tipo: 'movil', mes: 8, diaSemana: 0, ordinal: -1 }), 'Último domingo de agosto');
});

test('a quién le toca cada fecha', () => {
  const madre = FESTIVAS_DEFAULT.find((f) => f.id === 'dia_madre');
  assert.equal(aplicaA(madre, { roleKey: 'padres', gender: 'Femenino' }), true);
  assert.equal(aplicaA(madre, { roleKey: 'padres', gender: 'Masculino' }), false);
  assert.equal(aplicaA(madre, { roleKey: 'pareja', gender: 'Femenino' }), false);
  const navidad = FESTIVAS_DEFAULT.find((f) => f.id === 'navidad');
  assert.equal(aplicaA(navidad, { roleKey: 'amigos', gender: 'Otro' }), true);
});

test('avisos de hoy: personal con nombres, general si no tiene a nadie, sin repetir', () => {
  const marta = { name: 'Marta', roleKey: 'padres', gender: 'Femenino' };
  const hoy = '2027-04-25'; // 14 días antes del Día de la Madre 2027
  const [aviso] = avisosFestivosDeHoy(FESTIVAS_DEFAULT, [marta], hoy, {});
  assert.equal(aviso.key, 'fest|dia_madre|2027|14');
  assert.equal(aviso.personal, true);
  assert.equal(aviso.titulo, '💐 Día de la Madre en 14 días');
  assert.match(aviso.cuerpo, /Marta/);
  const general = avisosFestivosDeHoy(FESTIVAS_DEFAULT, [], hoy, {});
  assert.equal(general.length, 1);
  assert.equal(general[0].personal, false);
  assert.equal(avisosFestivosDeHoy(FESTIVAS_DEFAULT, [marta], hoy, { [aviso.key]: true }).length, 0, 'no repite');
  assert.equal(avisosFestivosDeHoy(FESTIVAS_DEFAULT, [marta], '2027-04-26', {}).length, 0, 'solo los días de aviso');
  const amistadSinAmigos = avisosFestivosDeHoy(FESTIVAS_DEFAULT, [], '2026-06-27', {});
  assert.equal(amistadSinAmigos.length, 0, 'Día de la Amistad no avisa a todos');
});

test('próximas festivas: ordenadas, solo activas, con sus personas', () => {
  const lista = proximasFestivas(
    [...FESTIVAS_DEFAULT, { id: 'apagada', nombre: 'Apagada', activo: false, regla: { tipo: 'fija', mes: 10, dia: 7 } }],
    [{ name: 'Ana', roleKey: 'amigos' }],
    '2026-10-06',
  );
  assert.equal(lista[0].id, 'navidad');
  assert.ok(!lista.some((f) => f.id === 'apagada'));
  assert.deepEqual(lista.find((f) => f.id === 'dia_amistad').personas.map((p) => p.name), ['Ana']);
});

test('configuración: sin documento usa las de Perú; normaliza basura', () => {
  assert.equal(festivasDesdeDoc(null).length, FESTIVAS_DEFAULT.length);
  assert.deepEqual(festivasDesdeDoc({ fechas: [] }), []);
  const f = normalizarFestiva({ id: 'x', nombre: 'X', regla: { tipo: 'movil', mes: 99, ordinal: 0 }, avisarDias: ['7', 0, 400, 7], para: { roles: ['marcianos', 'pareja'], genero: 'Robot' } });
  assert.deepEqual(f.regla, { tipo: 'movil', mes: 1, diaSemana: 0, ordinal: 1 });
  assert.deepEqual(f.avisarDias, [7]);
  assert.deepEqual(f.para, { roles: ['pareja'], genero: '' });
});

test('aviso de prueba: se arma para cualquier fecha, aunque falten meses', () => {
  const navidad = FESTIVAS_DEFAULT.find((f) => f.id === 'navidad');
  const general = armarAvisoFestivo(navidad, [], '2026-12-25', 21);
  assert.equal(general.titulo, '🎄 Navidad en 21 días');
  assert.equal(general.personal, false);
  assert.match(general.cuerpo, /25 de diciembre/);
  const madre = FESTIVAS_DEFAULT.find((f) => f.id === 'dia_madre');
  const personal = armarAvisoFestivo(madre, [{ name: 'Marta', roleKey: 'padres', gender: 'Femenino' }], '2027-05-09', 215);
  assert.equal(personal.personal, true);
  assert.match(personal.cuerpo, /Marta/);
});

test('la copia del servidor da lo mismo', () => {
  const recipients = [{ name: 'Marta', roleKey: 'padres', gender: 'Femenino' }];
  for (const hoy of ['2027-04-25', '2026-12-04', '2026-10-06']) {
    assert.deepEqual(
      JSON.parse(JSON.stringify(servidor.avisosFestivosDeHoy(FESTIVAS_DEFAULT, recipients, hoy, {}))),
      JSON.parse(JSON.stringify(avisosFestivosDeHoy(FESTIVAS_DEFAULT, recipients, hoy, {}))),
    );
  }
});
