(() => {
  const audio = document.getElementById('site-audio');
  const sound = document.getElementById('sound-toggle');
  const label = document.getElementById('sound-label');
  const dialog = document.getElementById('enter-dialog');
  const enter = document.getElementById('enter');
  const close = document.getElementById('close-dialog');
  const dialogSound = document.getElementById('dialog-sound');
  const toast = document.getElementById('toast');
  const menu=document.getElementById('menu-dialog');
  const menuToggle=document.getElementById('menu-toggle');
  const menuSound=document.getElementById('menu-sound');
  const activationEvents = ['click', 'pointerup', 'touchend', 'keydown'];
  let manuallyPaused = false, waiting = false, pending = false, request = 0, toastTimer;
  audio.volume = .5;

  function notify(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3500);
  }
  function render() {
    const playing = !audio.paused && !audio.ended;
    document.body.classList.toggle('is-playing', playing);
    label.textContent = playing ? 'SOUND: ON' : 'SOUND: OFF';
    document.getElementById('menu-sound-label').textContent=label.textContent;
    sound.setAttribute('aria-pressed', String(playing));
    sound.setAttribute('aria-label', playing ? 'Pause music' : 'Enable music');
    sound.title = waiting ? 'Tap to enable sound' : playing ? 'Pause music' : 'Enable music';
    dialogSound.innerHTML = playing ? 'PAUSE SOUND <span aria-hidden="true">Ⅱ</span>' : 'TURN IT UP <span aria-hidden="true">→</span>';
  }
  function disarm() {
    waiting = false;
    activationEvents.forEach(type => document.removeEventListener(type, firstInteraction, true));
  }
  function arm() {
    if (waiting) return;
    waiting = true;
    activationEvents.forEach(type => document.addEventListener(type, firstInteraction, { capture: true, passive: true }));
  }
  function firstInteraction(event) {
    if (!event.isTrusted || document.hidden || manuallyPaused) return;
    if (event.target.closest?.('#sound-toggle,#dialog-sound,#menu-sound')) return;
    if (event.type === 'keydown' && (event.ctrlKey || event.metaKey || event.altKey || event.key === 'Escape')) return;
    play(true);
  }
  async function play(automatic = false) {
    if (automatic && manuallyPaused) return;
    if (!automatic) manuallyPaused = false;
    if (!audio.paused) return;
    const id = ++request;
    pending = true;
    audio.dataset.playback = 'loading';
    try {
      await audio.play();
      if (id !== request) return;
      disarm();
      audio.dataset.playback = 'playing';
    } catch (error) {
      if (id !== request) return;
      if (error.name === 'NotAllowedError') {
        audio.dataset.playback = 'blocked';
        arm();
      } else if (!automatic && error.name !== 'AbortError') notify('The soundtrack could not start. Please try again.');
    } finally {
      if (id === request) pending = false;
      render();
    }
  }
  function pause() {
    manuallyPaused = true;
    ++request;
    pending = false;
    disarm();
    audio.autoplay = false;
    audio.pause();
    audio.dataset.playback = 'paused';
    render();
  }
  function toggle() { audio.paused ? play() : pause(); }
  function retry() {
    if (!document.hidden && !manuallyPaused && !waiting && !pending && audio.paused) play(true);
  }
  sound.addEventListener('click', toggle);
  dialogSound.addEventListener('click', toggle);
  menuSound.addEventListener('click',toggle);
  menuToggle.addEventListener('click',()=>{menu.showModal();menuToggle.setAttribute('aria-expanded','true');});
  document.getElementById('menu-close').addEventListener('click',()=>menu.close());
  menu.addEventListener('close',()=>menuToggle.setAttribute('aria-expanded','false'));
  document.getElementById('menu-home').addEventListener('click',()=>menu.close());
  document.getElementById('menu-enter').addEventListener('click',()=>{menu.close();dialog.showModal();});
  ['play','pause','ended'].forEach(type => audio.addEventListener(type, render));
  audio.addEventListener('playing', () => { disarm(); audio.dataset.playback = 'playing'; render(); });
  audio.addEventListener('canplay', retry);
  audio.addEventListener('error', () => { pause(); notify('The soundtrack could not be loaded. Please reload the page.'); });
  document.addEventListener('visibilitychange', retry);
  window.addEventListener('pageshow', retry);
  enter.addEventListener('click', () => dialog.showModal());
  close.addEventListener('click', () => dialog.close());
  [dialog,menu].forEach(panel=>panel.addEventListener('click', event => {
    if (event.target !== panel) return;
    const rect = panel.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) panel.close();
  }));
  render();
  retry();
})();
