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
  const matches = cards
    .filter(c => c.toLowerCase().includes(v))
    .slice(0, 15);

  for (const card of matches) {
    const li = document.createElement("li");
    li.textContent = card;
    li.onclick = () => makeGuess(card);
    autocomplete.appendChild(li);
  }
}

input.addEventListener("input", () => updateAutocomplete(input.value));

/* ---------- guessing ---------- */
function closestCard(input: string): string {
  const query = input.toLowerCase();

  let best = cards[0];
  let bestScore = Infinity;

  for (const card of cards) {
    const name = card.toLowerCase();
    let score = 1000;

    if (name === query) {
      score = 0;
    } else if (name.startsWith(query)) {
      score = 1;
    } else if (name.includes(query)) {
      score = 2;
    } else {
      // alphabetical distance, but heavily de-weighted
      score = 100 + Math.abs(name.localeCompare(query));
    }

    if (score < bestScore) {
      bestScore = score;
      best = card;
    }
  }

  return best;
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
  makeGuess(closestCard(input.value));
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
        bars[barIndex].textContent = `${g.name}`;
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
