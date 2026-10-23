/* Static browser client. Only setup preferences are stored, never roles or round state. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const {themes, modes, buildDeck} = window.ImposterData;
  const {Game, maxImposters, shuffle} = window.ImposterEngine;
  const colors = ['#b5a0ed','#86bda3','#89b4df','#e6ac7b','#c490c4','#c6c978','#84bcbc','#df99a4','#a49ce0','#a3bf80','#caad96','#91a9bd'];
  const storageKey = 'imposter-after-dark-setup-v1';
  let count = 6, names = Array(12).fill(''), theme = 'clash', mode = 'classic';
  let game = null, selectedVote = null, previousWord = '', secretShown = false, heldPointer = null;
  let timer = {length: 180, remaining: 180000, deadline: 0, paused: false, interval: null};
  const dialog = $('#dialog');
  const svgNS = 'http://www.w3.org/2000/svg';
  function node(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; }
  function icon(name, className = 'icon') { const el = document.createElementNS(svgNS, 'svg'); el.setAttribute('class', className); el.setAttribute('aria-hidden', 'true'); const use = document.createElementNS(svgNS, 'use'); use.setAttribute('href', '#' + name); el.append(use); return el; }
  function setText(selector, text) { $(selector).textContent = text; }
  function collectNames() { $$('#names input').forEach((input, i) => { names[i] = input.value; }); }
  function filters() { return {evo: $('#evo').checked, champions: $('#champions').checked, heroes: $('#heroes').checked}; }
  function deck() { return buildDeck(theme, filters(), $('#custom-words').value); }
  function saveSetup() {
    collectNames();
    try { localStorage.setItem(storageKey, JSON.stringify({count, names, theme, mode, imposters: Number($('#imposter-count').value), filters: filters(), hints: $('#hints').checked, anonymous: $('#anonymous').checked, timer: Number($('#timer-setting').value), custom: $('#custom-words').value})); } catch (_) { /* Private modes can deny storage. Gameplay still works. */ }
  }
  function restoreSetup() {
    try {
      const p = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (!p || typeof p !== 'object') return;
      if (Number.isInteger(p.count) && p.count >= 3 && p.count <= 12) count = p.count;
      if (Array.isArray(p.names)) names = Array.from({length: 12}, (_, i) => typeof p.names[i] === 'string' ? p.names[i].slice(0, 28) : '');
      if (themes.some(t => t.id === p.theme)) theme = p.theme;
      if (modes.some(m => m.id === p.mode)) mode = p.mode;
      if (p.filters && typeof p.filters === 'object') ['evo','champions','heroes'].forEach(k => { if (typeof p.filters[k] === 'boolean') $('#' + k).checked = p.filters[k]; });
      if (typeof p.hints === 'boolean') $('#hints').checked = p.hints;
      if (typeof p.anonymous === 'boolean') $('#anonymous').checked = p.anonymous;
      if ([0,60,180,300].includes(p.timer)) $('#timer-setting').value = String(p.timer);
      if (typeof p.custom === 'string') $('#custom-words').value = p.custom.slice(0,12000);
      renderImposters(p.imposters);
    } catch (_) { /* Ignore outdated or invalid preferences. */ }
  }
  function renderNames() {
    $('#names').replaceChildren();
    for (let i = 0; i < count; i++) {
      const field = node('div','name-field'); const input = node('input'); const label = node('label','',`Name von Person ${i + 1}`);
      input.id = `player-${i}`; label.htmlFor = input.id; input.value = names[i]; input.placeholder = `Person ${i + 1}`; input.maxLength = 28; input.autocomplete = 'off'; input.spellcheck = false;
      input.addEventListener('input', saveSetup);
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
      const art = node('span','theme-art'); art.append(node('span','art-index',String(i + 1).padStart(2,'0')),icon(t.icon));
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
    $$('.theme-card').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.theme === theme)));
    $$('.mode-option').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.mode === mode)));
    $('#clash-options').hidden = theme !== 'clash'; $('#custom-options').hidden = theme !== 'custom'; $('#hint-setting').hidden = mode === 'undercover';
    $('#timer-setting').disabled = mode === 'blitz';
    setText('#custom-count', `${buildDeck('custom',{},$('#custom-words').value).length} UNTERSCHIEDLICHE BEGRIFFE`);
    const selectedTheme = themes.find(t => t.id === theme); const selectedMode = modes.find(m => m.id === mode);
    const imposters = Number($('#imposter-count').value);
    setText('#start-summary', `${selectedTheme.name} · ${selectedMode.name} · ${count} Personen · ${imposters} Imposter`);
    $('#setup-error').hidden = true;
  }
  function showView(id, focusSelector) {
    hideSecret(); $$('.view').forEach(el => { el.hidden = el.id !== id; });
    setText('#breadcrumb',id === 'setup-view' ? 'NEUE RUNDE' : id === 'result-view' ? 'AUFLÖSUNG' : 'RUNDE LÄUFT');
    window.scrollTo({top:0,behavior:'instant'});
    if (focusSelector) $(focusSelector).focus({preventScroll:true});
  }
  function openDialog(title, content, actions = []) {
    hideSecret(); setText('#dialog-title', title); $('#dialog-body').replaceChildren(); $('#dialog-actions').replaceChildren();
    if (typeof content === 'string') $('#dialog-body').append(node('p','',content)); else $('#dialog-body').append(content);
    for (const action of actions) { const button = node('button','button ' + (action.danger ? 'danger' : action.primary ? 'primary' : 'secondary'),action.label); button.addEventListener('click', () => { dialog.close(); if (action.run) action.run(); }); $('#dialog-actions').append(button); }
    if (!dialog.open) dialog.showModal();
  }
  function rules() {
    const content = node('div'); const steps = node('div','rules-steps');
    [['Welt und Gruppe wählen','Sucht euch eine Themenwelt aus. Tragt eure Namen ein und entscheidet, wie viele Imposter mitspielen.'],['Rollen geheim ansehen','Gebt das Gerät reihum weiter. Haltet eure Karte gedrückt und lasst los, bevor die nächste Person schaut.'],['Hinweise geben','Eine Person beginnt. Alle nennen reihum ein Wort oder einen kurzen Hinweis zum eigenen Begriff, ohne ihn zu verraten. Imposter müssen bluffen.'],['Gemeinsam entscheiden','Diskutiert euren Verdacht und stimmt in der Gruppe ab. Wählt die Person mit den meisten Stimmen aus und bestätigt den Ausschluss. Bei Gleichstand diskutiert weiter.']].forEach(([title,text],i)=>{const row=node('div','rule-step');const copy=node('div');copy.append(node('strong','',title),node('p','',text));row.append(node('span','step-number',String(i+1).padStart(2,'0')),copy);steps.append(row)});
    content.append(steps,node('p','','Das Team gewinnt, wenn alle Imposter gefunden sind. Die Imposter gewinnen, sobald sie mindestens so viele sind wie die übrigen Teammitglieder.'),node('p','','Undercover: Die Imposter sehen einen ähnlichen Begriff. Niemand erfährt vor der Auflösung die eigene Rolle. Blitzrunde: Ein Hinweis pro Person, dann nach 60 Sekunden abstimmen. Eigene Begriffe sind für die Person, die sie eingibt, natürlich bereits bekannt.'));
    openDialog('Einer blufft. Findet ihn.', content, [{label:'Alles klar. Los geht’s.',primary:true}]);
  }
  function startGame() {
    collectNames();
    const config = {names:names.slice(0,count).map((n,i) => n.trim() || `Person ${i+1}`),imposters:Number($('#imposter-count').value),mode,hints:$('#hints').checked,anonymous:$('#anonymous').checked,seconds:mode === 'blitz' ? 60 : Number($('#timer-setting').value)};
    try { const nextGame = new Game(config,deck(),{previousWord}); stopTimer(); game = nextGame; previousWord = game.entry.word; saveSetup(); renderTurn(); } catch (error) { setText('#setup-error',error.message); $('#setup-error').hidden = false; $('#setup-error').scrollIntoView({block:'center',behavior:'instant'}); }
  }
  function renderTurn() {
    const p = game.players[game.turn]; showView('reveal-view'); setText('#turn-title',p.name); $('#turn-title').style.color = colors[p.id];
    setText('#reveal-progress',`${game.turn + 1} / ${game.players.length}`); $('#next-player').disabled = true; $('#secret-card').setAttribute('aria-label',`${p.name}: gedrückt halten, um deinen Begriff anzusehen. Leertaste oder Enter ebenfalls gedrückt halten.`);
    $('#handoff-dots').replaceChildren(); game.players.forEach((_,i) => $('#handoff-dots').append(node('i',i < game.turn ? 'done' : i === game.turn ? 'current' : '')));
    $('#next-player').firstChild.textContent = game.turn === game.players.length-1 ? 'Alle bereit. Los geht’s.' : 'Gesehen. Weitergeben.';
    $('#turn-title').focus({preventScroll:true});
  }
  function revealSecret() {
    if (!game || game.phase !== 'reveal' || dialog.open || document.hidden) return;
    secretShown = true; const secret = game.secret(); const content = $('#secret-content'); content.replaceChildren(); content.classList.toggle('danger-card',secret.danger);
    content.append(node('span','secret-role',secret.role.toLocaleUpperCase('de')));
    const art = icon(secret.danger ? 'eye' : themes.find(t => t.id === theme).icon, 'secret-icon');
    if (secret.image) {
      const image = node('img'); image.alt = ''; image.src = secret.image; image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => image.replaceWith(art), {once:true}); content.append(image);
    } else content.append(art);
    content.append(node('strong','secret-word',secret.word));
    if (secret.hint) { const hint = node('span','secret-hint'); hint.append(node('small','','DEIN TIPP'),node('span','',secret.hint)); content.append(hint); }
    else content.append(node('span','secret-safe',mode === 'undercover' ? 'Niemand kennt die eigene Rolle.' : secret.danger ? 'Hör zu. Bluffe. Bleib unentdeckt.' : 'Verrate den Begriff nicht.'));
    content.hidden = false; $('#secret-cover').hidden = true; $('#secret-card').classList.add('revealed'); $('#next-player').disabled = false;
    setText('#accessible-reveal','Karte wieder verdecken');
  }
  function hideSecret() {
    secretShown = false; heldPointer = null; $('#secret-content').hidden = true; $('#secret-content').replaceChildren(); $('#secret-cover').hidden = false; $('#secret-card').classList.remove('revealed'); setText('#accessible-reveal','Karte per Klick anzeigen');
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
  function initials(name) { const parts = name.trim().split(/\s+/); const first = s => Array.from(s || '')[0] || '?'; return (first(parts[0])+(parts.length > 1 ? first(parts.at(-1)) : '')).toLocaleUpperCase('de'); }
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
    setText('#result-title',won ? 'GUT DURCHSCHAUT.' : 'GUT GEBLUFFT.'); setText('#result-subtitle',won ? 'Das Team gewinnt. Ihr habt alle Imposter gefunden.' : 'Die Imposter gewinnen. Sie sind jetzt mindestens so viele wie das übrige Team.');
    $('#result-emblem use').setAttribute('href',won ? '#shield' : '#eye'); $('#result-emblem').style.color = won ? 'var(--accent)' : 'var(--red)';
    setText('#result-word',game.entry.word); $('#alternate-recap').hidden = mode !== 'undercover'; setText('#alternate-recap',`Begriff der Imposter: ${game.entry.alternate || ''}`);
    $('#result-roster').replaceChildren(); game.players.forEach(p => { const row = node('div','result-person'); row.append(avatar(p),node('span','',p.name),node('span','role-tag' + (p.imposter ? ' imposter' : ''),p.imposter ? 'IMPOSTER' : 'TEAM')); $('#result-roster').append(row); }); $('#result-title').focus({preventScroll:true});
  }
  function returnToSetup() { stopTimer(); game = null; showView('setup-view','#party-title'); }
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
  $('#play-again').addEventListener('click',startGame); $('#new-setup').addEventListener('click',returnToSetup); $$('.exit-game').forEach(b=>b.addEventListener('click',askExit)); $('#nav-play').addEventListener('click',()=>{if(!game)$('#main').focus();else askExit()});
  $$('[data-help]').forEach(button=>button.addEventListener('click',rules)); $('#dialog-close').addEventListener('click',()=>dialog.close()); dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
  restoreSetup(); renderNames(); if(!$('#imposter-count').options.length)renderImposters(); renderThemes(); renderModes(); updateSelection();
})();
