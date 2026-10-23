const test = require('node:test');
const assert = require('node:assert/strict');
const {Game, validate, maxImposters, shuffle} = require('../assets/engine.js');
const {themes, modes, buildDeck} = require('../assets/data.js');
const config = (more = {}) => ({names:['Alex','Sam','Jo','Kim','Robin','Mika'],imposters:1,mode:'classic',hints:true,anonymous:false,seconds:180,...more});
const deck = buildDeck('everyday');
function deal(g) { while(g.phase === 'reveal') {g.secret();g.next();} }
function seeded(seed) {return () => {seed = (seed * 1664525 + 1013904223) >>> 0;return seed / 4294967296;};}

test('Every built-in theme has enough unique words and valid Undercover partners',()=>{
 assert.equal(themes.length,8);assert.equal(modes.length,3);
 for(const theme of themes.filter(t=>t.id!=='custom')) {
  const d=buildDeck(theme.id,{evo:true,champions:true,heroes:true});
  assert(d.length>=20,theme.id);assert.equal(new Set(d.map(c=>c.word)).size,d.length,theme.id);
  assert.equal(validate(config({mode:'undercover'}),d),'');
 }
 assert.equal(buildDeck('clash').length,80);
 assert.equal(buildDeck('clash',{evo:true,champions:true,heroes:true}).length,117);
});
test('Imposters always start in the minority and every role count is exact',()=>{
 for(let n=3;n<=12;n++)for(let k=1;k<=maxImposters(n);k++)for(let seed=1;seed<=20;seed++){
  const g=new Game(config({names:Array.from({length:n},(_,i)=>'Person '+i),imposters:k}),deck,{rng:seeded(seed)});
  assert.equal(g.players.filter(p=>p.imposter).length,k);assert(k<n-k);
 }
 assert.equal(maxImposters(4),1);assert.equal(maxImposters(12),5);
});
test('Invalid counts, duplicate names and invalid modes cannot start',()=>{
 assert(validate(config({names:['A','A','B']}),deck));assert(validate(config({names:['A','a','B']}),deck));
 assert(validate(config({names:['A','B']}),deck));assert(validate(config({imposters:3}),deck));
 assert(validate(config({names:['A'.repeat(29),'B','C']}),deck));assert(validate(config({mode:'invalid'}),deck));
 assert.throws(()=>new Game(config(),[]));
});
test('A player must see their role before handing over; completed reveals stay closed',()=>{
 const g=new Game(config(),deck);assert.equal(g.next(),false);g.secret();assert.equal(g.next(),true);assert.equal(g.turn,1);
 deal(g);assert.equal(g.phase,'discussion');assert.throws(()=>g.secret());assert.equal(g.next(),false);
});
test('Hints stay stable across repeated reveals and can be disabled',()=>{
 const g=new Game(config(),deck,{rng:seeded(2)});g.turn=g.players.findIndex(p=>p.imposter);const a=g.secret(),b=g.secret();assert.equal(a.hint,b.hint);assert(a.hint);assert.equal(a.word,'IMPOSTER');
 const silent=new Game(config({hints:false}),deck);silent.turn=silent.players.findIndex(p=>p.imposter);assert.equal(silent.secret().hint,'');
});
test('Undercover shows different terms without telling either side their role',()=>{
 const g=new Game(config({mode:'undercover'}),deck);const imp=g.players.findIndex(p=>p.imposter),team=g.players.findIndex(p=>!p.imposter);
 g.turn=imp;const a=g.secret();g.turn=team;const b=g.secret();assert.notEqual(a.word,b.word);assert.equal(a.role,b.role);assert.equal(a.hint,'');assert.equal(a.danger,false);
});
test('Group voting eliminates only once and correctly awards team victory',()=>{
 const g=new Game(config(),deck);assert.throws(()=>g.eject(0));deal(g);g.vote();const imp=g.players.find(p=>p.imposter);const result=g.eject(imp.id);assert.equal(result.winner,'team');assert.equal(g.phase,'result');assert.throws(()=>g.eject(imp.id));
});
test('Imposters win at parity and anonymous play does not reveal ejected roles',()=>{
 const g=new Game(config({names:['Alex','Jo','Sam'],anonymous:true}),deck);deal(g);g.vote();const team=g.players.find(p=>!p.imposter);const result=g.eject(team.id);assert.equal(result.winner,'imposters');assert.equal(result.imposter,null);
});
test('Ongoing rounds exclude dead players and rotate the starting person',()=>{
 const g=new Game(config({imposters:2}),deck);deal(g);const first=g.starter;g.vote();const imp=g.players.find(p=>p.imposter);const result=g.eject(imp.id);assert.equal(result.winner,null);g.discuss();assert(g.players[g.starter].alive);assert.notEqual(g.starter,first);g.vote();assert.throws(()=>g.eject(imp.id));
});
test('Rematches avoid the previous word',()=>{for(let i=0;i<20;i++){const g=new Game(config(),deck,{previousWord:deck[0].word,rng:seeded(i)});assert.notEqual(g.entry.word,deck[0].word)}});
test('Custom words are deduplicated, bounded, and require partners for Undercover',()=>{
 const custom='Pizza | Flammkuchen | Aus dem Ofen\nPizza | Test\nKaffee\nApfel\nBrot\nTee\nReis\n';
 const d=buildDeck('custom',{},custom);assert.equal(d.length,6);assert.equal(validate(config(),d),'');assert(validate(config({mode:'undercover'}),d));
 const pairDeck=buildDeck('custom',{},['A|B','B|C','C|D','D|E','E|F','F|G'].join('\n'));assert.equal(validate(config({mode:'undercover'}),pairDeck),'');
 assert.equal(buildDeck('custom',{},'x'.repeat(200))[0].word.length,60);
});
test('Shuffling does not mutate the original order',()=>{const source=[1,2,3,4];const result=shuffle(source,seeded(7));assert.deepEqual(source,[1,2,3,4]);assert.deepEqual([...result].sort(),source)});

