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
fetch("cards.json")
  .then(r => r.json())
  .then((data: string[]) => {
    cards = data;
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
function closestCard(name: string): string {
  const lower = name.toLowerCase();
  let best = cards[0];
  let bestScore = Infinity;

  for (const c of cards) {
    const score = Math.abs(c.toLowerCase().localeCompare(lower));
    if (score < bestScore) {
      bestScore = score;
      best = c;
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
  const diff = Math.abs(last.index - answerIndex());

  if (diff === 0) {
    center.textContent = `${last.name} (${guesses.length} guesses)`;
    center.classList.add("correct");
    return;
  }

  center.textContent = `${diff} cards away`;
  center.classList.add("guess");
}
