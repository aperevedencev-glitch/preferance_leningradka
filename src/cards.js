/* ===== Карты, торговля, розыгрыш и простые боты ===== */
const CARDS = (() => {
  const SUITS = ["♠", "♣", "♦", "♥"];
  const RANKS = ["7", "8", "9", "10", "В", "Д", "К", "Т"]; // валет, дама, король, туз
  const deck = () => SUITS.flatMap((s) => RANKS.map((r, i) => ({ s, r, v: i + 7, id: s + r })));
  function shuffle(a, rnd = Math.random) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const sortHand = (h) => h.sort((a, b) => (a.s === b.s ? b.v - a.v : SUITS.indexOf(a.s) - SUITS.indexOf(b.s)));

  // раздача трём активным игрокам: по 2 карты, прикуп после второго круга
  function deal(rnd) {
    const d = shuffle(deck(), rnd);
    const hands = [[], [], []], prikup = [];
    let k = 0;
    for (let round = 0; round < 5; round++) {
      for (let p = 0; p < 3; p++) hands[p].push(d[k++], d[k++]);
      if (round === 0) prikup.push(d[k++], d[k++]);
    }
    hands.forEach(sortHand);
    return { hands, prikup };
  }

  const bySuit = (h, s) => h.filter((c) => c.s === s);

  // какие карты можно положить: в масть, иначе козырь, иначе любую
  function legal(hand, trick, trump) {
    if (!trick.length) return hand;
    const lead = trick[0].card.s;
    const f = bySuit(hand, lead);
    if (f.length) return f;
    if (trump) { const t = bySuit(hand, trump); if (t.length) return t; }
    return hand;
  }

  function winner(trick, trump) {
    const lead = trick[0].card.s;
    let best = trick[0];
    for (const x of trick.slice(1)) {
      const c = x.card, b = best.card;
      if (c.s === b.s ? c.v > b.v : trump && c.s === trump) best = x;
    }
    return best.who;
  }

  /* ---------- оценки рук ---------- */
  // ожидаемые взятки при козыре s (null — бескозырка), рука из 10 или 12 карт
  function estimate(hand, trump) {
    let t = 0;
    for (const s of SUITS) {
      const cs = bySuit(hand, s).sort((a, b) => b.v - a.v);
      const n = cs.length;
      if (!n) continue;
      const has = (v) => cs.some((c) => c.v === v);
      if (s === trump) {
        let honors = 0;
        if (has(14)) honors++;
        if (has(13) && n >= 2) honors += has(14) ? 1 : 0.7;
        if (has(12) && n >= 3) honors += has(14) && has(13) ? 1 : 0.5;
        t += Math.max(honors, 0) + Math.max(0, n - 3);
      } else {
        // старшие в боковой масти
        let run = 0;
        for (let v = 14; v >= 7; v--) { if (has(v)) run++; else break; }
        let side = Math.min(run, n);
        if (!run && has(13) && n >= 2) side += 0.5;
        if (!trump && run >= 3) side += Math.max(0, n - run); // длинная масть в бескозырке
        t += side;
      }
    }
    return t;
  }

  function bestContract(hand) {
    let best = { trump: null, est: estimate(hand, null), suit: "БК" };
    for (const s of SUITS) { const e = estimate(hand, s); if (e > best.est + 0.01) best = { trump: s, est: e, suit: s }; }
    return best;
  }

  // годится ли рука на мизер: в каждой масти младшие карты без «дыр»
  function misereSafe(hand) {
    for (const s of SUITS) {
      const cs = bySuit(hand, s).map((c) => c.v).sort((a, b) => a - b);
      if (!cs.length) continue;
      // взяток не будет, если k-я младшая карта не выше 7+2k (7, 9, J…)
      for (let k = 0; k < cs.length; k++) if (cs[k] > 7 + 2 * k) return false;
    }
    return true;
  }

  // ставка бота: строка контракта или null (пас)
  function botBid(hand, current, canMisere, minLevel = 6) {
    if (canMisere && misereSafe(hand) && contractRank(current) < contractRank("мизер")) return "мизер";
    const b = bestContract(hand);
    const level = Math.min(10, Math.floor(b.est + 1.5)); // с учётом прикупа
    if (level < minLevel) return null;
    const order = CONTRACTS.filter((c) => c !== "мизер");
    // минимальная ставка выше текущей в пределах уровня
    for (const c of order) {
      if (contractRank(c) <= contractRank(current) || parseInt(c) < minLevel) continue;
      if (parseInt(c) > level) break;
      return c;
    }
    return null;
  }

  const CONTRACTS = (() => { const c = []; for (const l of [6, 7, 8]) for (const s of [...SUITS, "БК"]) c.push(l + s); c.push("мизер"); for (const l of [9, 10]) for (const s of [...SUITS, "БК"]) c.push(l + s); return c; })();
  const contractRank = (c) => (c ? CONTRACTS.indexOf(c) : -1);

  // снос: оставить 10 карт, лучших под игру (или под мизер — самые старшие сносим)
  function botDiscard(hand12, misere) {
    const h = [...hand12];
    if (misere) return h.sort((a, b) => b.v - a.v).slice(0, 2);
    const { trump } = bestContract(h);
    // перебор пар — максимум оценки
    let best = null, bestE = -1;
    for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) {
      const rest = h.filter((_, k) => k !== i && k !== j);
      const e = estimate(rest, trump);
      if (e > bestE) { bestE = e; best = [h[i], h[j]]; }
    }
    return best;
  }

  function botDeclare(hand10, minBid) {
    const b = bestContract(hand10);
    const lvl = Math.max(parseInt(minBid), Math.min(10, Math.floor(b.est + 0.2)));
    let c = lvl + b.suit;
    if (contractRank(c) < contractRank(minBid)) c = minBid;
    return c;
  }

  // оценка взяток защитника против козыря
  function defenseEstimate(hand, trump) {
    let t = 0;
    for (const s of SUITS) {
      const cs = bySuit(hand, s);
      const has = (v) => cs.some((c) => c.v === v);
      if (s === trump) { t += cs.length >= 4 ? 1 : 0; if (has(14)) t += 1; if (has(13) && cs.length >= 2) t += 0.6; }
      else { if (has(14)) t += 1; if (has(13) && cs.length >= 2) t += 0.5; }
    }
    return t;
  }

  /* ---------- ход бота ---------- */
  // role: 'declarer' | 'defender' | 'misere' (играет мизер) | 'catch' (ловит мизер) | 'raspas'
  function botPlay(hand, trick, trump, role, partnerOf, me) {
    const opts = legal(hand, trick, trump).slice().sort((a, b) => a.v - b.v);
    const low = opts[0], high = opts[opts.length - 1];
    const avoid = role === "misere" || role === "raspas";
    if (!trick.length) {
      if (avoid) return low;
      if (role === "catch") return low;
      // ведём тузом/старшей бокой, иначе младшей картой самой длинной масти
      const aces = opts.filter((c) => c.v === 14 && c.s !== trump);
      if (aces.length) return aces[0];
      if (role === "declarer" && trump) { const t = opts.filter((c) => c.s === trump); if (t.length >= 3) return t[t.length - 1]; }
      const counts = {}; opts.forEach((c) => counts[c.s] = (counts[c.s] || 0) + 1);
      const longest = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      return opts.filter((c) => c.s === longest)[0];
    }
    const cur = winner(trick, trump);
    const curCard = trick.find((x) => x.who === cur).card;
    const beats = (c) => (c.s === curCard.s ? c.v > curCard.v : trump && c.s === trump && curCard.s !== trump);
    if (avoid) {
      // самая старшая карта, которая не берёт; если не выходит — самая младшая
      const under = opts.filter((c) => !beats(c));
      return under.length ? under[under.length - 1] : (trick.length === 2 ? high : low);
    }
    if (role === "catch") {
      // заставить играющего взять: класть младшие, не перебивая его
      const under = opts.filter((c) => !beats(c));
      return under.length ? under[0] : low;
    }
    const partnerWins = partnerOf && partnerOf(cur, me);
    if (partnerWins) return low;
    const winning = opts.filter(beats);
    if (winning.length) return winning[0];
    return low;
  }

  return { SUITS, RANKS, deck, shuffle, deal, sortHand, legal, winner, estimate, bestContract, misereSafe, botBid, botDiscard, botDeclare, defenseEstimate, botPlay, CONTRACTS, contractRank };
})();
if (typeof module !== "undefined") module.exports = CARDS;
