const STORAGE_KEY = "runnyarsGokigenDashSave";

const BASE_STATS = {
  speed: 30,
  stamina: 30,
  guts: 30
};

const MOOD_LABELS = {
  "-2": "絶不調",
  "-1": "不調",
  "0": "ふつう",
  "1": "好調",
  "2": "絶好調"
};

const ACTIONS = [
  {
    id: "dash",
    name: "ダッシュあそび",
    detail: "すばやさ +5 / つかれ +15",
    stat: "speed",
    statAmount: 5,
    fatigueAmount: 15
  },
  {
    id: "walk",
    name: "おさんぽ",
    detail: "たいりょく +5 / つかれ +15",
    stat: "stamina",
    statAmount: 5,
    fatigueAmount: 15
  },
  {
    id: "play",
    name: "じゃれあい",
    detail: "きあい +5 / つかれ +15",
    stat: "guts",
    statAmount: 5,
    fatigueAmount: 15
  },
  {
    id: "nap",
    name: "おひるね",
    detail: "つかれ -30",
    stat: null,
    statAmount: 0,
    fatigueAmount: -30
  }
];

const RACES = {
  3: {
    name: "こねこスプリント",
    distanceType: "短距離",
    speedRate: 0.7,
    staminaRate: 0.3
  },
  6: {
    name: "まちかどキャットレース",
    distanceType: "中距離",
    speedRate: 0.5,
    staminaRate: 0.5
  },
  9: {
    name: "夕やけねこかけっこ",
    distanceType: "中距離",
    speedRate: 0.5,
    staminaRate: 0.5
  },
  12: {
    name: "ぐるっと公園レース",
    distanceType: "長距離",
    speedRate: 0.3,
    staminaRate: 0.7
  }
};

const app = document.querySelector("#app");

let gameState = createFreshState();