test('All 117 Clash cards have local artwork with valid atlas coordinates',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const cards=buildDeck('clash',{evo:true,champions:true,heroes:true});
 for(const c of cards){assert(c.image&&typeof c.image==='object',c.word);assert(c.image.src.startsWith('assets/images/'));assert(fs.existsSync(path.join(__dirname,'..',c.image.src)));assert(c.image.x>=0&&c.image.x<c.image.cols);assert(c.image.y>=0&&c.image.y<c.image.rows);assert(c.alternateImage)}
 assert.equal(cards.filter(c=>c.image.basis).length,3);
});
test('Undercover uses the partner card illustration for imposters',()=>{
 const d=buildDeck('clash');const g=new Game(config({mode:'undercover'}),d);g.turn=g.players.findIndex(p=>p.imposter);assert.deepEqual(g.secret().image,g.entry.alternateImage);
});
test('All theme thumbnails are local and available',()=>{
 const {themeImages}=require('../assets/data.js');const fs=require('node:fs'),path=require('node:path');
 for(const t of themes){assert(themeImages[t.id]);assert(fs.existsSync(path.join(__dirname,'..',themeImages[t.id])),t.id)}
});

test('Every built-in theme term and Undercover partner has its own local picture',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const art=require('../assets/theme-art.js');
 let total=0;
 for(const [theme,pictures] of Object.entries(art)){
  const positions=new Set();
  for(const [word,pic] of Object.entries(pictures)){
   assert(fs.existsSync(path.join(__dirname,'..',pic.src)),`${theme}: ${word}`);
   assert(pic.x>=0&&pic.x<pic.cols&&pic.y>=0&&pic.y<pic.rows);
   const key=`${pic.x},${pic.y}`;assert(!positions.has(key),`${theme}: duplicate image cell`);positions.add(key);total++;
  }
  for(const entry of buildDeck(theme)){
   assert.deepEqual(entry.image,pictures[entry.word]);assert.deepEqual(entry.alternateImage,pictures[entry.alternate]);
   assert(entry.image&&entry.alternateImage);
  }
  const game=new Game(config({mode:'undercover'}),buildDeck(theme));
  game.turn=game.players.findIndex(p=>p.imposter);assert.deepEqual(game.secret().image,pictures[game.entry.alternate]);
 }
 assert.equal(total,239);
});
