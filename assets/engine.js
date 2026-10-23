(function (root) {
  'use strict';
  function random() {
    if (root.crypto && root.crypto.getRandomValues) {
      return root.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    }
    return Math.random();
  }
  function shuffle(items, rng = random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function maxImposters(count) { return Math.floor((count - 1) / 2); }
  function validate(config, deck) {
    if (!Array.isArray(config.names) || config.names.length < 3 || config.names.length > 12) return 'Wählt zwischen 3 und 12 Personen.';
    const names = config.names.map(n => String(n).trim().toLocaleLowerCase('de'));
    if (names.some(n => !n || n.length > 28)) return 'Jeder Name braucht 1 bis 28 Zeichen.';
    if (new Set(names).size !== names.length) return 'Verwendet unterschiedliche Namen, damit die Abstimmung eindeutig bleibt.';
    if (!Number.isInteger(config.imposters) || config.imposters < 1 || config.imposters > maxImposters(names.length)) return 'Die Imposter müssen zu Beginn in der Minderheit sein.';
    if (!['classic', 'undercover', 'blitz'].includes(config.mode)) return 'Wählt einen gültigen Spielmodus.';
    if (!Array.isArray(deck) || deck.length < 6) return 'Ihr braucht mindestens 6 unterschiedliche Begriffe.';
    if (config.mode === 'undercover' && deck.some(c => !c.alternate || c.word.toLocaleLowerCase('de') === c.alternate.toLocaleLowerCase('de'))) return 'Für Undercover braucht jeder Begriff einen anderen, ähnlichen Partnerbegriff.';
    return '';
  }
  class Game {
    constructor(config, deck, {rng = random, previousWord = ''} = {}) {
      const error = validate(config, deck);
      if (error) throw new Error(error);
      this.config = {...config, names: [...config.names]};
      this.rng = rng;
      const fresh = deck.filter(c => c.word !== previousWord);
      const pool = fresh.length ? fresh : deck;
      this.entry = pool[Math.floor(rng() * pool.length)];
      const roles = shuffle(config.names.map((_, i) => i < config.imposters), rng);
      this.players = config.names.map((name, i) => ({id: i, name, imposter: roles[i], alive: true, hint: this.entry.hints?.length ? this.entry.hints[Math.floor(rng() * this.entry.hints.length)] : ''}));
      this.phase = 'reveal';
      this.turn = 0;
      this.seen = new Set();
      this.round = 1;
      this.lastStarter = -1;
      this.winner = null;
    }
    secret() {
      if (this.phase !== 'reveal') throw new Error('Die Rollenverteilung ist abgeschlossen.');
      const player = this.players[this.turn];
      this.seen.add(player.id);
      const undercover = this.config.mode === 'undercover';
      return {name: player.name, role: undercover ? 'Dein Begriff' : player.imposter ? 'Du bist Imposter' : 'Du gehörst zum Team', word: player.imposter ? (undercover ? this.entry.alternate : 'IMPOSTER') : this.entry.word, hint: !undercover && player.imposter && this.config.hints ? player.hint : '', image: !player.imposter ? this.entry.image : '', danger: !undercover && player.imposter};
    }
    next() {
      if (this.phase !== 'reveal' || !this.seen.has(this.turn)) return false;
      if (this.turn < this.players.length - 1) { this.turn++; return true; }
      this.discuss();
      return true;
    }
    discuss() {
      if (!['reveal', 'ejected', 'vote', 'discussion'].includes(this.phase)) throw new Error('Diese Runde ist vorbei.');
      this.phase = 'discussion';
      const alive = this.players.filter(p => p.alive);
      const pool = alive.filter(p => p.id !== this.lastStarter);
      const candidates = pool.length ? pool : alive;
      this.starter = candidates[Math.floor(this.rng() * candidates.length)].id;
      this.lastStarter = this.starter;
    }
    vote() { if (this.phase === 'discussion') this.phase = 'vote'; }
    eject(id) {
      if (this.phase !== 'vote') throw new Error('Ihr seid gerade nicht in der Abstimmung.');
      const player = this.players.find(p => p.id === id && p.alive);
      if (!player) throw new Error('Diese Person ist nicht mehr im Spiel.');
      player.alive = false;
      const imposters = this.players.filter(p => p.alive && p.imposter).length;
      const team = this.players.filter(p => p.alive && !p.imposter).length;
      this.winner = imposters === 0 ? 'team' : imposters >= team ? 'imposters' : null;
      this.phase = this.winner ? 'result' : 'ejected';
      this.round++;
      return {name: player.name, imposter: this.config.anonymous ? null : player.imposter, winner: this.winner};
    }
    get alive() { return this.players.filter(p => p.alive); }
  }
  const api = {Game, validate, maxImposters, shuffle};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ImposterEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
