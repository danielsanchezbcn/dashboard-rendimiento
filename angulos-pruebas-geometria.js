/**
 * tests/geometry.tests.js
 * Pruebas de las funciones geometricas y de la propagacion de mediciones invalidas.
 * Se ejecutan sobre el codigo REAL de ../js (utils.js, registry.js, engine.js y los
 * assessments), no sobre copias. Convencion: una medicion invalida es exactamente null.
 */
(function () {
  const { suite, test, assert } = Runner;
  const P = (x, y) => ({ x, y });
  const EPS = (typeof GEOMETRY_EPSILON === 'number') ? GEOMETRY_EPSILON : 1e-6; // si no existe, falla la prueba de la constante

  // Generador pseudoaleatorio determinista (mulberry32): las pruebas aleatorias son reproducibles.
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // Implementacion ANTERIOR (formulas originales, sin proteccion). Solo sirve de referencia para
  // demostrar que las geometrias validas no han cambiado ni un bit.
  const REF = {
    angleUpPositive(p1, p2) { const dx = p2.x - p1.x, dy = p2.y - p1.y; return Math.atan2(-dy, Math.abs(dx)) * 180 / Math.PI; },
    distToSegment(p, a, b) {
      const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
      if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
      let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
    },
    includedAngleSupplement(vertex, ray1, ray2) {
      const v1 = { x: ray1.x - vertex.x, y: ray1.y - vertex.y };
      const v2 = { x: ray2.x - vertex.x, y: ray2.y - vertex.y };
      const dot = v1.x * v2.x + v1.y * v2.y;
      const m1 = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y);
      const included = Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * 180 / Math.PI;
      return 180 - included;
    }
  };

  // Entradas no validas de un solo punto (coordenadas no finitas, ausentes o de tipo incorrecto).
  const BAD_POINTS = [P(NaN, 1), P(1, NaN), P(Infinity, 0), P(0, -Infinity), undefined, null, { x: '1', y: '2' }, {}, { x: 1 }, 5];

  // Ejecuta fn con un assessment activo y restaura el anterior (los tests no deben dejar estado).
  function withAssessment(key, fn) {
    const prev = AssessmentRegistry.getActiveKey();
    AssessmentRegistry.setActive(key);
    try { return fn(); } finally { AssessmentRegistry.setActive(prev); }
  }
  const photoWith = (points, role) => ({ points: { A: points }, legRole: { A: role, B: role === 'apoyo' ? 'elevada' : 'apoyo' } });
  const byPrefix = list => Object.fromEntries(list.map(a => [a.outPrefix, a.deg]));

  // ------------------------------------------------------------------------------------------
  suite('Ángulo respecto a la horizontal — angleUpPositive', () => {
    test('Segmento horizontal hacia la derecha = 0°', () => assert.approx(angleUpPositive(P(0, 0), P(10, 0)), 0));
    test('Segmento horizontal hacia la izquierda = 0°', () => assert.approx(angleUpPositive(P(0, 0), P(-10, 0)), 0));
    test('Diagonal ascendente hacia la derecha = 45°', () => assert.approx(angleUpPositive(P(0, 0), P(10, -10)), 45));
    test('Diagonal ascendente hacia la izquierda = 45°', () => assert.approx(angleUpPositive(P(0, 0), P(-10, -10)), 45));
    test('Diagonal descendente hacia la derecha = −45°', () => assert.approx(angleUpPositive(P(0, 0), P(10, 10)), -45));
    test('Diagonal descendente hacia la izquierda = −45°', () => assert.approx(angleUpPositive(P(0, 0), P(-10, 10)), -45));
    test('Vertical hacia arriba = 90° y hacia abajo = −90°', () => {
      assert.approx(angleUpPositive(P(0, 0), P(0, -10)), 90);
      assert.approx(angleUpPositive(P(0, 0), P(0, 10)), -90);
    });
    test('Valor conocido: desplazamiento (3, −4) = 53,13010235415598°', () => assert.approx(angleUpPositive(P(0, 0), P(3, -4)), 53.13010235415598, 1e-12));
    test('Dos puntos coincidentes = medición inválida (null)', () => assert.isNull(angleUpPositive(P(5, 5), P(5, 5))));
    test('Dos puntos coincidentes con decimales = medición inválida (null)', () => assert.isNull(angleUpPositive(P(123.456, 789.012), P(123.456, 789.012))));
    test('Segmento prácticamente nulo (menor que la tolerancia) = null', () => {
      assert.isNull(angleUpPositive(P(0, 0), P(EPS / 2, EPS / 2)));
      assert.isNull(angleUpPositive(P(1000, 1000), P(1000 + EPS / 10, 1000)));
    });
    test('Segmento exactamente igual a la tolerancia = null (límite incluido)', () => assert.isNull(angleUpPositive(P(0, 0), P(EPS, 0))));
    test('Segmento justo por encima de la tolerancia = medición válida', () => assert.approx(angleUpPositive(P(0, 0), P(2 * EPS, 0)), 0));
    test('Entradas no finitas, ausentes o de tipo incorrecto = null', () => {
      BAD_POINTS.forEach(bad => { assert.isNull(angleUpPositive(bad, P(1, 1))); assert.isNull(angleUpPositive(P(1, 1), bad)); });
    });
    test('La tolerancia es una constante declarada, positiva y pequeña', () => {
      assert.isTrue(typeof GEOMETRY_EPSILON === 'number' && GEOMETRY_EPSILON > 0 && GEOMETRY_EPSILON < 1e-3, `GEOMETRY_EPSILON = ${GEOMETRY_EPSILON}`);
    });
  });

  // ------------------------------------------------------------------------------------------
  suite('Ángulo incluido (rodilla) — includedAngleSupplement', () => {
    test('Rodilla completamente extendida (puntos colineales) = 0°', () => assert.approx(includedAngleSupplement(P(0, 10), P(0, 0), P(0, 20)), 0));
    // acos esta mal condicionada cerca de 180°: 1 ulp de error en el coseno (p. ej. sqrt(200)² = 200,00000000000003)
    // ya produce ~1e-6° de redondeo. Es irrelevante clinicamente y no depende de este trabajo (formula intacta);
    // por eso las extensiones completas se comparan con 1e-5° y no con 1e-9°.
    test('Rodilla extendida con la pierna en diagonal = 0° (tolerancia 1e-5° por el mal condicionamiento de acos)', () => assert.approx(includedAngleSupplement(P(10, 10), P(0, 0), P(20, 20)), 0, 1e-5));
    test('Rodilla extendida con la pierna en horizontal = 0° (tolerancia 1e-5°)', () => assert.approx(includedAngleSupplement(P(10, 0), P(0, 0), P(20, 0)), 0, 1e-5));
    test('Extensión completa: el resultado nunca es negativo (siempre positivo o cero)', () => {
      for (let k = 0; k < 360; k += 7) { const t = k * Math.PI / 180, d = P(Math.cos(t) * 137.3, Math.sin(t) * 137.3);
        assert.isTrue(includedAngleSupplement(P(0, 0), P(-d.x, -d.y), P(d.x, d.y)) >= 0, `negativo en orientación ${k}°`); }
    });
    test('Ángulo incluido de 90° = 90°', () => assert.approx(includedAngleSupplement(P(0, 10), P(0, 0), P(10, 10)), 90));
    test('Ángulo incluido de 135° = 45° de flexión', () => assert.approx(includedAngleSupplement(P(0, 10), P(0, 0), P(10, 20)), 45));
    test('Flexión máxima (rayos superpuestos) = 180°', () => assert.approx(includedAngleSupplement(P(0, 10), P(0, 0), P(0, 0)), 180));
    test('Rayo de longitud cero (cadera = rodilla) = medición inválida (null)', () => assert.isNull(includedAngleSupplement(P(0, 10), P(0, 10), P(10, 20))));
    test('Rayo de longitud cero (tobillo = rodilla) = medición inválida (null)', () => assert.isNull(includedAngleSupplement(P(0, 10), P(0, 0), P(0, 10))));
    test('Los dos rayos de longitud cero = medición inválida (null)', () => assert.isNull(includedAngleSupplement(P(7, 7), P(7, 7), P(7, 7))));
    test('Rayo prácticamente nulo (menor que la tolerancia) = null', () => assert.isNull(includedAngleSupplement(P(0, 10), P(0, 0), P(EPS / 2, 10))));
    test('Rayo justo por encima de la tolerancia = medición válida', () => assert.approx(includedAngleSupplement(P(0, 10), P(0, 0), P(2 * EPS, 10)), 90, 1e-6));
    test('Entradas no finitas, ausentes o de tipo incorrecto = null', () => {
      BAD_POINTS.forEach(bad => {
        assert.isNull(includedAngleSupplement(bad, P(0, 0), P(1, 1)));
        assert.isNull(includedAngleSupplement(P(5, 5), bad, P(1, 1)));
        assert.isNull(includedAngleSupplement(P(5, 5), P(0, 0), bad));
      });
    });
  });

  // ------------------------------------------------------------------------------------------
  suite('Distancia a un segmento — distToSegment', () => {
    test('Distancia perpendicular a un segmento normal = 5', () => assert.approx(distToSegment(P(5, 5), P(0, 0), P(10, 0)), 5, 1e-12));
    test('Proyección fuera del segmento: distancia al extremo más cercano', () => {
      assert.approx(distToSegment(P(15, 0), P(0, 0), P(10, 0)), 5, 1e-12);
      assert.approx(distToSegment(P(-3, 4), P(0, 0), P(10, 0)), 5, 1e-12);
    });
    test('Punto sobre el segmento = 0', () => assert.approx(distToSegment(P(4, 0), P(0, 0), P(10, 0)), 0, 1e-12));
    test('Segmento diagonal normal', () => assert.approx(distToSegment(P(0, 10), P(0, 0), P(10, 10)), 7.0710678118654755, 1e-12));
    test('Segmento de longitud cero: distancia al punto (3-4-5), finita y sin NaN', () => assert.approx(distToSegment(P(0, 0), P(3, 4), P(3, 4)), 5, 1e-12));
    test('Segmento prácticamente nulo: distancia finita al punto', () => assert.approx(distToSegment(P(0, 0), P(3, 4), P(3 + EPS / 2, 4)), 5, 1e-6));
    test('Entradas no finitas, ausentes o de tipo incorrecto = null', () => {
      BAD_POINTS.forEach(bad => {
        assert.isNull(distToSegment(bad, P(0, 0), P(1, 1)));
        assert.isNull(distToSegment(P(5, 5), bad, P(1, 1)));
        assert.isNull(distToSegment(P(5, 5), P(0, 0), bad));
      });
    });
  });

  // ------------------------------------------------------------------------------------------
  suite('Propagación de mediciones inválidas — activeAngles, formato y resultados', () => {
    test('Jurdan, pierna de apoyo válida: thigh = 45° y RF = 45° (RF con signo invertido, sin cambios)', () => withAssessment('jurdan', () => {
      const r = byPrefix(activeAngles(photoWith({ hip: P(0, 0), knee: P(10, -10), ankle: P(20, 0) }, 'apoyo'), 'A'));
      assert.approx(r.thigh, 45); assert.approx(r.rf, 45);
    }));
    test('Jurdan, apoyo con rodilla = tobillo: thigh válido y RF inválido (null; ni 0 ni −0 por la inversión de signo)', () => withAssessment('jurdan', () => {
      const r = byPrefix(activeAngles(photoWith({ hip: P(0, 0), knee: P(10, -10), ankle: P(10, -10) }, 'apoyo'), 'A'));
      assert.approx(r.thigh, 45); assert.isNull(r.rf, 'RF debe conservarse como null');
    }));
    test('Jurdan, apoyo con cadera = rodilla: thigh inválido y RF válido', () => withAssessment('jurdan', () => {
      const r = byPrefix(activeAngles(photoWith({ hip: P(10, -10), knee: P(10, -10), ankle: P(20, 0) }, 'apoyo'), 'A'));
      assert.isNull(r.thigh); assert.approx(r.rf, 45);
    }));
    test('Jurdan, pierna elevada con rodilla = tobillo: shin = null', () => withAssessment('jurdan', () => {
      const r = byPrefix(activeAngles(photoWith({ hip: P(0, 0), knee: P(5, 5), ankle: P(5, 5) }, 'elevada'), 'A'));
      assert.isNull(r.shin);
    }));
    test('Jurdan, pierna elevada válida: shin = 45°', () => withAssessment('jurdan', () => {
      assert.approx(byPrefix(activeAngles(photoWith({ hip: P(0, 0), knee: P(0, 0), ankle: P(10, -10) }, 'elevada'), 'A')).shin, 45);
    }));
    test('AKET válido: flexión de rodilla = 90°', () => withAssessment('aket', () => {
      assert.approx(byPrefix(activeAngles(photoWith({ hip: P(0, 0), knee: P(0, 10), ankle: P(10, 10) }, 'apoyo'), 'A')).aket, 90);
    }));
    test('AKET con rodilla = tobillo (rayo de longitud cero) = null', () => withAssessment('aket', () => {
      assert.isNull(byPrefix(activeAngles(photoWith({ hip: P(0, 0), knee: P(0, 10), ankle: P(0, 10) }, 'apoyo'), 'A')).aket);
    }));
    test('AKET con cadera = rodilla (rayo de longitud cero) = null', () => withAssessment('aket', () => {
      assert.isNull(byPrefix(activeAngles(photoWith({ hip: P(0, 10), knee: P(0, 10), ankle: P(10, 10) }, 'apoyo'), 'A')).aket);
    }));
    test('activeAngles con puntos ausentes devuelve null (no lanza ni produce NaN)', () => withAssessment('aket', () => {
      assert.isNull(byPrefix(activeAngles(photoWith({ hip: undefined, knee: P(0, 10), ankle: P(10, 10) }, 'apoyo'), 'A')).aket);
    }));
    test('isValidMeasurement: solo los números finitos son válidos', () => {
      [0, -0, 12.5, -16.9, 180, -1e9].forEach(v => assert.isTrue(isValidMeasurement(v) === true, `${v} debe ser válido`));
      [null, undefined, NaN, Infinity, -Infinity, '12', {}, []].forEach(v => assert.isTrue(isValidMeasurement(v) === false, `${String(v)} debe ser inválido`));
    });
    test('formatMeasurement: valores válidos con un decimal y símbolo de grados', () => {
      assert.equal(formatMeasurement(74.54), '74.5°'); assert.equal(formatMeasurement(-16.94), '-16.9°'); assert.equal(formatMeasurement(0), '0.0°');
    });
    test('formatMeasurement: cualquier valor inválido se muestra como «—»', () => {
      [null, undefined, NaN, Infinity, -Infinity].forEach(v => assert.equal(formatMeasurement(v), '—'));
    });
    test('toFixed nunca se ejecuta sobre un valor inválido', () => {
      const original = Number.prototype.toFixed, receivers = [];
      Number.prototype.toFixed = function (d) { receivers.push(Number(this)); return original.call(this, d); };
      try { [NaN, Infinity, -Infinity, null, undefined].forEach(v => formatMeasurement(v)); formatMeasurement(12.34); }
      finally { Number.prototype.toFixed = original; }
      assert.equal(receivers.length, 1, 'toFixed solo debe ejecutarse una vez (sobre el valor válido)');
      assert.approx(receivers[0], 12.34);
    });
  });

  // ------------------------------------------------------------------------------------------
  suite('Robustez — nunca NaN ni Infinity (pruebas reproducibles)', () => {
    // Genera un trio de puntos mezclando casos validos, degenerados, extremos y no finitos.
    function randomTriple(rand) {
      const R = (s) => (rand() * 2 - 1) * s, pt = (s) => P(R(s), R(s)), kind = Math.floor(rand() * 8);
      const a = pt(2000);
      switch (kind) {
        case 0: return [a, pt(2000), pt(2000)];                                                        // generico
        case 1: return [a, P(a.x, a.y), P(a.x, a.y)];                                                  // los tres coincidentes
        case 2: { const e = Math.pow(10, -9 + rand() * 6); return [a, P(a.x + R(e), a.y + R(e)), P(a.x + R(e), a.y + R(e))]; } // casi coincidentes
        case 3: { const b = pt(2000), k = R(3); return [a, b, P(a.x + k * (b.x - a.x), a.y + k * (b.y - a.y))]; }               // colineales
        case 4: return [pt(1e6), pt(1e6), pt(1e6)];                                                    // magnitudes grandes
        case 5: return [P(Math.round(R(3)), Math.round(R(3))), P(Math.round(R(3)), Math.round(R(3))), P(Math.round(R(3)), Math.round(R(3)))]; // rejilla pequena (muchos degenerados)
        case 6: return [a, P(a.x, a.y), pt(2000)];                                                     // un rayo de longitud cero
        default: { const t = [a, pt(2000), pt(2000)]; t[Math.floor(rand() * 3)] = BAD_POINTS[Math.floor(rand() * BAD_POINTS.length)]; return t; } // algun punto invalido
      }
    }

    test('Barrido de casos inválidos conocidos: todos devuelven null (ninguno NaN ni Infinity)', () => {
      const same = P(4, 4), cases = [
        ['angleUpPositive, puntos coincidentes', angleUpPositive(same, P(4, 4))],
        ['angleUpPositive, casi coincidentes', angleUpPositive(P(0, 0), P(1e-12, -1e-12))],
        ['includedAngleSupplement, rayo 1 nulo', includedAngleSupplement(same, P(4, 4), P(9, 9))],
        ['includedAngleSupplement, rayo 2 nulo', includedAngleSupplement(same, P(9, 9), P(4, 4))],
        ['includedAngleSupplement, ambos nulos', includedAngleSupplement(same, P(4, 4), P(4, 4))],
        ['includedAngleSupplement, casi nulos', includedAngleSupplement(same, P(4 + 1e-12, 4), P(4, 4 - 1e-12))],
        ['angleUpPositive, NaN', angleUpPositive(P(NaN, 0), P(1, 1))],
        ['includedAngleSupplement, Infinity', includedAngleSupplement(P(0, 0), P(Infinity, 0), P(1, 1))],
        ['distToSegment, NaN', distToSegment(P(NaN, 0), P(0, 0), P(1, 1))]
      ];
      cases.forEach(([name, value]) => assert.isNull(value, name));
    });

    test('4000 casos aleatorios: las tres funciones devuelven siempre null o un número finito', () => {
      const rand = rng(20261018);
      for (let i = 0; i < 4000; i++) {
        const [a, b, c] = randomTriple(rand);
        assert.finiteOrNull(angleUpPositive(a, b), `angleUpPositive caso ${i}`);
        assert.finiteOrNull(includedAngleSupplement(a, b, c), `includedAngleSupplement caso ${i}`);
        assert.finiteOrNull(distToSegment(a, b, c), `distToSegment caso ${i}`);
      }
    });

    test('4000 casos aleatorios: rangos correctos (horizontal en [−90°, 90°], incluido en [0°, 180°], distancia ≥ 0)', () => {
      const rand = rng(777), tol = 1e-9;
      for (let i = 0; i < 4000; i++) {
        const [a, b, c] = randomTriple(rand);
        const h = angleUpPositive(a, b), inc = includedAngleSupplement(a, b, c), d = distToSegment(a, b, c);
        if (h !== null) assert.isTrue(h >= -90 - tol && h <= 90 + tol, `angleUpPositive fuera de rango: ${h} (caso ${i})`);
        if (inc !== null) assert.isTrue(inc >= -tol && inc <= 180 + tol, `includedAngleSupplement fuera de rango: ${inc} (caso ${i})`);
        if (d !== null) assert.isTrue(d >= 0, `distToSegment negativa: ${d} (caso ${i})`);
      }
    });

    test('Ningún texto de resultado contiene «NaN» ni «Infinity» (activeAngles + formatMeasurement, 2000 casos × 2 tests)', () => {
      const rand = rng(31415);
      ['jurdan', 'aket'].forEach(key => withAssessment(key, () => {
        for (let i = 0; i < 2000; i++) {
          const [hip, knee, ankle] = randomTriple(rand);
          ['apoyo', 'elevada'].forEach(role => activeAngles(photoWith({ hip, knee, ankle }, role), 'A').forEach(a => {
            assert.finiteOrNull(a.deg, `${key}/${role}/${a.outPrefix} caso ${i}`);
            const text = formatMeasurement(a.deg);
            assert.isTrue(!/NaN|Infinity/.test(text), `texto «${text}» (${key}/${role}/${a.outPrefix}, caso ${i})`);
            if (a.deg === null) assert.equal(text, '—');
          }));
        }
      }));
    });
  });

  // ------------------------------------------------------------------------------------------
  suite('Geometrías válidas sin cambios — equivalencia exacta con la implementación anterior', () => {
    function validPoint(rand) { return P((rand() * 2 - 1) * 3000, (rand() * 2 - 1) * 3000); }
    const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) > 1e-3;

    test('angleUpPositive: resultado idéntico bit a bit en 5000 segmentos válidos', () => {
      const rand = rng(1); let n = 0;
      while (n < 5000) { const a = validPoint(rand), b = validPoint(rand); if (!far(a, b)) continue; n++;
        assert.equal(angleUpPositive(a, b), REF.angleUpPositive(a, b), `caso ${n}`); }
    });
    test('includedAngleSupplement: resultado idéntico bit a bit en 5000 ángulos válidos', () => {
      const rand = rng(2); let n = 0;
      while (n < 5000) { const v = validPoint(rand), r1 = validPoint(rand), r2 = validPoint(rand); if (!far(v, r1) || !far(v, r2)) continue; n++;
        assert.equal(includedAngleSupplement(v, r1, r2), REF.includedAngleSupplement(v, r1, r2), `caso ${n}`); }
    });
    test('distToSegment: resultado idéntico bit a bit en 5000 segmentos válidos', () => {
      const rand = rng(3); let n = 0;
      while (n < 5000) { const p = validPoint(rand), a = validPoint(rand), b = validPoint(rand); if (!far(a, b)) continue; n++;
        assert.equal(distToSegment(p, a, b), REF.distToSegment(p, a, b), `caso ${n}`); }
    });
  });
  suite('Etiquetas de ángulo fuera de la pierna', () => {
    test('la caja queda a más de 20 px de todos los segmentos y dentro del canvas (1000 piernas aleatorias)', () => {
      const rand = rng(11); let n = 0;
      while (n < 1000) {
        const a = P(150 + rand() * 500, 100 + rand() * 400), b = P(150 + rand() * 500, 100 + rand() * 400), c = P(150 + rand() * 500, 100 + rand() * 400);
        if (Math.hypot(a.x - b.x, a.y - b.y) < 60 || Math.hypot(b.x - c.x, b.y - c.y) < 60) continue; n++;
        const segs = [{ a, b }, { a: b, b: c }];
        const r = placeLabel(a, b, segs, 800, 600);
        const d = Math.min(distToSegment(r.pos, a, b), distToSegment(r.pos, b, c));
        assert.isTrue(r.pos.x >= 0 && r.pos.x <= 800 && r.pos.y >= 0 && r.pos.y <= 600, `fuera del canvas, caso ${n}`);
        assert.isTrue(d > 20, `caja sobre la pierna (${d.toFixed(1)} px), caso ${n}`);
      }
    });
    test('segmento de longitud cero: no falla y queda dentro del canvas', () => {
      const r = placeLabel(P(5, 5), P(5, 5), [{ a: P(5, 5), b: P(5, 5) }], 800, 600);
      assert.isTrue(Number.isFinite(r.pos.x) && Number.isFinite(r.pos.y) && r.pos.x >= 0 && r.pos.y >= 0);
    });
  });
})();