function createFreshState() {
  return {
    player: {
      totalGraduates: 0,
      totalRaces: 0,
      totalWins: 0,
      totalNiboshi: 0
    },
    runnyarCount: 1,
    supportBonus: {
      speed: 0,
      stamina: 0,
      guts: 0
    },
    records: {
      bestNiboshi: 0,
      bestWins: 0
    },
    currentRunnyar: null,
    lastRaceResult: null,
    lastGraduation: null
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function saveGame() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
}

function loadGame() {
  const savedText = localStorage.getItem(STORAGE_KEY);

  if (!savedText) {
    return null;
  }

  try {
    const saved = JSON.parse(savedText);
    const normalized = {
      ...saved,
      runnyarCount: saved.runnyarCount ?? saved.runnerCount,
      currentRunnyar: saved.currentRunnyar ?? saved.currentRunner,
      lastGraduation: saved.lastGraduation
        ? {
            ...saved.lastGraduation,
            runnyar: saved.lastGraduation.runnyar ?? saved.lastGraduation.runner
          }
        : null
    };

    return {
      ...createFreshState(),
      ...normalized,
      supportBonus: {
        ...createFreshState().supportBonus,
        ...normalized.supportBonus
      },
      player: {
        ...createFreshState().player,
        ...normalized.player
      },
      records: {
        ...createFreshState().records,
        ...normalized.records
      }
    };
  } catch (error) {
    console.warn("保存データの読み込みに失敗しました。", error);
    return null;
  }
}

function resetGameData() {
  const ok = confirm("保存データをすべてリセットしますか？");
  if (!ok) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  gameState = createFreshState();
  showTitleScreen("データをリセットしました。");
}

function startNewGame() {
  const ok = !localStorage.getItem(STORAGE_KEY) || confirm("現在の保存データを消して、はじめから遊びますか？");
  if (!ok) {
    return;
  }

  gameState = createFreshState();
  saveGame();
  showCreateRunnyarScreen();
}

function continueGame() {
  const saved = loadGame();

  if (!saved) {
    showTitleScreen("保存データがありません。はじめから育ててみましょう。");
    return;
  }

  gameState = saved;

  if (gameState.currentRunnyar) {
    showTrainingScreen();
    return;
  }

  showCreateRunnyarScreen();
}

function createRunnyar(name) {
  const trimmedName = name.trim() || `らんにゃー${gameState.runnyarCount}号`;

  gameState.currentRunnyar = {
    name: trimmedName,
    generation: gameState.runnyarCount,
    turn: 1,
    speed: clamp(BASE_STATS.speed + gameState.supportBonus.speed, 1, 100),
    stamina: clamp(BASE_STATS.stamina + gameState.supportBonus.stamina, 1, 100),
    guts: clamp(BASE_STATS.guts + gameState.supportBonus.guts, 1, 100),
    mood: 0,
    fatigue: 0,
    totalNiboshi: 0,
    raceCount: 0,
    winCount: 0,
    raceHistory: []
  };
  gameState.lastRaceResult = null;
  gameState.lastGraduation = null;
  saveGame();
  showTrainingScreen();
}

function applyAction(actionId) {
  const action = ACTIONS.find((item) => item.id === actionId);
  const runnyar = gameState.currentRunnyar;

  if (!action || !runnyar) {
    return;
  }

  if (action.stat) {
    runnyar[action.stat] = clamp(runnyar[action.stat] + action.statAmount, 1, 100);
  }

  runnyar.fatigue = clamp(runnyar.fatigue + action.fatigueAmount, 0, 100);
  runnyar.mood = clamp(runnyar.mood + rollMoodChange(runnyar.fatigue), -2, 2);

  const race = RACES[runnyar.turn];
  if (race) {
    gameState.lastRaceResult = runRace(race, runnyar);
    saveGame();
    showRaceResultScreen();
    return;
  }

  runnyar.turn += 1;
  saveGame();
  showTrainingScreen();
}

function rollMoodChange(fatigue) {
  const roll = Math.random();

  if (fatigue >= 70) {
    if (roll < 0.1) return 1;
    if (roll < 0.5) return 0;
    return -1;
  }

  if (roll < 0.2) return 1;
  if (roll < 0.8) return 0;
  return -1;
}

// レーススコアは能力、状態、つかれ、きあいで補正されたランダム値から計算します。
function calculateRaceScore(race, runnyar) {
  const moodBonus = runnyar.mood * 5;
  const fatiguePenalty = runnyar.fatigue * 0.3;
  const gutsBonus = Math.min(Math.floor(runnyar.guts / 10), 10);
  const randomMin = -15 + gutsBonus;
  const randomMax = 15;
  const randomValue = randomInt(randomMin, randomMax);
  const baseScore = runnyar.speed * race.speedRate + runnyar.stamina * race.staminaRate;
  const score = baseScore + moodBonus - fatiguePenalty + randomValue;

  return {
    score: Math.round(score),
    baseScore: Number(baseScore.toFixed(1)),
    moodBonus,
    fatiguePenalty: Number(fatiguePenalty.toFixed(1)),
    randomValue,
    randomMin,
    randomMax
  };
}

function runRace(race, runnyar) {
  const scoreInfo = calculateRaceScore(race, runnyar);
  const placement = getPlacement(scoreInfo.score);
  const earnedNiboshi = getNiboshiByPlacement(placement.label);
  const comment = createRaceComment(scoreInfo, runnyar, placement.label);

  runnyar.raceCount += 1;
  runnyar.totalNiboshi += earnedNiboshi;

  if (placement.label === "1位") {
    runnyar.winCount += 1;
  }

  const result = {
    ...race,
    ...scoreInfo,
    placement: placement.label,
    earnedNiboshi,
    comment
  };

  runnyar.raceHistory.push(result);
  return result;
}

function getPlacement(score) {
  if (score >= 65) return { label: "1位" };
  if (score >= 55) return { label: "2位" };
  if (score >= 45) return { label: "3位" };
  if (score >= 35) return { label: "5位" };
  return { label: "参加賞" };
}

function getNiboshiByPlacement(placement) {
  const rewards = {
    "1位": 10,
    "2位": 6,
    "3位": 3,
    "5位": 1,
    "参加賞": 0
  };

  return rewards[placement] ?? 0;
}

function createRaceComment(scoreInfo, runnyar, placement) {
  if (runnyar.fatigue >= 70) {
    return "つかれがたまって、本来の力を出しきれなかった……";
  }

  if (runnyar.mood >= 1 && placement === "1位") {
    return "最後までごきげんに走りきった！";
  }

  if (scoreInfo.randomValue <= scoreInfo.randomMin + 2 && runnyar.guts >= 60) {
    return "きあいの高さで大きな失速を防いだ！";
  }

  if (runnyar.mood >= 1) {
    return "今日は気分が乗って、軽やかな走りを見せた！";
  }

  if (placement === "1位") {
    return "ぐいっと前に出て、見事に走りきった！";
  }

  return "最後までしっかり走った。次のらんにゃーレースも楽しみだ！";
}

function goNextAfterRace() {
  const runnyar = gameState.currentRunnyar;

  if (!runnyar) {
    showTitleScreen();
    return;
  }

  if (runnyar.turn === 12) {
    graduateRunnyar();
    return;
  }

  runnyar.turn += 1;
  saveGame();
  showTrainingScreen();
}

function graduateRunnyar() {
  const runnyar = gameState.currentRunnyar;
  const supportBonus = calculateSupportBonus(runnyar);

  gameState.records.bestNiboshi = Math.max(gameState.records.bestNiboshi, runnyar.totalNiboshi);
  gameState.records.bestWins = Math.max(gameState.records.bestWins, runnyar.winCount);
  gameState.player.totalGraduates += 1;
  gameState.player.totalRaces += runnyar.raceCount;
  gameState.player.totalWins += runnyar.winCount;
  gameState.player.totalNiboshi += runnyar.totalNiboshi;
  gameState.supportBonus = supportBonus;
  gameState.lastGraduation = {
    runnyar: { ...runnyar },
    supportBonus
  };
  gameState.currentRunnyar = null;
  gameState.lastRaceResult = null;
  gameState.runnyarCount += 1;

  saveGame();
  showGraduationScreen();
}

// 最終能力から通常ボーナスを作り、総にぼし分の追加ボーナスをランダムに配ります。
function calculateSupportBonus(runnyar) {
  const bonus = {
    speed: Math.min(Math.floor(runnyar.speed / 10), 15),
    stamina: Math.min(Math.floor(runnyar.stamina / 10), 15),
    guts: Math.min(Math.floor(runnyar.guts / 10), 15)
  };
  const niboshiBonus = Math.min(Math.floor(runnyar.totalNiboshi / 10), 3);
  const keys = ["speed", "stamina", "guts"];

  for (let i = 0; i < niboshiBonus; i += 1) {
    const key = keys[randomInt(0, keys.length - 1)];
    bonus[key] += 1;
  }

  return bonus;
}

function getTurnsUntilNextRace(turn) {
  const nextRaceTurn = [3, 6, 9, 12].find((raceTurn) => raceTurn >= turn);
  return nextRaceTurn ? nextRaceTurn - turn : 0;
}

function getStatLabel(key) {
  const labels = {
    speed: "すばやさ",
    stamina: "たいりょく",
    guts: "きあい"
  };

  return labels[key];
}

function getFatigueClass(fatigue) {
  if (fatigue >= 70) return "fatigue-high";
  if (fatigue >= 40) return "fatigue-mid";
  return "fatigue-low";
}

function showTitleScreen(message = "") {
  const hasSave = Boolean(loadGame());

  app.innerHTML = `
    <section class="screen">
      <div class="panel title-panel">
        <div class="cat-mark" aria-hidden="true">🐾</div>
        <h1>らんにゃーず！<br>ごきげんダッシュ</h1>
        <p class="lead">
          1匹のらんにゃーを12ターン育てて、らんにゃーレースへ。<br>
          卒業したら、次のらんにゃーへ応援ボーナスをつなぎます。
        </p>
        ${message ? `<p class="notice">${escapeHtml(message)}</p>` : ""}
        <div class="button-row">
          <button type="button" data-action="new">はじめから</button>
          <button type="button" class="secondary" data-action="continue" ${hasSave ? "" : "disabled"}>つづきから</button>
          <button type="button" class="danger" data-action="reset">データリセット</button>
        </div>
        <p class="footer-note">HTML / CSS / JavaScript と localStorage だけで遊べます。</p>
      </div>
    </section>
  `;

  app.querySelector('[data-action="new"]').addEventListener("click", startNewGame);
  app.querySelector('[data-action="continue"]').addEventListener("click", continueGame);
  app.querySelector('[data-action="reset"]').addEventListener("click", resetGameData);
}

function showCreateRunnyarScreen() {
  const initialStats = {
    speed: clamp(BASE_STATS.speed + gameState.supportBonus.speed, 1, 100),
    stamina: clamp(BASE_STATS.stamina + gameState.supportBonus.stamina, 1, 100),
    guts: clamp(BASE_STATS.guts + gameState.supportBonus.guts, 1, 100)
  };

  app.innerHTML = `
    <section class="screen">
      <div class="panel">
        <div class="top-bar">
          <div>
            <span class="small-label">${gameState.runnyarCount}匹目のらんにゃー</span>
            <h2>新しいらんにゃー</h2>
          </div>
          <span class="badge">応援ボーナスつき</span>
        </div>

        <label class="stack">
          <span class="small-label">らんにゃー名</span>
          <input id="runnyarName" type="text" maxlength="16" placeholder="例：ミケまる">
        </label>

        <div class="section grid">
          ${renderStatCard("すばやさ", initialStats.speed)}
          ${renderStatCard("たいりょく", initialStats.stamina)}
          ${renderStatCard("きあい", initialStats.guts)}
          <div class="stat-card">
            <span class="small-label">応援ボーナス</span>
            <span class="stat-value">+${gameState.supportBonus.speed + gameState.supportBonus.stamina + gameState.supportBonus.guts}</span>
          </div>
        </div>

        <div class="section grid">
          ${renderBonusCard("すばやさ", gameState.supportBonus.speed)}
          ${renderBonusCard("たいりょく", gameState.supportBonus.stamina)}
          ${renderBonusCard("きあい", gameState.supportBonus.guts)}
        </div>

        <div class="button-row section">
          <button type="button" data-action="start">育成開始</button>
          <button type="button" class="ghost" data-action="title">タイトルへ戻る</button>
        </div>
      </div>
    </section>
  `;

  app.querySelector('[data-action="start"]').addEventListener("click", () => {
    createRunnyar(app.querySelector("#runnyarName").value);
  });
  app.querySelector('[data-action="title"]').addEventListener("click", () => showTitleScreen());
}

function showTrainingScreen() {
  const runnyar = gameState.currentRunnyar;
  const turnsUntilRace = getTurnsUntilNextRace(runnyar.turn);
  const nextRaceText = turnsUntilRace === 0 ? "このターン" : `あと${turnsUntilRace}ターン`;

  app.innerHTML = `
    <section class="screen">
      <div class="panel">
        <div class="top-bar">
          <div>
            <span class="small-label">${runnyar.generation}匹目 / ${runnyar.turn}ターン目</span>
            <h2 class="runnyar-name">${escapeHtml(runnyar.name)}</h2>
          </div>
          <span class="badge">次のレースまで${nextRaceText}</span>
        </div>

        <div class="grid">
          ${renderStatCard("すばやさ", runnyar.speed, true)}
          ${renderStatCard("たいりょく", runnyar.stamina, true)}
          ${renderStatCard("きあい", runnyar.guts, true)}
          ${renderMoodCard(runnyar.mood)}
          ${renderFatigueCard(runnyar.fatigue)}
          ${renderStatCard("総獲得にぼし", `${runnyar.totalNiboshi}`)}
          ${renderStatCard("歴代最高にぼし", gameState.records.bestNiboshi)}
          ${renderStatCard("歴代最多1位回数", `${gameState.records.bestWins}回`)}
        </div>

        <div class="section">
          <h3>今日の行動</h3>
          <div class="action-grid">
            ${ACTIONS.map((action) => `
              <button type="button" class="action-button" data-action-id="${action.id}">
                ${action.name}
                <span>${action.detail}</span>
              </button>
            `).join("")}
          </div>
        </div>
      </div>
    </section>
  `;

  app.querySelectorAll("[data-action-id]").forEach((button) => {
    button.addEventListener("click", () => applyAction(button.dataset.actionId));
  });
}

function showRaceResultScreen() {
  const result = gameState.lastRaceResult;

  app.innerHTML = `
    <section class="screen">
      <div class="panel">
        <div class="top-bar">
          <div>
            <span class="small-label">らんにゃーレース 結果</span>
            <h2>${result.name}</h2>
          </div>
          <span class="badge">${result.distanceType}</span>
        </div>

        <div class="grid">
          ${renderStatCard("レーススコア", result.score)}
          ${renderStatCard("順位", result.placement)}
          ${renderStatCard("獲得にぼし", result.earnedNiboshi)}
          ${renderStatCard("ランダム値", result.randomValue)}
          ${renderStatCard("きあいによるランダム範囲", `${result.randomMin}〜${result.randomMax}`)}
          ${renderStatCard("つかれペナルティ", `-${result.fatiguePenalty}`)}
        </div>

        <p class="comment">${result.comment}</p>

        <div class="button-row section">
          <button type="button" data-action="next">次へ</button>
        </div>
      </div>
    </section>
  `;

  app.querySelector('[data-action="next"]').addEventListener("click", goNextAfterRace);
}

function showGraduationScreen() {
  const graduation = gameState.lastGraduation;

  if (!graduation) {
    showCreateRunnyarScreen();
    return;
  }

  const runnyar = graduation.runnyar;
  const bonus = graduation.supportBonus;

  app.innerHTML = `
    <section class="screen">
      <div class="panel">
        <div class="top-bar">
          <div>
            <span class="small-label">${runnyar.generation}匹目の卒業</span>
            <h2>${escapeHtml(runnyar.name)}、卒業！</h2>
          </div>
          <span class="badge">総獲得 ${runnyar.totalNiboshi}にぼし</span>
        </div>

        <div class="grid">
          ${renderStatCard("通算レース数", `${runnyar.raceCount}回`)}
          ${renderStatCard("1位回数", `${runnyar.winCount}回`)}
          ${renderStatCard("総獲得にぼし", runnyar.totalNiboshi)}
          ${renderStatCard("何匹目か", `${runnyar.generation}匹目`)}
          ${renderStatCard("最終すばやさ", runnyar.speed)}
          ${renderStatCard("最終たいりょく", runnyar.stamina)}
          ${renderStatCard("最終きあい", runnyar.guts)}
        </div>

        <div class="section">
          <h3>次のらんにゃーへの応援ボーナス</h3>
          <div class="grid">
            ${renderBonusCard("すばやさ", bonus.speed)}
            ${renderBonusCard("たいりょく", bonus.stamina)}
            ${renderBonusCard("きあい", bonus.guts)}
          </div>
        </div>

        <div class="section">
          <h3>通算成績</h3>
          <ul class="history-list">
            ${runnyar.raceHistory.map((race) => `
              <li>
                <span>${race.name}</span>
                <strong>${race.placement} / ${race.earnedNiboshi}にぼし</strong>
              </li>
            `).join("")}
          </ul>
        </div>

        <div class="button-row section">
          <button type="button" data-action="next-runnyar">次のらんにゃーを育てる</button>
          <button type="button" class="ghost" data-action="title">タイトルへ戻る</button>
        </div>
      </div>
    </section>
  `;

  app.querySelector('[data-action="next-runnyar"]').addEventListener("click", showCreateRunnyarScreen);
  app.querySelector('[data-action="title"]').addEventListener("click", () => showTitleScreen());
}

function renderStatCard(label, value, withMeter = false) {
  const numericValue = Number(value);
  const meter = withMeter
    ? `<div class="meter" aria-hidden="true"><div class="meter-fill" style="--value: ${clamp(numericValue, 0, 100)}%"></div></div>`
    : "";

  return `
    <div class="stat-card">
      <span class="small-label">${label}</span>
      <span class="stat-value">${value}</span>
      ${meter}
    </div>
  `;
}

function renderBonusCard(label, value) {
  return `
    <div class="record-card">
      <span class="small-label">${label}</span>
      <span class="stat-value">+${value}</span>
    </div>
  `;
}

function renderMoodCard(mood) {
  return `
    <div class="stat-card">
      <span class="small-label">ごきげん</span>
      <span class="stat-value">${MOOD_LABELS[mood]}</span>
      <div class="meter" aria-hidden="true">
        <div class="meter-fill" style="--value: ${((mood + 2) / 4) * 100}%"></div>
      </div>
    </div>
  `;
}

function renderFatigueCard(fatigue) {
  return `
    <div class="stat-card">
      <span class="small-label">つかれ</span>
      <span class="stat-value">${fatigue}</span>
      <div class="meter" aria-hidden="true">
        <div class="meter-fill ${getFatigueClass(fatigue)}" style="--value: ${fatigue}%"></div>
      </div>
    </div>
  `;
}

showTitleScreen();
