/* ===== Движок записи пули: Ленинградка =====
   Чистые функции без DOM. Используется и трекером, и игрой.
   Единицы: пуля и гора — в очках, висты — в вистах. */
const PREF = (() => {
  const DEFAULT_RULES = {
    name: "Ленинградка",
    cost: { 6: 2, 7: 4, 8: 6, 9: 8, 10: 10 }, // в пулю за сыгранную игру
    misere: 10,                // в пулю за сыгранный мизер
    whistMult: 2,              // вист за взятку = стоимость × 2
    goraMult: 2,               // гора играющему за недобор = стоимость × 2 за взятку
    consolationMult: 2,        // консоляция каждому защитнику = стоимость × 2 за недобор
    misereGoraPerTrick: 20,    // гора за каждую взятку на мизере
    whistNeed: { 6: 4, 7: 2, 8: 1, 9: 1, 10: 0 }, // обязательные взятки вистующих
    whistPenaltyMult: 1,       // полуответственный вист: гора вистующему = стоимость × 1 за недобор
    halfWhistLevels: [6, 7],   // где разрешён полвиста
    raspasBase: 2,             // распасы: гора за взятку = 2, 4, 6…
    raspasMaxStep: 3,          // прогрессия до 3-й ступени
    raspasZeroBonus: 1,        // в пулю за 0 взяток на распасах (× ступень)
    raspasExit: [7, 8, 6],     // выход из 1-х, 2-х, 3-х распасов подряд: минимальная игра
    raspasCycle: 3,            // после стольких распасов подряд счёт начинается заново
    poolToGora: 2,             // очко пули = 2 очка горы при расчёте
    whistPerGora: 10,          // очко горы = 10 вистов
    poolTarget: 20,            // пуля каждому
  };

  const SUITS = ["♠", "♣", "♦", "♥"];
  const CONTRACTS = [];
  for (const l of [6, 7, 8]) for (const s of [...SUITS, "БК"]) CONTRACTS.push(l + s);
  CONTRACTS.push("мизер");
  for (const l of [9, 10]) for (const s of [...SUITS, "БК"]) CONTRACTS.push(l + s);
  const contractRank = (c) => CONTRACTS.indexOf(c);
  const levelOf = (c) => (c === "мизер" ? 0 : parseInt(c, 10));
  const trumpOf = (c) => (c === "мизер" ? null : c.replace(/^\d+/, "") === "БК" ? null : c.replace(/^\d+/, ""));

  // номер распасов подряд, если и эта сдача уйдёт в распасы (после цикла — снова 1-е)
  function nextRaspas(p) {
    const c = p.rules.raspasCycle || 3;
    return p.raspasStep >= c ? 1 : p.raspasStep + 1;
  }

  // минимальная игра в этой сдаче: выход из распасов (после игры — 6)
  function exitLevel(p) {
    const ex = p.rules.raspasExit || [6, 6, 6];
    return p.raspasStep > 0 ? ex[Math.min(p.raspasStep, ex.length) - 1] : 6;
  }

  function newPulka(names, rules = DEFAULT_RULES) {
    const n = names.length;
    return {
      rules: { ...DEFAULT_RULES, ...rules },
      players: names.map((name) => ({ name, pool: 0, gora: 0, whists: Array(n).fill(0) })),
      hands: [],          // история записей (для отмены)
      raspasStep: 0,      // сколько распасов подряд
      dealer: 0,
      closed: false,
    };
  }

  // активные игроки раздачи (при 4-х сдающий не играет), по кругу слева от сдающего
  function activeOrder(p) {
    const n = p.players.length;
    const order = [];
    for (let k = 1; k <= n; k++) {
      const i = (p.dealer + k) % n;
      if (n === 4 && i === p.dealer) continue;
      order.push(i);
    }
    return n === 4 ? order.slice(0, 3) : order;
  }

  // защитники в порядке хода: первый — слева от играющего (среди активных)
  function defendersOf(p, declarer) {
    const act = activeOrder(p);
    const k = act.indexOf(declarer);
    return [act[(k + 1) % 3], act[(k + 2) % 3]];
  }

  /* Запись раздачи. Возвращает список изменений (delta), не меняя p.
     h = { type:'game', declarer, contract, whist:{ first:'whist'|'pass', second:'whist'|'pass'|'half', returned:bool },
           tricks:{ [idx]: n } }  — взятки играющего и вистующих (для джентльменского виста — все взятки защиты у вистующего)
     h = { type:'misere', declarer, tricks:n }
     h = { type:'raspas', tricks:{ [idx]: n } } */
  function score(p, h) {
    const R = p.rules;
    const n = p.players.length;
    const d = { pool: Array(n).fill(0), gora: Array(n).fill(0), whists: Array.from({ length: n }, () => Array(n).fill(0)), notes: [], raspasStep: 0 };
    const w = (from, to, v, why) => { if (v) { d.whists[from][to] += v; d.notes.push(`${p.players[from].name} → ${p.players[to].name}: ${v} вист. (${why})`); } };
    const name = (i) => p.players[i].name;

    if (h.type === "raspas") {
      d.raspasStep = nextRaspas(p);
      const step = Math.min(d.raspasStep, R.raspasMaxStep);
      const act = activeOrder(p);
      for (const [i, t] of Object.entries(h.tricks)) {
        if (!act.includes(Number(i)) && !(t > 0)) continue; // сдающий вчетвером: только гора за взятки из прикупа
        if (t > 0) { d.gora[i] += t * R.raspasBase * step; d.notes.push(`${name(i)}: ${t} взят. на распасах → гора +${t * R.raspasBase * step}`); }
        else if (R.raspasZeroBonus) { d.pool[i] += R.raspasZeroBonus * step; d.notes.push(`${name(i)}: ни одной взятки → пуля +${R.raspasZeroBonus * step}`); }
      }
      return d;
    }

    if (h.type === "misere") {
      const t = h.tricks;
      if (t === 0) { d.pool[h.declarer] += R.misere; d.notes.push(`${name(h.declarer)}: мизер сыгран → пуля +${R.misere}`); }
      else { d.gora[h.declarer] += t * R.misereGoraPerTrick; d.notes.push(`${name(h.declarer)}: мизер, ${t} взят. → гора +${t * R.misereGoraPerTrick}`); }
      return d;
    }

    // обычная игра
    const lvl = levelOf(h.contract);
    const ex = exitLevel(p);
    if (lvl < ex) throw new Error(`Выход из распасов: игра не ниже ${ex}-й`);
    const cost = R.cost[lvl];
    const decl = h.declarer;
    const [a, b] = defendersOf(p, decl);
    const W = h.whist || {};
    const wpt = cost * R.whistMult;
    const need = R.whistNeed[lvl];

    // кто вистует
    let whisters = [];
    let halfWhist = false;
    if (W.first === "whist" && W.second === "whist") whisters = [a, b];
    else if (W.first === "whist") whisters = [a];
    else if (W.second === "whist") whisters = [b];
    else if (W.second === "half") {
      if (!R.halfWhistLevels.includes(lvl)) throw new Error(`Полвиста на ${lvl}-й игре не допускается`);
      if (W.returned) whisters = [a]; // первый вернул вист — он вистует, второй становится пасующим
      else halfWhist = true;
    }

    if (whisters.length === 0) {
      d.pool[decl] += cost;
      d.notes.push(`${name(decl)}: ${h.contract} без виста → пуля +${cost}`);
      if (halfWhist) {
        const v = (need / 2) * wpt;
        w(b, decl, v, "полвиста");
      }
      return d;
    }

    const dt = Number(h.tricks[decl]);
    const defTricks = 10 - dt;
    const made = dt >= lvl;
    if (made) { d.pool[decl] += cost; d.notes.push(`${name(decl)}: ${h.contract} сыграна → пуля +${cost}`); }
    else {
      const short = lvl - dt;
      d.gora[decl] += short * cost * R.goraMult;
      d.notes.push(`${name(decl)}: недобор ${short} → гора +${short * cost * R.goraMult}`);
      // консоляция обоим защитникам
      for (const x of [a, b]) w(x, decl, short * cost * R.consolationMult, "консоляция");
    }

    if (whisters.length === 2) {
      const ta = Number(h.tricks[a]), tb = Number(h.tricks[b]);
      if (ta + tb !== defTricks) throw new Error(`У вистующих должно быть ${defTricks} взят. в сумме`);
      w(a, decl, ta * wpt, `${ta} взят.`);
      w(b, decl, tb * wpt, `${tb} взят.`);
      // полуответственный вист: каждый отвечает за половину обязательных взяток
      if (made && ta + tb < need) {
        for (const [x, t] of [[a, ta], [b, tb]]) {
          const s = Math.max(0, need / 2 - t);
          if (s) { d.gora[x] += s * cost * R.whistPenaltyMult; d.notes.push(`${name(x)}: недобор на висте ${s} → гора +${s * cost * R.whistPenaltyMult}`); }
        }
      }
    } else {
      const x = whisters[0];
      const passer = x === a ? b : a;
      if (!made) {
        // джентльменский вист: при ремизе висты за взятки делятся пополам с пасующим
        w(x, decl, (defTricks * wpt) / 2, `${defTricks} взят. защиты, половина`);
        w(passer, decl, (defTricks * wpt) / 2, `${defTricks} взят. защиты, половина`);
      } else {
        w(x, decl, defTricks * wpt, `${defTricks} взят. защиты`);
        const s = Math.max(0, need - defTricks);
        if (s) { d.gora[x] += s * cost * R.whistPenaltyMult; d.notes.push(`${name(x)}: недобор на висте ${s} → гора +${s * cost * R.whistPenaltyMult}`); }
      }
    }
    return d;
  }

  function apply(p, h) {
    const d = score(p, h);
    const before = JSON.parse(JSON.stringify({ players: p.players, raspasStep: p.raspasStep, dealer: p.dealer, closed: p.closed }));
    p.players.forEach((pl, i) => {
      pl.pool += d.pool[i]; pl.gora += d.gora[i];
      pl.whists = pl.whists.map((v, j) => v + d.whists[i][j]);
    });
    p.raspasStep = h.type === "raspas" ? d.raspasStep : 0;
    p.dealer = (p.dealer + 1) % p.players.length;
    p.hands.push({ h, d, before, at: Date.now() });
    if (isFinished(p)) p.closed = true;
    return d;
  }

  function undo(p) {
    const last = p.hands.pop();
    if (!last) return false;
    Object.assign(p, { players: last.before.players, raspasStep: last.before.raspasStep, dealer: last.before.dealer, closed: last.before.closed });
    return true;
  }

  // пуля закрыта, когда сумма пуль достигла n × цель
  function isFinished(p) {
    const T = p.rules.poolTarget;
    return p.players.reduce((s, pl) => s + pl.pool, 0) >= T * p.players.length;
  }

  // итоговый расчёт в вистах (сумма по всем = 0)
  function settle(p) {
    const R = p.rules, n = p.players.length;
    const geff = p.players.map((pl) => pl.gora + R.poolToGora * (R.poolTarget - pl.pool));
    const sumG = geff.reduce((a, b) => a + b, 0);
    return p.players.map((pl, i) => {
      let s = 0;
      for (let j = 0; j < n; j++) if (j !== i) s += p.players[i].whists[j] - p.players[j].whists[i];
      s += (R.whistPerGora * (sumG - n * geff[i])) / n;
      return { name: pl.name, total: Math.round(s * 100) / 100, gora: geff[i] };
    });
  }

  // рейтинг Эло по итогам пульки
  function updateRatings(ratings, result, K = 24) {
    const n = result.length;
    const r = (name) => (ratings[name] ??= { rating: 1500, pulkas: 0, wins: 0, best: null, sum: 0 });
    const delta = Object.fromEntries(result.map((x) => [x.name, 0]));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const A = r(result[i].name), B = r(result[j].name);
      const ea = 1 / (1 + 10 ** ((B.rating - A.rating) / 400));
      const sa = result[i].total > result[j].total ? 1 : result[i].total < result[j].total ? 0 : 0.5;
      const k = K / (n - 1);
      delta[result[i].name] += k * (sa - ea);
      delta[result[j].name] += k * (ea - sa);
    }
    const top = Math.max(...result.map((x) => x.total));
    for (const x of result) {
      const s = r(x.name);
      s.rating = Math.round(s.rating + delta[x.name]);
      s.pulkas++; s.sum += x.total;
      if (x.total === top) s.wins++;
      if (s.best === null || x.total > s.best) s.best = x.total;
    }
    return delta;
  }

  /* Инструкция «Правила распасов» (HTML) — по текущим ставкам пульки */
  function raspasRulesHTML(R = DEFAULT_RULES) {
    const ex = R.raspasExit || [7, 8, 6], cyc = R.raspasCycle || 3, base = R.raspasBase, mx = R.raspasMaxStep;
    const g = (k) => base * Math.min(k, mx);
    const ord = ["первых", "вторых", "третьих", "четвёртых", "пятых"];
    const exRows = [`<tr><td>После сыгранной игры или мизера</td><td class="n">—</td><td class="n"><b>6-я</b></td></tr>`]
      .concat(Array.from({ length: cyc }, (_, i) => `<tr><td>После ${ord[i] || i + 1 + "-х"} распасов${i ? " подряд" : ""}</td><td class="n">${g(i + 1)}</td><td class="n"><b>${ex[Math.min(i, ex.length - 1)]}-я</b>${i === cyc - 1 ? "<br><span class=\"sub\">автоматически</span>" : ""}</td></tr>`));
    // пример цепочки сдач
    const seq = ["распасы", "распасы", "распасы", "распасы", "игра", "распасы", "мизер"];
    let st = 0;
    const exRow = seq.map((t, k) => {
      const lvl = st > 0 ? ex[Math.min(st, ex.length) - 1] : 6;
      const next = t === "распасы" ? (st >= cyc ? 1 : st + 1) : 0;
      const row = `<tr><td class="n">${k + 1}</td><td class="n">${lvl}-я</td><td>${t}</td><td class="n">${t === "распасы" ? g(next) : "—"}</td><td class="n">${next}</td></tr>`;
      st = next; return row;
    }).join("");
    return `<h2>Правила распасов</h2>
<ol class="rr">
  <li><b>Когда.</b> Если в торговле спасовали все трое, сдача играется на распасах. Вчетвером сдающий не получает карт и не торгуется.</li>
  <li><b>Как играть.</b> Каждый играет сам за себя и старается взять как можно меньше взяток. Козыря нет: ходят в масть, а если масти нет — любой картой.</li>
  <li><b>Ходы из прикупа.</b> Первые две взятки играются «из прикупа»: карты прикупа открывают по одной, каждая задаёт масть своей взятки. Первым бьёт игрок, сидящий после сдающего, за ним остальные по кругу; масть прикупа обязательна, если она есть на руке.
    <ul>
      <li><b>Втроём</b> карта прикупа только показывает масть: взятку берёт старшая карта этой масти у игроков.</li>
      <li><b>Вчетвером</b> карта прикупа — карта сдающего во взятке. Если она старше карт игроков, взятка пишется сдающему (в гору, как обычная взятка на распасах).</li>
    </ul>
    С третьей взятки ходит тот, кто взял вторую; если её взял сдающий — игрок после него.</li>
  <li><b>Запись.</b> Каждая взятка пишется в гору по ${base} × ступень распасов. Игрок, не взявший ни одной взятки, получает ${R.raspasZeroBonus} × ступень в пулю (сдающему вчетвером эта премия не положена).</li>
  <li><b>Ступень</b> — какие по счёту распасы подряд: первые — ${g(1)} за взятку, вторые — ${g(2)}, третьи — ${g(3)}${mx < 3 ? " (прогрессия ограничена " + mx + "-й ступенью)" : ""}.</li>
  <li><b>Выход из распасов.</b> В сдаче после распасов играть можно только игру не ниже указанной в таблице. Торговля начинается с этой игры; ниже заявить и записать нельзя.</li>
</ol>
<div class="tw rt"><table><thead><tr><th>Ситуация</th><th class="n">Гора за взятку</th><th class="n">Следующая игра не ниже</th></tr></thead><tbody>${exRows.join("")}</tbody></table></div>
<ol class="rr" start="7">
  <li><b>Сброс счёта.</b> После сыгранной игры или мизера счёт распасов обнуляется. После ${ord[cyc - 1] || cyc + "-х"} распасов подряд выход автоматический — обычная торговля с 6-й, а если и эта сдача уйдёт в распасы, они снова считаются первыми.</li>
  <li><b>Мизер</b> можно заявить при любом выходе: по старшинству он выше любой 8-й игры.</li>
  <li>Если при выходе все снова спасуют — снова распасы, и счёт распасов подряд продолжается.</li>
</ol>
<h3>Пример</h3>
<div class="tw rt"><table><thead><tr><th class="n">Сдача</th><th class="n">Игра не ниже</th><th>Исход</th><th class="n">Гора за взятку</th><th class="n">Распасов подряд</th></tr></thead><tbody>${exRow}</tbody></table></div>`;
  }

  return { DEFAULT_RULES, raspasRulesHTML, SUITS, CONTRACTS, contractRank, levelOf, trumpOf, newPulka, activeOrder, defendersOf, exitLevel, nextRaspas, score, apply, undo, isFinished, settle, updateRatings };
})();
if (typeof module !== "undefined") module.exports = PREF;
