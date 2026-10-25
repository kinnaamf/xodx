(() => {
  const $ = id => document.getElementById(id);
  const userAudio = $('site-audio');
  let playing = false, duration = 0, toastTimer, pending = false;
  let waitingForInteraction = false;
  let manuallyPaused = false, playRequest = 0;
  const activationEvents = ['click', 'pointerup', 'touchend', 'keydown'];
  const state = { volume: .5 };
  const format = s => `${ String(Math.floor(s / 60)).padStart(2, '0') }:${ String(Math.floor(s % 60)).padStart(2, '0') }`;

  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500);
  }

  function current() {
    return userAudio.currentTime || 0;
  }

  function renderState() {
    playing = !userAudio.paused && !userAudio.ended;
    document.body.classList.toggle('is-playing', playing);
    $('sound-label').textContent = playing ? 'SOUND ON' : waitingForInteraction ? 'TAP FOR SOUND' : 'SOUND OFF';
    $('sound-toggle').setAttribute('aria-pressed', String(playing));
    $('listen-label').textContent = playing ? 'PAUSE' : 'LISTEN';
    for (const id of ['player-play', 'record-play']) $(id).setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
  }

  function clearAutoplayFallback() {
    waitingForInteraction = false;
    activationEvents.forEach(event => document.removeEventListener(event, startOnInteraction, true));
  }

  function startOnInteraction(event) {
    if (!event.isTrusted || document.hidden || manuallyPaused) return;
    // Playback buttons handle their own click, so the same tap cannot start and pause music.
    if (event.target.closest?.('#listen, #player-play, #record-play, #sound-toggle, #about-listen')) return;
    if (event.type === 'keydown' && (event.ctrlKey || event.metaKey || event.altKey || event.key === 'Escape')) return;
    play({ automatic: true });
  }

  function armAutoplayFallback() {
    if (waitingForInteraction) return;
    waitingForInteraction = true;
    activationEvents.forEach(event => document.addEventListener(event, startOnInteraction, { capture: true, passive: true }));
  }

  async function play({ automatic = false } = {}) {
    if (automatic && manuallyPaused) return;
    if (!automatic) manuallyPaused = false;
    if (!userAudio.paused) return;
    const request = ++playRequest;
    pending = true;
    userAudio.dataset.playback = 'loading';
    try {
      userAudio.volume = state.volume;
      await userAudio.play();
      if (request !== playRequest) return;
      clearAutoplayFallback();
      userAudio.dataset.playback = 'playing';
      playing = true;
      renderState();
    } catch (error) {
      if (request !== playRequest) return;
      if (error.name === 'NotAllowedError') {
        userAudio.dataset.playback = 'blocked';
        armAutoplayFallback();
        renderState();
      } else if (!automatic && error.name !== 'AbortError') {
        toast('Could not play the soundtrack. Please try again.');
      }
    } finally {
      if (request === playRequest) pending = false;
    }
  }

  function pause() {
    manuallyPaused = true;
    ++playRequest;
    pending = false;
    clearAutoplayFallback();
    userAudio.autoplay = false;
    userAudio.pause();
    userAudio.dataset.playback = 'paused';
    playing = false;
    renderState();
  }

  function toggle() {
    userAudio.paused ? play() : pause();
  }

  function retryAutoplay() {
    if (!document.hidden && !manuallyPaused && !waitingForInteraction && !pending && userAudio.paused) play({ automatic: true });
  }

  ['listen', 'player-play', 'record-play', 'sound-toggle'].forEach(id => $(id).addEventListener('click', toggle));
  $('volume').addEventListener('input', e => {
    state.volume = Number(e.target.value);
    e.target.style.setProperty('--progress', `${ state.volume * 100 }%`);
    userAudio.volume = state.volume;
  });
  $('seek').addEventListener('input', e => {
    if (!duration) return;
    userAudio.currentTime = Math.min(Number(e.target.value), Math.max(0, duration - .01));
    $('current-time').textContent = format(userAudio.currentTime);
  });

  function updatePlayer() {
    const t = current();
    if (document.activeElement !== $('seek')) {
      $('seek').value = t;
      $('seek').style.setProperty('--progress', `${ duration ? t / duration * 100 : 0 }%`);
    }
    $('current-time').textContent = format(t);
    requestAnimationFrame(updatePlayer);
  }

  requestAnimationFrame(updatePlayer);
  userAudio.loop = true;
  userAudio.volume = state.volume;
  userAudio.preload = 'auto';
  userAudio.autoplay = true;
  ['play', 'pause', 'ended'].forEach(event => userAudio.addEventListener(event, renderState));
  userAudio.addEventListener('playing', () => {
    clearAutoplayFallback();
    userAudio.dataset.playback = 'playing';
    renderState();
  });
  userAudio.addEventListener('canplay', retryAutoplay);
  window.addEventListener('pageshow', retryAutoplay);
  document.addEventListener('visibilitychange', retryAutoplay);
  userAudio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(userAudio.duration) && userAudio.duration > 0) {
      duration = userAudio.duration;
      $('seek').max = duration;
      $('seek').disabled = false;
      $('duration').textContent = format(duration);
    }
  });
  userAudio.addEventListener('error', () => {
    pause();
    toast('The soundtrack could not be loaded. Please reload the page.');
  });
  renderState();
  retryAutoplay();

  function open(id) {
    $(id)?.showModal();
  }

  $('about-open')?.addEventListener('click', () => open('about-dialog'));
  $('settings-open')?.addEventListener('click', () => open('settings-dialog'));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    }
  }));
  $('about-listen')?.addEventListener('click', () => {
    $('about-dialog')?.close();
    play();
  });
  $('year-input')?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    if (e.target.value.length === 4) {
      $('year-display').textContent = e.target.value;
      document.querySelectorAll('[data-year]').forEach(el => el.textContent = e.target.value);
      document.querySelector('.visual').setAttribute('aria-label', `Spinning chrome XO symbol and year ${ e.target.value }`);
    }
  });
  $('year-input')?.addEventListener('blur', e => {
    if (e.target.value.length !== 4) e.target.value = $('year-display').textContent;
  });
  $('reset-demo')?.addEventListener('click', () => {
    $('year-input').value = '2026';
    $('year-display').textContent = '2026';
    document.querySelectorAll('[data-year]').forEach(el => el.textContent = '2026');
    document.querySelector('.visual').setAttribute('aria-label', 'Spinning chrome XO symbol and year 2026');
    toast('Cover year reset.');
  });
})();
