/* script.js — Full functionality: preloads cats, swipe (touch+mouse), floating paws, sounds, summary, undo/reset. */

(() => {
  // Config
  const NUM_CATS = 14; // adjust 10-20
  const cardArea = document.getElementById('cardArea');
  const likeBtn = document.getElementById('likeBtn');
  const dislikeBtn = document.getElementById('dislikeBtn');
  const resetBtn = document.getElementById('resetBtn');
  const undoBtn = document.getElementById('undoBtn');
  const startBtn = document.getElementById('startBtn');
  const skipBtn = document.getElementById('skipBtn');
  const onboarding = document.getElementById('onboarding');
  const app = document.getElementById('app');
  const summary = document.getElementById('summary');
  const likedGrid = document.getElementById('likedGrid');
  const likedCount = document.getElementById('likedCount');
  const closeSummary = document.getElementById('closeSummary');
  const restartBtn = document.getElementById('restartBtn');
  const pawContainer = document.querySelector('.paw-container');

  // Data
  let cards = [];
  let liked = [];
  let history = [];

  // Sound: prefer file audio if present, otherwise use WebAudio fallback
  const meowAudioElem = document.getElementById('meowAudio');
  const popAudioElem = document.getElementById('popAudio');
  let audioEnabled = true;

  // WebAudio fallback generator
  let audioCtx = null;
  function ensureAudioContext(){
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e){ audioCtx = null; }
    }
  }

  function playMeowFallback(){
    ensureAudioContext();
    if(!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(600, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.22);
    g.gain.setValueAtTime(0.001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.6, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.55);
  }

  function playPopFallback(){
    ensureAudioContext();
    if(!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * 0.08;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++){
      data[i] = (Math.random()*2-1) * Math.exp(-i/ (bufferSize*0.05));
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx.destination);
    src.start();
  }

  async function playMeow(){
    if(!audioEnabled) return;
    if(meowAudioElem && meowAudioElem.src){
      try{
        await meowAudioElem.play();
      }catch(e){
        // autoplay may be blocked; try WebAudio fallback
        playMeowFallback();
      }
    } else {
      playMeowFallback();
    }
  }
  async function playPop(){
    if(!audioEnabled) return;
    if(popAudioElem && popAudioElem.src){
      try{
        await popAudioElem.play();
      }catch(e){
        playPopFallback();
      }
    } else {
      playPopFallback();
    }
  }

  // Create Cataas URLs (unique)
  function catUrl(i){
    return `https://cataas.com/cat?type=medium&timestamp=${Date.now()}_${i}`;
  }

  // Preload images
  function preload(n){
    const urls = Array.from({length:n}, (_,i)=>catUrl(i));
    return Promise.all(urls.map(u => new Promise((res) => {
      const img = new Image();
      img.onload = () => res(u);
      img.onerror = () => res(u);
      img.src = u;
    })));
  }

  // Create card node
  function createCard(url, idx){
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.index = idx;
    // badges
    const likeBadge = document.createElement('div');
    likeBadge.className = 'badge like';
    likeBadge.innerHTML = '❤️ Liked';
    const dislikeBadge = document.createElement('div');
    dislikeBadge.className = 'badge dislike';
    dislikeBadge.innerHTML = '💔 Disliked';
    // image
    const img = document.createElement('img');
    img.src = url;
    img.alt = `Cute cat #${idx+1}`;

    el.appendChild(likeBadge);
    el.appendChild(dislikeBadge);
    el.appendChild(img);
    cardArea.appendChild(el);
    return el;
  }

  // Setup stacking and handlers
  function setup(){
    cards = Array.from(cardArea.children);
    cards.forEach((card, i) => {
      card.style.zIndex = i;
      addDragHandlers(card);
    });
  }

  // Show summary overlay
  function showSummary(){
    likedGrid.innerHTML = '';
    likedCount.textContent = liked.length;
    if(liked.length === 0){
      likedGrid.innerHTML = '<div style="color:var(--muted);padding:12px">No kitties liked this time 😿</div>';
    } else {
      liked.forEach(src => {
        const im = document.createElement('img');
        im.src = src;
        likedGrid.appendChild(im);
      });
    }
    summary.classList.remove('hidden');
  }

  // swipe top programmatically
  function swipeTop(direction){
    const top = cardArea.lastElementChild;
    if(!top) return;
    const img = top.querySelector('img');
    const url = img ? img.src : null;
    top.style.transition = 'transform .45s cubic-bezier(.22,.9,.2,1), opacity .3s';
    const offX = (direction === 'right') ? window.innerWidth : -window.innerWidth;
    top.style.transform = `translate(${offX}px, -40px) rotate(${direction==='right'?25:-25}deg)`;
    top.style.opacity = '0';
    top.classList.toggle('show-like', direction==='right');
    top.classList.toggle('show-dislike', direction!=='right');
    setTimeout(() => {
      top.remove();
      history.push({type: direction, url});
      if(direction === 'right') liked.push(url);
      if(!cardArea.lastElementChild) showSummary();
    }, 360);
  }

  // Undo last swipe
  function undo(){
    const last = history.pop();
    if(!last) return;
    // recreate card at the end (top)
    const node = createCard(last.url, 999);
    if(last.type === 'right'){
      const idx = liked.lastIndexOf(last.url);
      if(idx > -1) liked.splice(idx, 1);
    }
    node.style.transition = 'none';
    node.style.opacity = '1';
    node.style.transform = 'translateY(0)';
    addDragHandlers(node);
  }

  // Animate swipe with sounds
  function animateSwipe(card, direction){
    card.style.transition = 'transform .42s cubic-bezier(.22,.9,.2,1), opacity .32s';
    card.style.transform = `translateX(${direction}px) rotate(${direction/10}deg)`;
    card.style.opacity = '0';
    setTimeout(()=> { card.remove(); if(!cardArea.lastElementChild) showSummary(); }, 360);
  }

  /* Drag / swipe handlers (touch + mouse) */
  function addDragHandlers(card){
    let startX = 0, startY = 0, currentX = 0, currentY = 0, dragging = false;
    const img = card.querySelector('img');

    function pointerDown(x, y){
      dragging = true;
      startX = x; startY = y;
      card.style.transition = 'none';
      card.style.willChange = 'transform';
    }
    function pointerMove(x, y){
      if(!dragging) return;
      currentX = x - startX;
      currentY = y - startY;
      const rotate = currentX * 0.08;
      card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;
      if(currentX > 40){ card.classList.add('show-like'); card.classList.remove('show-dislike'); }
      else if(currentX < -40){ card.classList.add('show-dislike'); card.classList.remove('show-like'); }
      else { card.classList.remove('show-like','show-dislike'); }
    }
    async function pointerUp(){
      if(!dragging) return;
      dragging = false;
      const threshold = cardArea.clientWidth * 0.25;
      if(currentX > threshold){
        // like
        const url = img ? img.src : null;
        history.push({type:'right', url});
        liked.push(url);
        await playMeow();
        animateSwipe(card, window.innerWidth);
      } else if(currentX < -threshold){
        // dislike
        const url = img ? img.src : null;
        history.push({type:'left', url});
        await playPop();
        animateSwipe(card, -window.innerWidth);
      } else {
        card.style.transition = 'transform .28s cubic-bezier(.2,.9,.2,1)';
        card.style.transform = '';
        card.classList.remove('show-like','show-dislike');
      }
      currentX = 0; currentY = 0;
    }

    // touch
    card.addEventListener('touchstart', e => { const t = e.touches[0]; pointerDown(t.clientX, t.clientY); }, {passive:true});
    card.addEventListener('touchmove', e => { const t = e.touches[0]; pointerMove(t.clientX, t.clientY); }, {passive:true});
    card.addEventListener('touchend', pointerUp);

    // mouse
    card.addEventListener('mousedown', e => { pointerDown(e.clientX, e.clientY); });
    window.addEventListener('mousemove', e => { pointerMove(e.clientX, e.clientY); });
    window.addEventListener('mouseup', pointerUp);
  }

  // Floating paws generator (reads assets/paw1.svg and paw2.svg)
  function spawnPaw(){
    const paw = document.createElement('img');
    paw.className = 'floating-paw';
    // choose either paw1 or paw2 for variety
    paw.src = Math.random() > 0.5 ? 'assets/paw1.svg' : 'assets/paw2.svg';
    const left = Math.random() * 92; // percent
    const size = 28 + Math.random() * 36; // px
    paw.style.left = left + '%';
    paw.style.width = `${size}px`;
    paw.style.top = '92vh';
    paw.style.opacity = 0;
    paw.style.transition = 'opacity .2s';
    pawContainer.appendChild(paw);

    // trigger animation using CSS keyframes
    const duration = 5000 + Math.random() * 4200;
    paw.style.animation = `pawFloat ${duration}ms linear forwards`;
    // random rotate
    paw.style.transform = `translateY(0) rotate(${Math.random()*40-20}deg) scale(${0.7 + Math.random()*0.6})`;

    // remove after animation
    setTimeout(()=> paw.remove(), duration + 200);
  }

  // Initialize: preload, create cards, set handlers
  async function init() {
    try{
      const urls = await preload(NUM_CATS);
      urls.forEach((u, i) => createCard(u, i));
      // small delay so DOM has children
      setTimeout(setup, 40);
    }catch(e){
      console.error('Failed to preload cats', e);
    }
    // build UI handlers
    likeBtn && likeBtn.addEventListener('click', ()=> swipeTop('right'));
    dislikeBtn && dislikeBtn.addEventListener('click', ()=> swipeTop('left'));
    resetBtn && resetBtn.addEventListener('click', ()=> location.reload());
    undoBtn && undoBtn.addEventListener('click', undo);
    closeSummary && closeSummary.addEventListener('click', ()=> summary.classList.add('hidden'));
    restartBtn && restartBtn.addEventListener('click', ()=> location.reload());

    // floating paws
    setInterval(spawnPaw, 900);

    // pause/resume audio on user interaction to satisfy autoplay policies
    document.addEventListener('click', () => {
      if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }, {once:true, passive:true});
  }

  // Onboarding flow
  startBtn.addEventListener('click', () => {
    onboarding.classList.add('hidden');
    app.classList.remove('hidden');
    init();
  });
  skipBtn.addEventListener('click', () => {
    onboarding.classList.add('hidden');
    app.classList.remove('hidden');
    init();
  });

  // start silently if user has already interacted
  // (If user opens page without covering the onboarding, we wait for start).
})();
