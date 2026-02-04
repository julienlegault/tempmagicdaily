type Guess = {
  name: string;
  index: number;
};

const input = document.getElementById("guessInput") as HTMLInputElement;
const button = document.getElementById("guessButton") as HTMLButtonElement;
const autocomplete = document.getElementById("autocomplete")!;
const bars = Array.from(document.querySelectorAll(".bar"));

let cards: string[] = [];
let guesses: Guess[] = [];

/* ---------- seeded RNG ---------- */
function seededRandom(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function getDailyIndex(max: number) {
  const today = new Date().toISOString().slice(0, 10);
  let seed = 0;
  for (const c of today) seed += c.charCodeAt(0);
  const rand = seededRandom(seed);
  return Math.floor(rand() * max);
}

/* ---------- load cards ---------- */
fetch("./formatted_card_list.json")
.then(r => r.json())
  .then((data: string[]) => {
    cards = data.sort();
  });

/* ---------- autocomplete ---------- */
function updateAutocomplete(value: string) {
  autocomplete.innerHTML = "";
  if (!value) return;

  const v = value.toLowerCase();
  const matches = getRanked(input.value, 15);

  for (const card of matches) {
    const li = document.createElement("li");
    li.textContent = card;
    li.onclick = () => makeGuess(card);
    autocomplete.appendChild(li);
  }
}

input.addEventListener("input", () => updateAutocomplete(input.value));

input.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const match = getRanked(input.value, 1)[0];
    if (match) makeGuess(match);
  }
});

/* ---------- guessing ---------- */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// small Levenshtein (good enough + fast)
function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }

  return dp[a.length][b.length];
}

let lastQuery = "";
let lastResults: string[] = [];

function getRanked(query: string, limit: number): string[] {
  if (!query) return [];

  if (query === lastQuery) {
    return lastResults.slice(0, limit);
  }

  lastQuery = query;
  lastResults = rankedSearch(query);
  return lastResults.slice(0, limit);
}

function rankedSearch(query: string, limit = 15): string[] {
  const q = normalize(query);
  if (!q) return [];

  return cards
    .map(card => {
      const n = normalize(card);
      let score = 10000;

      if (n === q) {
        score = 0;
      }
      // phrase appears at word boundary
      else if (n.startsWith(q)) {
        score = 10;
      }
      else if (n.includes(" " + q)) {
        score = 20;
      }
      // phrase appears later but intact
      else if (n.includes(q)) {
        score = 30;
      }
      // fuzzy: compare against each word chunk
      else {
        const words = n.split(" ");
        const qWords = q.split(" ");

        let best = Infinity;
        for (let i = 0; i <= words.length - qWords.length; i++) {
          const slice = words.slice(i, i + qWords.length).join(" ");
          best = Math.min(best, levenshtein(slice, q));
        }

        score = 100 + best;
      }

      return { card, score, name: n };
    })
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      // tie-breaker: alphabetical AFTER relevance
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit)
    .map(r => r.card);
}

function makeGuess(cardName: string) {
  autocomplete.innerHTML = "";
  input.value = "";

  const guessIndex = cards.indexOf(cardName);
  if (guessIndex === -1) return;

  guesses.push({ name: cardName, index: guessIndex });
  animateWheel(guessIndex);
}

button.onclick = () => {
  if (!input.value) return;
  const match = getRanked(input.value, 1)[0];
  if (match) makeGuess(match);
};

/* ---------- wheel logic ---------- */
const answerIndex = () => getDailyIndex(cards.length);

function animateWheel(guessIndex: number) {
  const diff = guessIndex - answerIndex();
  const direction = diff > 0 ? "spin-down" : "spin-up";

  bars.forEach(b => {
    b.classList.remove("spin-up", "spin-down", "guess", "correct");
    b.classList.add(direction);
  });

  setTimeout(() => {
    bars.forEach(b => b.classList.remove("spin-up", "spin-down"));
    renderState();
  }, 600);
}

function renderState() {
  bars.forEach(b => (b.textContent = ""));

  const center = bars[5];

  const last = guesses[guesses.length - 1];
  const diff = last.index - answerIndex();

  if (diff === 0) {
    center.textContent = `${last.name} (${guesses.length} guesses)`;
    center.classList.add("correct");
    return;
  }
  if (guesses.length == 1) {
    const drawBar = bars[diff>0?6:3];
    drawBar.textContent = `${last.name} | ${Math.abs(diff)} ${diff > 0 ? "^" : "v"}`;
    drawBar.classList.add("guess");
  } else {
  const above = guesses
    .filter(g => g.index < answerIndex())
    .sort((a, b) => b.index - a.index); // closest above first

  const below = guesses
    .filter(g => g.index > answerIndex())
    .sort((a, b) => a.index - b.index); // closest below first

  // draw closest above (bar 3)
  if (above.length > 0) {
    const g = above[0];
    const diff = answerIndex() - g.index;
    const bar = bars[3];
    bar.textContent = `${g.name} | ${diff} v`;
    bar.classList.add("guess");
  }

  // draw closest below (bar 6)
  if (below.length > 0) {
    const g = below[0];
    const diff = g.index - answerIndex();
    const bar = bars[6];
    bar.textContent = `${g.name} | ${diff} ^`;
    bar.classList.add("guess");
  }

  // draw all guesses within 5 cards on exact bars
  guesses.forEach(g => {
    const diff = g.index - answerIndex();
    if (Math.abs(diff) <= 5 && diff !== 0) {
      const barIndex = 5 + diff;
      if (bars[barIndex]) {
        bars[barIndex].textContent = `${g.name} | ${diff}`;
        bars[barIndex].classList.add("guess");
      }
    }
  });


  if (Math.abs(last.index - answerIndex()) > 5 && last != above[0] && last != below[0]) {
    const lastBar = bars[diff>0?9:0];
    lastBar.textContent = `${last.name} | ${Math.abs(diff)} ${diff > 0 ? "^" : "v"}`;
    lastBar.classList.add("guess");
  }
}
}
