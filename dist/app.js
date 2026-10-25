(() => {
  const $ = id => document.getElementById(id);
  const userAudio = $('site-audio');
  let playing = false, duration = 0, toastTimer, pending = false;
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
    $('sound-label').textContent = playing ? 'SOUND ON' : 'SOUND OFF';
    $('sound-toggle').setAttribute('aria-pressed', String(playing));
    $('listen-label').textContent = playing ? 'PAUSE' : 'LISTEN';
    for (const id of ['player-play', 'record-play']) $(id).setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
  }

  async function play() {
    if (playing || pending) return;
    pending = true;
    try {
      userAudio.volume = state.volume;
      await userAudio.play();
      playing = true;
      renderState();
    } catch {
      toast('Could not play the soundtrack. Please try again.');
    } finally {
      pending = false;
    }
  }

  function pause() {
    if (!playing) return;
    userAudio.pause();
    playing = false;
    renderState();
  }

  function toggle() {
    if (pending) return;
    playing ? pause() : play();
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
  ['play', 'pause', 'ended'].forEach(event => userAudio.addEventListener(event, renderState));
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

  function open(id) {
    $(id).showModal();
  }

  $('menu-open').addEventListener('click', () => open('menu-dialog'));
  $('about-open').addEventListener('click', () => open('about-dialog'));
  $('settings-open').addEventListener('click', () => open('settings-dialog'));
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    }
  }));
  $('menu-listen').addEventListener('click', () => {
    $('menu-dialog').close();
    toggle();
  });
  $('menu-about').addEventListener('click', () => {
    $('menu-dialog').close();
    open('about-dialog');
  });
  $('menu-settings').addEventListener('click', () => {
    $('menu-dialog').close();
    open('settings-dialog');
  });
  $('about-listen').addEventListener('click', () => {
    $('about-dialog').close();
    play();
  });
  $('year-input').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    if (e.target.value.length === 4) {
      $('year-display').textContent = e.target.value;
      document.querySelectorAll('[data-year]').forEach(el => el.textContent = e.target.value);
      document.querySelector('.visual').setAttribute('aria-label', `Spinning chrome XO symbol and year ${ e.target.value }`);
    }
  });
  $('year-input').addEventListener('blur', e => {
    if (e.target.value.length !== 4) e.target.value = $('year-display').textContent;
  });
  $('reset-demo').addEventListener('click', () => {
    $('year-input').value = '2026';
    $('year-display').textContent = '2026';
    document.querySelectorAll('[data-year]').forEach(el => el.textContent = '2026');
    document.querySelector('.visual').setAttribute('aria-label', 'Spinning chrome XO symbol and year 2026');
    toast('Cover year reset.');
  });
})();
