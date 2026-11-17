// CROWNBOUND — input. Keyboard + mouse, plus a software pointer (mouse
// position projected onto the ground plane) shared with the renderer.
// All transient flags are consumed by main.js once per frame.
export function createInput(canvas) {
  const input = {
    moveX: 0,
    moveY: 0,
    jump: false,
    act: false,
    haul: false,
    wheel: 0,
    pointer: { x: 0, y: 0, groundX: 0, groundZ: 0, inside: false },
    mouse: { x: 0, y: 0 },
    _keys: new Set(),
  };

  function recompute() {
    const k = input._keys;
    let mx = 0, my = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    input.moveX = mx;
    input.moveY = my;
    input.haul = k.has('KeyF') || k.has('ShiftLeft') || k.has('ShiftRight');
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input._keys.add(e.code);
    if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'KeyQ') input.wheel += (e.code === 'KeyE' ? 1 : -1);
    recompute();
  });
  window.addEventListener('keyup', (e) => {
    input._keys.delete(e.code);
    recompute();
  });
  window.addEventListener('blur', () => { input._keys.clear(); recompute(); });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.act = true;
    if (e.button === 2) input.haul = true;
  });
  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 2) input.haul = input._keys.has('KeyF');
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mouseleave', () => { input.pointer.inside = false; });

  input.consume = function consume() {
    const out = {
      moveX: input.moveX, moveY: input.moveY,
      jump: input.jump, act: input.act, haul: input.haul,
      wheel: input.wheel,
      pointer: input.pointer,
    };
    input.jump = false;
    input.act = false;
    input.wheel = 0;
    return out;
  };
  return input;
}
