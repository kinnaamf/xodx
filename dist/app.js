(() => {
  const $=id=>document.getElementById(id);
  const userAudio=$('user-audio');
  let ctx, gain, buffer, source, playing=false, startedAt=0, offset=0, duration=24, audioURL, videoURL, customAudio=false, toastTimer, pending=false;
  const state={volume:.5};
  const format=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
  function demoBuffer(){
    const sr=22050,b=ctx.createBuffer(2,24,sr);
    const notes=[55,65.4064,82.4069,110];
    let seed=1701;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);let noise=0;for(let i=0;i<d.length;i++){const t=i/sr;let pad=0;for(let n=0;n<notes.length;n++){const f=notes[n]*(1+(ch?1:-1)*.0008);pad+=(Math.sin(2*Math.PI*f*t)+.2*Math.sin(2*Math.PI*f*2*t))*(.045+.01*Math.sin(2*Math.PI*t/6+n));}const beat=t%(.75);const kick=Math.sin(2*Math.PI*(46*beat+2.8*(1-Math.exp(-beat*35))))*Math.exp(-beat*18)*.13;noise=noise*.96+(random()*2-1)*.04;const hat=noise*Math.exp(-((t+.375)%.75)*80)*.035;const fade=Math.min(1,t/.25,(24-t)/.25);d[i]=(pad+kick+hat)*fade*.85;}}
    return b;
  }
  function current(){return customAudio?(userAudio.currentTime||0):(playing?(offset+(ctx.currentTime-startedAt))%duration:offset);}
  function renderState(){document.body.classList.toggle('is-playing',playing);$('sound-label').textContent=playing?'ЗВУК ВКЛ.':'ЗВУК ВЫКЛ.';$('sound-toggle').setAttribute('aria-pressed',String(playing));$('listen-label').textContent=playing?'ПАУЗА':'СЛУШАТЬ';for(const id of ['player-play','record-play'])$(id).setAttribute('aria-label',playing?'Приостановить музыку':customAudio?'Включить свой трек':'Включить демо-звук');}
  function stopDemo(){if(source){try{source.stop();}catch{}source.disconnect();source=null;}}
  async function play(){
    if(playing||pending)return;pending=true;
    try{if(customAudio){userAudio.volume=state.volume;await userAudio.play();}else{if(!ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('unsupported');ctx=new Audio();gain=ctx.createGain();gain.connect(ctx.destination);buffer=demoBuffer();}await ctx.resume();gain.gain.setValueAtTime(state.volume,ctx.currentTime);source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(gain);source.start(0,offset%duration);startedAt=ctx.currentTime;}playing=true;renderState();}catch{toast('Не удалось включить звук. Попробуй другой аудиофайл.');}finally{pending=false;}
  }
  function pause(){if(!playing)return;offset=current();if(customAudio)userAudio.pause();else stopDemo();playing=false;renderState();}
  function toggle(){playing?pause():play();}
  ['listen','player-play','record-play','sound-toggle'].forEach(id=>$(id).addEventListener('click',toggle));
  $('volume').addEventListener('input',e=>{state.volume=Number(e.target.value);e.target.style.setProperty('--progress',`${state.volume*100}%`);userAudio.volume=state.volume;if(gain&&ctx)gain.gain.setTargetAtTime(state.volume,ctx.currentTime,.05);});
  $('seek').addEventListener('input',e=>{const wasPlaying=playing;pause();offset=Math.min(Number(e.target.value),Math.max(0,duration-.01));if(customAudio)userAudio.currentTime=offset;if(wasPlaying)play();$('current-time').textContent=format(offset);});
  function updatePlayer(){const t=current();if(document.activeElement!==$('seek')){$('seek').value=t;$('seek').style.setProperty('--progress',`${t/duration*100}%`);}$('current-time').textContent=format(t);requestAnimationFrame(updatePlayer);}requestAnimationFrame(updatePlayer);
  userAudio.loop=true;
  userAudio.addEventListener('loadedmetadata',()=>{if(Number.isFinite(userAudio.duration)&&userAudio.duration>0){duration=userAudio.duration;$('seek').max=duration;$('duration').textContent=format(duration);}});
  userAudio.addEventListener('error',()=>{pause();if(customAudio)toast('Браузер не смог прочитать трек. Попробуй MP3 или WAV.');});
  function open(id){$(id).showModal();}
  $('menu-open').addEventListener('click',()=>open('menu-dialog'));
  $('about-open').addEventListener('click',()=>open('about-dialog'));
  $('settings-open').addEventListener('click',()=>open('settings-dialog'));
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  $('menu-listen').addEventListener('click',()=>{$('menu-dialog').close();toggle();});
  $('menu-about').addEventListener('click',()=>{$('menu-dialog').close();open('about-dialog');});
  $('menu-settings').addEventListener('click',()=>{$('menu-dialog').close();open('settings-dialog');});
  $('about-listen').addEventListener('click',()=>{$('about-dialog').close();play();});
  $('year-input').addEventListener('input',e=>{e.target.value=e.target.value.replace(/[^0-9]/g,'').slice(0,4);if(e.target.value.length===4){$('year-display').textContent=e.target.value;document.querySelectorAll('[data-year]').forEach(el=>el.textContent=e.target.value);document.querySelector('.visual').setAttribute('aria-label',`Вращающийся металлический знак XO и год ${e.target.value}`);}});
  $('year-input').addEventListener('blur',e=>{if(e.target.value.length!==4)e.target.value=$('year-display').textContent;});
  $('audio-upload').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;if(file.type&&!file.type.startsWith('audio/')){toast('Выбери аудиофайл.');return;}pause();if(audioURL)URL.revokeObjectURL(audioURL);audioURL=URL.createObjectURL(file);userAudio.src=audioURL;customAudio=true;offset=0;duration=24;$('seek').max=24;$('duration').textContent='--:--';$('track-title').textContent=file.name.replace(/\.[^.]+$/,'');$('track-detail').textContent='XO.DX / ТВОЙ ТРЕК';$('audio-file-label').textContent=file.name;renderState();toast('Трек добавлен. Нажми «Слушать».');});
  $('video-upload').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.type&&!file.type.startsWith('video/')){toast('Выбери видеофайл.');return;}if(videoURL)URL.revokeObjectURL(videoURL);videoURL=URL.createObjectURL(file);const video=$('hero-video');video.src=videoURL;video.hidden=false;$('sculpture').hidden=true;$('fallback-logo').hidden=true;$('video-file-label').textContent=file.name;try{await video.play();toast('Видео установлено на обложку.');}catch{video.hidden=true;$('sculpture').hidden=false;toast('Не удалось воспроизвести видео. Попробуй MP4 (H.264) или WebM.');}});
  $('hero-video').addEventListener('error',()=>{$('hero-video').hidden=true;$('sculpture').hidden=false;toast('Формат видео не поддерживается. Попробуй MP4 (H.264).');});
  $('reset-demo').addEventListener('click',()=>{pause();customAudio=false;userAudio.removeAttribute('src');userAudio.load();if(audioURL)URL.revokeObjectURL(audioURL);if(videoURL)URL.revokeObjectURL(videoURL);audioURL=null;videoURL=null;$('hero-video').pause();$('hero-video').removeAttribute('src');$('hero-video').hidden=true;$('sculpture').hidden=false;$('audio-upload').value='';$('video-upload').value='';$('audio-file-label').textContent='MP3, WAV, OGG, M4A';$('video-file-label').textContent='MP4, WebM · зацикленное, без звука';$('track-title').textContent='Первый сигнал';$('track-detail').textContent='XO.DX / ДЕМО-ЗВУК';offset=0;duration=24;$('seek').max=24;$('duration').textContent='00:24';renderState();toast('Демо-материалы восстановлены.');});
  document.querySelectorAll('label.upload').forEach(label=>{label.tabIndex=0;label.setAttribute('role','button');label.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$(label.htmlFor).click();}});});
})();
