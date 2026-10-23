/* Static browser client. Only setup preferences are stored, never roles or round state. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const {themes, modes, buildDeck, themeImages} = window.ImposterData;
  const {Game, maxImposters, shuffle} = window.ImposterEngine;
  const colors = ['#b5a0ed','#86bda3','#89b4df','#e6ac7b','#c490c4','#c6c978','#84bcbc','#df99a4','#a49ce0','#a3bf80','#caad96','#91a9bd'];
  let count = 6, names = Array(12).fill(''), theme = 'clash', mode = 'classic';
  let game = null, selectedVote = null, previousWord = '', secretShown = false, heldPointer = null, hideTimer = 0;
  let timer = {length: 180, remaining: 180000, deadline: 0, paused: false, interval: null};
  const dialog = $('#dialog');
  const warmedImages=new Set();
  function warmCardImages(){
    if(theme!=='clash')return;
    for(const src of ['assets/images/cards-base.webp','assets/images/cards-special.webp']){
      if(warmedImages.has(src))continue;
      warmedImages.add(src);const image=new Image();image.src=src;
    }
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
  function icon(name, className = 'icon') { const el = document.createElementNS(svgNS, 'svg'); el.setAttribute('class', className); el.setAttribute('aria-hidden', 'true'); const use = document.createElementNS(svgNS, 'use'); use.setAttribute('href', '#' + name); el.append(use); return el; }
  function cardArtwork(source, label) {
    if (source && typeof source === 'object') {
      const art = node('span','card-atlas');
      art.setAttribute('role','img'); art.setAttribute('aria-label',label);
      art.style.backgroundImage = `url("${source.src}")`;
      art.style.backgroundSize = `${source.cols * 100}% ${source.rows * 100}%`;
      art.style.backgroundPosition = `${source.x * 100 / Math.max(1,source.cols-1)}% ${source.y * 100 / Math.max(1,source.rows-1)}%`;
      return art;
    }
    const image = node('img','secret-photo'); image.src = source; image.alt = label;
    return image;
  }
  function showDeck() {
    const content=node('div'); const cards=buildDeck('clash',filters());
    content.append(node('p','deck-note',`${cards.length} Karten im aktuellen Pool. Evolutionen, Champions und Helden schaltet ihr in der Lobby dazu.`));
    const gallery=node('div','deck-gallery');
    cards.forEach(c=>{const entry=node('div','deck-entry');entry.append(cardArtwork(c.image,c.word),node('strong','',c.word));if(c.image?.basis)entry.append(node('small','','Basisillustration'));gallery.append(entry)});
    content.append(gallery);openDialog('Clash-Royale-Karten',content,[{label:'Zurück zum Spiel',primary:true}]);dialog.classList.add('deck-dialog');
  }
  function setText(selector, text) { $(selector).textContent = text; }
  function collectNames() { $$('#names input').forEach((input, i) => { names[i] = input.value; }); }
  function filters() { return {evo: $('#evo').checked, champions: $('#champions').checked, heroes: $('#heroes').checked}; }
  function deck() { return buildDeck(theme, filters(), $('#custom-words').value); }
  const preferences=window.ImposterPreferences;
  let storage=null;try{storage=window.localStorage}catch(_){}
  let hasSavedSetup=false,storageAvailable=true,setupStep=0,stepAnimation=null,dealAnimation=null;
  function setupSettings(){return{count,names:[...names],theme,mode,imposters:Number($('#imposter-count').value)||1,filters:filters(),hints:$('#hints').checked,anonymous:$('#anonymous').checked,timer:Number($('#timer-setting').value),custom:$('#custom-words').value}}
  function updateSavedGroup(){
    const active=names.slice(0,count);const usable=hasSavedSetup&&active.some(n=>n.trim());
    $('#saved-group').hidden=setupStep!==0||!usable;
    setText('#saved-names',active.map((n,i)=>n.trim()||`Person ${i+1}`).join(' · '));
    const label=$('.saved-label');label.lastChild.textContent=storageAvailable?'Gruppe gespeichert':'Gruppe für diese Sitzung';
    const message=storageAvailable?'Namen und Regeln sind auf diesem Gerät gespeichert.':'Der Browser erlaubt kein dauerhaftes Speichern. Die Gruppe bleibt für diese Sitzung erhalten.';
    const feedback=$('#save-feedback span');if(feedback.textContent!==message)feedback.textContent=message;
  }
  function saveSetup(){collectNames();storageAvailable=preferences.save(storage,setupSettings());hasSavedSetup=true;updateSavedGroup()}
  function restoreSetup(){
    const loaded=preferences.load(storage);const p=loaded.settings;storageAvailable=loaded.available;hasSavedSetup=loaded.saved;
    count=p.count;names=[...p.names];theme=p.theme;mode=p.mode;
    for(const key of ['evo','champions','heroes'])$('#'+key).checked=p.filters[key];
    $('#hints').checked=p.hints;$('#anonymous').checked=p.anonymous;$('#timer-setting').value=String(p.timer);$('#custom-words').value=p.custom;renderImposters(p.imposters);
  }
  function canAnimate(){return !matchMedia('(prefers-reduced-motion: reduce)').matches&&!document.body.classList.contains('keyboard')}
  function setSetupStep(next,{focus=true,animate=true}={}){
    collectNames();const previous=setupStep;setupStep=Math.max(0,Math.min(2,next));
    $$('.setup-step').forEach(el=>el.hidden=Number(el.dataset.step)!==setupStep);
    $$('[data-setup-step]').forEach(button=>{if(Number(button.dataset.setupStep)===setupStep)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current')});
    $('#step-indicator').style.transform=`translateX(${setupStep*100}%)`;
    $('#setup-back').disabled=setupStep===0;$('#setup-next').hidden=setupStep===2;$('#start-game').hidden=setupStep!==2;
    $('#setup-next').firstChild.textContent=setupStep===0?'Weiter zu Mitspieler':'Weiter zu Regeln';
    $('#setup-error').hidden=true;updateSavedGroup();
    if(stepAnimation)stepAnimation.cancel();
    const active=$(`[data-step="${setupStep}"]`);
    if(animate&&previous!==setupStep&&canAnimate()&&active.animate)stepAnimation=active.animate([{opacity:.25,transform:`translateX(${setupStep>previous?12:-12}px)`},{opacity:1,transform:'translateX(0)'}],{duration:200,easing:'cubic-bezier(.23,1,.32,1)'});
    if(focus){const heading=$(['#theme-title','#party-title','#rules-title'][setupStep]);heading.focus({preventScroll:true});window.scrollTo({top:Math.max(0,$('.setup-progress').getBoundingClientRect().top+window.scrollY-10),behavior:'instant'})}
  }
  function showSetupError(message,step){setSetupStep(step);setText('#setup-error',message);$('#setup-error').hidden=false;$('#setup-error').scrollIntoView({block:'center',behavior:'instant'})}
  function readGameConfig(){return{names:names.slice(0,count).map((n,i)=>n.trim()||`Person ${i+1}`),imposters:Number($('#imposter-count').value),mode,theme,filters:filters(),custom:$('#custom-words').value,hints:$('#hints').checked,anonymous:$('#anonymous').checked,seconds:mode==='blitz'?60:Number($('#timer-setting').value)}}
  function nextSetupStep(){
    collectNames();const config=readGameConfig();const pool=deck();
    if(setupStep===0&&pool.length<6){showSetupError('Ihr braucht mindestens 6 verschiedene Begriffe.',0);return}
    if(setupStep===1){const error=window.ImposterEngine.validate(config,pool);if(error){showSetupError(error,/Begriff|Partner/.test(error)?0:1);return}}
    saveSetup();setSetupStep(setupStep+1);
  }
  function renderNames() {
    $('#names').replaceChildren();
    for (let i = 0; i < count; i++) {
      const field = node('div','name-field'); const input = node('input'); const label = node('label','',`Name von Person ${i + 1}`);
      input.id = `player-${i}`; label.htmlFor = input.id; input.value = names[i]; input.placeholder = `Person ${i + 1}`; input.maxLength = 28; input.autocomplete = 'off'; input.spellcheck = false;
      input.enterKeyHint=i===count-1?'done':'next';input.autocapitalize='words';
      input.addEventListener('input',saveSetup);input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();if(i<count-1)$('#player-'+(i+1)).focus();else input.blur()}});
      field.append(label,node('span','name-number',String(i + 1).padStart(2,'0')),input); $('#names').append(field);
    }
    setText('#player-count', count); $('#players-minus').disabled = count === 3; $('#players-plus').disabled = count === 12;
  }
  function renderImposters(preferred) {
    const old = preferred || Number($('#imposter-count').value) || 1;
    const select = $('#imposter-count'); select.replaceChildren();
    for (let i = 1; i <= maxImposters(count); i++) { const opt = node('option','',String(i)); opt.value = String(i); select.append(opt); }
    select.value = String(Math.max(1,Math.min(old,maxImposters(count))));
  }
  function renderThemes() {
    $('#themes').replaceChildren();
    themes.forEach((t, i) => {
      const button = node('button','theme-card'); button.type = 'button'; button.dataset.theme = t.id; button.style.setProperty('--theme', t.color); button.setAttribute('aria-pressed',String(t.id === theme));
      const art = node('span','theme-art'); const thumb=node('img');thumb.src=themeImages[t.id];thumb.alt='';thumb.loading='lazy';thumb.addEventListener('error',()=>thumb.replaceWith(node('span','theme-art-fallback',t.name)),{once:true});art.append(thumb);
      const check = node('span','selection-check'); check.append(icon('check')); check.setAttribute('aria-hidden','true');
      const copy = node('span','theme-copy'); const size = t.id === 'custom' ? 'EURE EIGENEN BEGRIFFE' : `${buildDeck(t.id, filters()).length} BEGRIFFE`;
      copy.append(node('strong','',t.name),node('small','',t.sub),node('span','theme-count',size)); button.append(art,check,copy);
      button.addEventListener('click', () => { theme = t.id; updateSelection(); saveSetup(); }); $('#themes').append(button);
    });
  }
  function renderModes() {
    $('#modes').replaceChildren();
    modes.forEach((m, i) => {
      const button = node('button','mode-option'); button.type = 'button'; button.dataset.mode = m.id; button.setAttribute('aria-pressed',String(m.id === mode));
      const label = node('span'); label.append(node('strong','',m.name),node('small','',m.desc));
      button.append(node('span','mode-radio'),label,node('span','mode-badge',i === 2 ? '60 SEK.' : i === 1 ? 'VERDECKT' : 'ORIGINAL'));
      button.addEventListener('click', () => { mode = m.id; updateSelection(); saveSetup(); }); $('#modes').append(button);
    });
  }
  function updateSelection() {
    warmCardImages();
    $$('.theme-card').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.theme === theme)));
    $$('.mode-option').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.mode === mode)));
    $('#clash-options').hidden = theme !== 'clash'; $('#custom-options').hidden = theme !== 'custom'; $('#hint-setting').hidden = mode === 'undercover';
    $('#timer-setting').disabled = mode === 'blitz';
    setText('#custom-count', `${buildDeck('custom',{},$('#custom-words').value).length} UNTERSCHIEDLICHE BEGRIFFE`);
    const selectedTheme = themes.find(t => t.id === theme); const selectedMode = modes.find(m => m.id === mode);
    const imposters = Number($('#imposter-count').value);
    setText('#start-summary', `${selectedTheme.name} · ${selectedMode.name} · ${count} Personen · ${imposters} Imposter`);
    $('#setup-error').hidden = true;updateSavedGroup();
  }
  function showView(id, focusSelector) {
    hideSecret(true); $$('.view').forEach(el => { el.hidden = el.id !== id; });
    setText('#breadcrumb',id === 'setup-view' ? 'NEUE RUNDE' : id === 'result-view' ? 'AUFLÖSUNG' : 'RUNDE LÄUFT');
    window.scrollTo({top:0,behavior:'instant'});
    if (focusSelector) $(focusSelector).focus({preventScroll:true});
  }
  function openDialog(title, content, actions = []) {
    hideSecret(true); dialog.classList.remove('deck-dialog'); setText('#dialog-title', title); $('#dialog-body').replaceChildren(); $('#dialog-actions').replaceChildren();
    if (typeof content === 'string') $('#dialog-body').append(node('p','',content)); else $('#dialog-body').append(content);
    for (const action of actions) { const button = node('button','button ' + (action.danger ? 'danger' : action.primary ? 'primary' : 'secondary'),action.label); button.addEventListener('click', () => { dialog.close(); if (action.run) action.run(); }); $('#dialog-actions').append(button); }
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop=0;
  }
  function rules() {
    const content = node('div'); const steps = node('div','rules-steps');
    [['Welt und Gruppe wählen','Sucht euch eine Themenwelt aus. Tragt eure Namen ein und entscheidet, wie viele Imposter mitspielen.'],['Rollen geheim ansehen','Gebt das Gerät reihum weiter. Haltet eure Karte gedrückt und lasst los, bevor die nächste Person schaut.'],['Hinweise geben','Eine Person beginnt. Alle nennen reihum ein Wort oder einen kurzen Hinweis zum eigenen Begriff, ohne ihn zu verraten. Imposter müssen bluffen.'],['Gemeinsam entscheiden','Diskutiert euren Verdacht und stimmt in der Gruppe ab. Wählt die Person mit den meisten Stimmen aus und bestätigt den Ausschluss. Bei Gleichstand diskutiert weiter.']].forEach(([title,text],i)=>{const row=node('div','rule-step');const copy=node('div');copy.append(node('strong','',title),node('p','',text));row.append(node('span','step-number',String(i+1).padStart(2,'0')),copy);steps.append(row)});
    content.append(steps,node('p','','Das Team gewinnt, wenn alle Imposter gefunden sind. Die Imposter gewinnen, sobald sie mindestens so viele sind wie die übrigen Teammitglieder.'),node('p','','Undercover: Die Imposter sehen einen ähnlichen Begriff. Niemand erfährt vor der Auflösung die eigene Rolle. Blitzrunde: Ein Hinweis pro Person, dann nach 60 Sekunden abstimmen. Eigene Begriffe sind für die Person, die sie eingibt, natürlich bereits bekannt.'));
    openDialog('Einer blufft. Findet ihn.', content, [{label:'Alles klar. Los geht’s.',primary:true}]);
  }
  function startGame(){
    collectNames();const config=readGameConfig();
    try{const nextGame=new Game(config,buildDeck(config.theme,config.filters,config.custom),{previousWord});
      names.splice(0,count,...config.names);renderNames();saveSetup();stopTimer();game=nextGame;previousWord=game.entry.word;renderTurn();
    }catch(error){showSetupError(error.message,/Begriff|Partner/.test(error.message)?0:1)}
  }
  function restartGame(){
    if(!game||game.phase!=='result')return;
    const config={...game.config,names:[...game.config.names]};
    try{const nextGame=new Game(config,buildDeck(config.theme,config.filters,config.custom),{previousWord});stopTimer();game=nextGame;previousWord=game.entry.word;renderTurn()}catch(error){returnToSetup();showSetupError(error.message,0)}
  }
  function renderTurn() {
    const p = game.players[game.turn]; showView('reveal-view'); setText('#turn-title',p.name); $('#turn-title').style.color = colors[p.id];
    setText('#reveal-progress',`${game.turn + 1} / ${game.players.length}`); $('#next-player').disabled = true; $('#secret-card').setAttribute('aria-label',`${p.name}: gedrückt halten, um deinen Begriff anzusehen. Leertaste oder Enter ebenfalls gedrückt halten.`);
    $('#handoff-dots').replaceChildren(); game.players.forEach((_,i) => $('#handoff-dots').append(node('i',i < game.turn ? 'done' : i === game.turn ? 'current' : '')));
    $('#next-player').firstChild.textContent = game.turn === game.players.length-1 ? 'Alle bereit. Los geht’s.' : 'Gesehen. Weitergeben.';
    $('#turn-title').focus({preventScroll:true});
    if(dealAnimation)dealAnimation.cancel();
    if(canAnimate()&&$('.card-perspective').animate)dealAnimation=$('.card-perspective').animate([{opacity:.3,transform:'translateY(12px) rotate(-2deg)'},{opacity:1,transform:'translateY(0) rotate(0deg)'}],{duration:240,easing:'cubic-bezier(.23,1,.32,1)'});
  }
  function revealSecret() {
    if (!game || game.phase !== 'reveal' || dialog.open || document.hidden) return;
    clearTimeout(hideTimer); secretShown = true;
    const secret = game.secret(); const content = $('#secret-content'); const inner=node('span','secret-inner');
    content.replaceChildren(inner);content.classList.toggle('danger-card',secret.danger);content.classList.toggle('is-clash',theme==='clash'&&!secret.danger);
    inner.append(node('span','secret-role',secret.role.toLocaleUpperCase('de')));
    if (secret.image) {
      inner.append(cardArtwork(secret.image,secret.word));
    } else if (secret.danger) {
      const image=node('img','imposter-face-image');image.src='assets/images/card-back.webp';image.alt='';inner.append(image);
    } else {
      const image=node('img','secret-photo'); image.src=themeImages[theme];image.alt='';
      if(['minecraft','pokemon'].includes(theme))image.classList.add('item-art');
      inner.append(image);
    }
    inner.append(node('strong','secret-word',secret.word));
    if(secret.hint){const hint=node('span','secret-hint');hint.append(node('small','','DEIN TIPP'),node('span','',secret.hint));inner.append(hint)}
    else inner.append(node('span','secret-safe',mode==='undercover'?'Begriff merken. Rolle bleibt geheim.':secret.danger?'Hör den anderen genau zu.':'Verrate den Begriff nicht.'));
    if(secret.image?.basis)inner.append(node('small','art-credit','Evolution mit Basisillustration'));
    content.hidden=false;content.setAttribute('aria-hidden','false');$('#secret-cover').hidden=false;$('#secret-cover').setAttribute('aria-hidden','true');$('#secret-card').classList.add('revealed');$('#next-player').disabled=false;
    setText('#accessible-reveal','Karte wieder verdecken');
  }
  function hideSecret(immediate) {
    clearTimeout(hideTimer);secretShown=false;heldPointer=null;
    // Clear sensitive text and artwork before the return flip, including on blur/cancel.
    $('#secret-content').replaceChildren();$('#secret-content').setAttribute('aria-hidden','true');
    $('#secret-cover').hidden=false;$('#secret-cover').setAttribute('aria-hidden','false');$('#secret-card').classList.remove('revealed');
    if(immediate===true)$('#secret-content').hidden=true;
    else hideTimer=setTimeout(()=>{if(!secretShown)$('#secret-content').hidden=true},280);
    setText('#accessible-reveal','Karte per Klick anzeigen');
  }
  function nextPlayer() { hideSecret(); if (!game || !game.next()) return; if (game.phase === 'discussion') beginDiscussion(); else renderTurn(); }
  function stopTimer() { clearInterval(timer.interval); timer.interval = null; }
  function renderTimer() {
    if (!timer.paused && timer.length > 0) timer.remaining = Math.max(0,timer.deadline-Date.now());
    const seconds = Math.ceil(timer.remaining / 1000);
    setText('#time-left',timer.length === 0 ? '∞' : `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`);
    $('.timer-ring-fill').style.strokeDashoffset = timer.length === 0 ? '0' : String(515.221 * (1 - timer.remaining/(timer.length*1000)));
    const expired = timer.length > 0 && timer.remaining <= 0;
    $('#timer-display').classList.toggle('expired',expired); $('#timer-pause').disabled = timer.length === 0 || expired; $('#timer-reset').disabled = timer.length === 0;
    setText('#timer-caption',timer.length === 0 ? 'NEHMT EUCH EURE ZEIT' : timer.paused ? 'PAUSIERT' : 'ZEIT ZUM DISKUTIEREN');
    $('#timer-pause use').setAttribute('href',timer.paused ? '#play' : '#pause'); setText('#timer-pause span',timer.paused ? 'Fortsetzen' : 'Pause');
    const message = expired ? 'Die Zeit ist um. Gebt eure letzten Hinweise und stimmt ab.' : '';
    if ($('#timer-message').textContent !== message) setText('#timer-message',message);
    if (expired) stopTimer();
  }
  function startTimer() { stopTimer(); timer.length = game.config.seconds; timer.remaining = timer.length * 1000; timer.deadline = Date.now()+timer.remaining; timer.paused = false; renderTimer(); if (timer.length > 0) timer.interval = setInterval(renderTimer,250); }
  function beginDiscussion(reset = true) {
    showView('discussion-view','#discussion-title'); setText('#discussion-theme',themes.find(t => t.id === theme).name + ' / ' + modes.find(m => m.id === mode).name);
    setText('#round-number',`ABSTIMMUNG ${game.round}`);
    const starter = game.players[game.starter]; setText('#starter-text',`${starter.name} beginnt. Gebt danach reihum einen kurzen Hinweis, ohne euren Begriff zu nennen.`);
    $('#alive-list').replaceChildren(); game.alive.forEach(p => { const chip = node('span','person-chip',p.name); chip.style.setProperty('--player-color',colors[p.id]); $('#alive-list').append(chip); });
    if (reset) startTimer(); else { renderTimer(); if (timer.length > 0 && !timer.paused && timer.remaining > 0) timer.interval = setInterval(renderTimer,250); }
  }
  function goVote() {
    if (!game || game.phase !== 'discussion') return;
    renderTimer(); if (!timer.paused) { timer.paused = true; } stopTimer(); game.vote(); selectedVote = null; renderVote();
  }
  function initials(name) { const parts = name.trim().split(/\s+/); const first = s => typeof Intl.Segmenter === 'function' ? ([...new Intl.Segmenter('de',{granularity:'grapheme'}).segment(s || '')][0]?.segment || '?') : (Array.from(s || '')[0] || '?'); return (first(parts[0])+(parts.length > 1 ? first(parts.at(-1)) : '')).toLocaleUpperCase('de'); }
  function avatar(p) { const a = node('span','avatar',initials(p.name)); a.style.setProperty('--player-color',colors[p.id]); a.setAttribute('aria-hidden','true'); return a; }
  function renderVote() {
    showView('vote-view','#vote-title'); $('#vote-grid').replaceChildren(); $('#confirm-vote').disabled = true; $('#confirm-vote').firstChild.textContent = 'Person auswählen';
    game.alive.forEach(p => { const button = node('button','vote-button'); button.dataset.player = String(p.id); button.setAttribute('aria-pressed','false'); const check = node('span','vote-check'); check.append(icon('check')); button.append(avatar(p),node('span','vote-name',p.name),check); button.addEventListener('click', () => { selectedVote = p.id; $$('.vote-button').forEach(b => b.setAttribute('aria-pressed',String(Number(b.dataset.player) === selectedVote))); $('#confirm-vote').disabled = false; $('#confirm-vote').firstChild.textContent = `${p.name} ausschließen`; }); $('#vote-grid').append(button); });
  }
  function confirmVote() {
    const person = game?.players.find(p => p.id === selectedVote && p.alive); if (!person || game.phase !== 'vote') return;
    openDialog(`${person.name} ausschließen?`,'Bestätigt nur, wenn eure Gruppe sich entschieden hat. Diese Person spielt für den Rest der Runde nicht mehr mit.',[{label:'Noch nicht'},{label:'Ja, ausschließen',danger:true,run:()=>{const result = game.eject(person.id); selectedVote = null; if (result.winner) renderResult(); else { showView('ejected-view'); setText('#ejected-title',result.name); setText('#ejected-message',result.imposter === null ? 'Die Rolle bleibt bis zur Auflösung geheim.' : result.imposter ? 'Ihr habt einen Imposter gefunden.' : 'Diese Person gehörte zum Team.'); setText('#ejected-remaining',`${game.alive.length} Personen sind noch dabei. Die Runde geht weiter.`); $('#ejected-title').focus({preventScroll:true}); }}}]);
  }
  function renderResult() {
    stopTimer(); showView('result-view'); const won = game.winner === 'team';
    setText('#result-title',won ? 'Das Team gewinnt.' : 'Die Imposter gewinnen.'); setText('#result-subtitle',won ? 'Das Team gewinnt. Ihr habt alle Imposter gefunden.' : 'Die Imposter gewinnen. Sie sind jetzt mindestens so viele wie das übrige Team.');
    $('#result-emblem use').setAttribute('href',won ? '#shield' : '#eye'); $('#result-emblem').style.color = won ? 'var(--accent)' : 'var(--red)';
    setText('#result-word',game.entry.word); $('#alternate-recap').hidden = mode !== 'undercover'; setText('#alternate-recap',`Begriff der Imposter: ${game.entry.alternate || ''}`);
    $('#result-roster').replaceChildren(); game.players.forEach(p => { const row = node('div','result-person'); row.append(avatar(p),node('span','',p.name),node('span','role-tag' + (p.imposter ? ' imposter' : ''),p.imposter ? 'IMPOSTER' : 'TEAM')); $('#result-roster').append(row); }); $('#result-title').focus({preventScroll:true});
  }
  function returnToSetup(){stopTimer();game=null;showView('setup-view');setSetupStep(1);updateSavedGroup()}
  function askExit() { if (!game || game.phase === 'result') returnToSetup(); else openDialog('Die Runde beenden?','Die Rollen und der aktuelle Spielstand werden verworfen. Eure Namen und Einstellungen bleiben erhalten.',[{label:'Weiterspielen'},{label:'Zur Lobby',danger:true,run:returnToSetup}]); }
  $('#players-minus').addEventListener('click',()=>{if(count<=3)return;collectNames();count--;renderNames();renderImposters();updateSelection();saveSetup()});
  $('#players-plus').addEventListener('click',()=>{if(count>=12)return;collectNames();count++;renderNames();renderImposters();updateSelection();saveSetup()});
  $('#shuffle-names').addEventListener('click',()=>{collectNames();const active=names.slice(0,count).map((n,i)=>n.trim()||`Person ${i+1}`);names.splice(0,count,...shuffle(active));renderNames();saveSetup()});
  ['evo','champions','heroes'].forEach(id=>$('#'+id).addEventListener('change',()=>{renderThemes();updateSelection();saveSetup()}));
  ['imposter-count','timer-setting','hints','anonymous'].forEach(id=>$('#'+id).addEventListener('change',()=>{updateSelection();saveSetup()}));
  $('#custom-words').addEventListener('input',()=>{updateSelection();saveSetup()}); $('#start-game').addEventListener('click',startGame); $('#next-player').addEventListener('click',nextPlayer);
  $('#secret-card').addEventListener('pointerdown',e=>{if(e.button!==0 || heldPointer !== null)return;heldPointer=e.pointerId;$('#secret-card').setPointerCapture(e.pointerId);revealSecret()});
  ['pointerup','pointercancel','lostpointercapture','pointerleave'].forEach(type=>$('#secret-card').addEventListener(type,()=>hideSecret()));
  $('#secret-card').addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)revealSecret()}if(e.key==='Escape')hideSecret()});
  $('#secret-card').addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();hideSecret()}}); $('#secret-card').addEventListener('blur',hideSecret); $('#secret-card').addEventListener('contextmenu',e=>e.preventDefault());
  $('#accessible-reveal').addEventListener('click',()=>{if(secretShown)hideSecret();else revealSecret()}); $('#accessible-reveal').addEventListener('blur',hideSecret);
  window.addEventListener('blur',hideSecret); document.addEventListener('visibilitychange',()=>{hideSecret();if(game?.phase==='discussion')renderTimer()}); document.addEventListener('keydown',e=>{document.body.classList.add('keyboard');if(e.key==='Escape')hideSecret()}); document.addEventListener('pointerdown',()=>document.body.classList.remove('keyboard'),{passive:true});
  $('#timer-pause').addEventListener('click',()=>{if(!timer.paused){renderTimer();timer.paused=true;stopTimer()}else{timer.paused=false;timer.deadline=Date.now()+timer.remaining;stopTimer();timer.interval=setInterval(renderTimer,250)}renderTimer()}); $('#timer-reset').addEventListener('click',startTimer); $('#go-vote').addEventListener('click',goVote);
  $('#back-discussion').addEventListener('click',()=>{game.phase='discussion';beginDiscussion(false)}); $('#confirm-vote').addEventListener('click',confirmVote); $('#continue-round').addEventListener('click',()=>{game.discuss();beginDiscussion()});
  $('#view-deck').addEventListener('click',showDeck); $('#play-again').addEventListener('click',restartGame); $('#new-setup').addEventListener('click',returnToSetup); $$('.exit-game').forEach(b=>b.addEventListener('click',askExit)); $('#nav-play').addEventListener('click',()=>{if(!game)$('#main').focus();else askExit()});
  $$('[data-help]').forEach(button=>button.addEventListener('click',rules)); $('#dialog-close').addEventListener('click',()=>dialog.close()); dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
  $$('[data-setup-step]').forEach(b=>b.addEventListener('click',()=>setSetupStep(Number(b.dataset.setupStep))));
  $('#setup-back').addEventListener('click',()=>setSetupStep(setupStep-1));$('#setup-next').addEventListener('click',nextSetupStep);
  $('#quick-start').addEventListener('click',startGame);$('#edit-saved').addEventListener('click',()=>setSetupStep(1));
  window.addEventListener('pagehide',saveSetup);
  if(window.visualViewport){const syncKeyboard=()=>document.body.classList.toggle('keyboard-open',!!document.activeElement?.matches('#names input,textarea')&&window.visualViewport.height<window.innerHeight*.75);window.visualViewport.addEventListener('resize',syncKeyboard);document.addEventListener('focusout',()=>requestAnimationFrame(syncKeyboard))}
  restoreSetup(); renderNames(); if(!$('#imposter-count').options.length)renderImposters(); renderThemes(); renderModes(); updateSelection();setSetupStep(0,{focus:false,animate:false});
})();
