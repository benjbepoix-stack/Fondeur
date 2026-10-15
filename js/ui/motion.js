/*
 * Mouvement « physique » : ressort interruptible, projection de l'élan,
 * résistance élastique et suivi de vitesse d'un geste.
 * Paramètres à la manière d'Apple : amortissement (1 = sans rebond) et
 * réponse (en secondes, plus petit = plus vif).
 */

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Anime une valeur vers `to` avec un ressort, en partant de `from` et de la
 * vitesse `velocity` (unités/s). Renvoie une fonction d'arrêt : un nouveau
 * geste peut donc interrompre l'animation à tout moment.
 */
export function spring({ from, to, velocity = 0, damping = 1, response = 0.4, onUpdate, onComplete }) {
  const stiffness = (2 * Math.PI / response) ** 2;
  const friction = (4 * Math.PI * damping) / response;
  let x = from;
  let v = velocity;
  let last = performance.now();
  let raf = 0;
  const step = now => {
    // Pas fixes de 4 ms : intégration stable même si une image est perdue.
    let dt = Math.min((now - last) / 1000, 0.064);
    last = now;
    while (dt > 0) {
      const h = Math.min(dt, 0.004);
      v += (-stiffness * (x - to) - friction * v) * h;
      x += v * h;
      dt -= h;
    }
    if (Math.abs(v) < 2 && Math.abs(x - to) < 0.5) {
      onUpdate(to);
      onComplete?.();
      return;
    }
    onUpdate(x);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/** Distance parcourue par l'élan d'un geste (fonction de décélération d'Apple). */
export const project = (velocity, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate);

/** Résistance progressive au-delà d'une limite. */
export const rubberband = (overshoot, dimension, constant = 0.55) =>
  (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));

/** Historique court de positions pour calculer la vitesse au relâchement (px/s). */
export function tracker() {
  let points = [];
  return {
    add(y) {
      const t = performance.now();
      points.push({ y, t });
      points = points.filter(p => t - p.t < 100);
    },
    velocity() {
      if (points.length < 2) return 0;
      const a = points[0];
      const b = points[points.length - 1];
      return b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0;
    }
  };
}
