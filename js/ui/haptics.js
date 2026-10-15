/*
 * Retour haptique léger pour les moments marquants (favori, sélection).
 * Android : API Vibration. iPhone (Safari 18+) : un interrupteur natif
 * <input type="checkbox" switch> déclenche un « tic » quand on l'actionne ;
 * il doit l'être pendant un geste de l'utilisateur.
 */
let label = null;

function iosSwitch() {
  if (label) return label;
  label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  return label;
}

export function haptic() {
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(10);
    return;
  }
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) iosSwitch().click();
}
