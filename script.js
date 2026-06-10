"use strict";

const yen = new Intl.NumberFormat("ja-JP");

function $(id) {
  return document.getElementById(id);
}

function setResult(id, text, isError = false) {
  const el = $(id);
  el.textContent = text;
  el.classList.toggle("is-error", isError);
}

function getLines(id) {
  return $(id).value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function copyTextFrom(targetId, button) {
  const text = $(targetId).textContent.trim();
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const original = button.textContent;
    button.textContent = "コピー済み";
    setTimeout(() => {
      button.textContent = original;
    }, 1200);
  });
}

document.querySelectorAll(".copy-btn").forEach((button) => {
  button.addEventListener("click", () => copyTextFrom(button.dataset.copyTarget, button));
});

function addSettlementRow(name = "", amount = "") {
  const list = $("settlement-rows");
  const row = document.createElement("div");
  row.className = "person-row";
  row.innerHTML = `
    <div>
      <label>名前</label>
      <input class="settlement-name" type="text" autocomplete="off" value="${escapeAttr(name)}" placeholder="A">
    </div>
    <div>
      <label>支払済み金額</label>
      <input class="settlement-amount" type="number" min="0" step="1" inputmode="numeric" value="${escapeAttr(amount)}" placeholder="0">
    </div>
    <button type="button" class="remove-row" aria-label="行を削除">×</button>
  `;
  row.querySelector(".remove-row").addEventListener("click", () => {
    row.remove();
    if (!list.children.length) addSettlementRow();
  });
  list.appendChild(row);
}

function escapeAttr(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function calculateSettlement() {
  const people = [...document.querySelectorAll(".person-row")]
    .map((row) => ({
      name: row.querySelector(".settlement-name").value.trim(),
      paid: Math.max(0, Math.round(Number(row.querySelector(".settlement-amount").value || 0))),
    }))
    .filter((person) => person.name);

  if (people.length < 2) {
    setResult("settlement-result", "名前が入力された人を2人以上にしてください。", true);
    return;
  }

  const total = people.reduce((sum, person) => sum + person.paid, 0);
  const base = Math.floor(total / people.length);
  let remainder = total % people.length;
  const sortedByName = [...people].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const shares = new Map();
  sortedByName.forEach((person) => {
    shares.set(person.name, base + (remainder > 0 ? 1 : 0));
    remainder -= 1;
  });

  const debtors = [];
  const creditors = [];
  people.forEach((person) => {
    const diff = person.paid - shares.get(person.name);
    if (diff < 0) debtors.push({ name: person.name, amount: -diff });
    if (diff > 0) creditors.push({ name: person.name, amount: diff });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const payments = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    if (amount > 0) {
      payments.push(`${debtors[d].name}が${creditors[c].name}に${yen.format(amount)}円払う`);
    }
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (debtors[d].amount === 0) d += 1;
    if (creditors[c].amount === 0) c += 1;
  }

  const noPay = people
    .filter((person) => !payments.some((line) => line.startsWith(`${person.name}が`)))
    .map((person) => `${person.name}は支払いなし`);

  setResult(
    "settlement-result",
    [
      `合計 ${yen.format(total)}円`,
      `1人あたり ${yen.format(base)}円${total % people.length ? " または " + yen.format(base + 1) + "円" : ""}`,
      "",
      payments.length ? payments.join("\n") : "精算は不要です",
      ...noPay,
    ].join("\n"),
  );
}

$("add-settlement-row").addEventListener("click", () => addSettlementRow());
$("calc-settlement").addEventListener("click", calculateSettlement);
addSettlementRow("A", "1500");
addSettlementRow("B", "0");
addSettlementRow("C", "600");

$("run-lottery").addEventListener("click", () => {
  const candidates = getLines("lottery-candidates");
  const count = Number($("lottery-count").value);
  if (!candidates.length) return setResult("lottery-result", "候補を入力してください。", true);
  if (!Number.isInteger(count) || count < 1) return setResult("lottery-result", "当選人数は1以上の整数にしてください。", true);
  if (count > candidates.length) return setResult("lottery-result", "候補数より当選人数が多いです。", true);
  const winners = shuffle(candidates).slice(0, count);
  setResult("lottery-result", winners.map((name, i) => `${i + 1}. ${name}`).join("\n"));
});

$("run-numbering").addEventListener("click", () => {
  const candidates = getLines("numbering-candidates");
  const start = Number($("numbering-start").value);
  if (!candidates.length) return setResult("numbering-result", "候補を入力してください。", true);
  if (!Number.isInteger(start)) return setResult("numbering-result", "開始番号は整数にしてください。", true);
  const lines = shuffle(candidates).map((name, i) => `${start + i}番 ${name}`);
  setResult("numbering-result", lines.join("\n"));
});

let rouletteRemaining = [];
let rouletteHistory = [];
let rouletteTimer = null;

function rouletteMode() {
  return document.querySelector('input[name="roulette-mode"]:checked').value;
}

function resetRoulette() {
  rouletteRemaining = getLines("roulette-candidates");
  rouletteHistory = [];
  $("roulette-display").textContent = "?";
  setResult("roulette-result", rouletteRemaining.length ? "リセットしました。" : "候補を入力してください。", !rouletteRemaining.length);
}

function spinRoulette() {
  const mode = rouletteMode();
  const all = getLines("roulette-candidates");
  if (!all.length) return setResult("roulette-result", "候補を入力してください。", true);
  if (mode === "normal") rouletteRemaining = all;
  if (mode === "nomination" && !rouletteRemaining.length && rouletteHistory.length === 0) rouletteRemaining = all;
  if (mode === "nomination" && rouletteRemaining.length === 0) {
    setResult("roulette-result", "全員選ばれました。リセットで最初からやり直せます。");
    return;
  }

  const display = $("roulette-display");
  display.classList.add("spinning");
  $("spin-roulette").disabled = true;
  let ticks = 0;
  clearInterval(rouletteTimer);
  rouletteTimer = setInterval(() => {
    const pool = mode === "normal" ? all : rouletteRemaining;
    display.textContent = pool[Math.floor(Math.random() * pool.length)];
    ticks += 1;
    if (ticks >= 18) {
      clearInterval(rouletteTimer);
      const poolNow = mode === "normal" ? all : rouletteRemaining;
      const winner = poolNow[Math.floor(Math.random() * poolNow.length)];
      display.textContent = winner;
      display.classList.remove("spinning");
      $("spin-roulette").disabled = false;
      if (mode === "nomination") {
        const removeIndex = rouletteRemaining.indexOf(winner);
        if (removeIndex >= 0) rouletteRemaining.splice(removeIndex, 1);
        rouletteHistory.push(winner);
        const history = rouletteHistory.map((name, i) => `${i + 1}. ${name}`).join("\n");
        const done = rouletteRemaining.length === 0 ? "\n\n全員選ばれました。" : "";
        setResult("roulette-result", `選ばれた順番\n${history}${done}`);
      } else {
        setResult("roulette-result", `結果: ${winner}`);
      }
    }
  }, 70);
}

$("spin-roulette").addEventListener("click", spinRoulette);
$("reset-roulette").addEventListener("click", resetRoulette);
document.querySelectorAll('input[name="roulette-mode"]').forEach((radio) => radio.addEventListener("change", resetRoulette));

const qrConfig = [
  null,
  { data: 19, ecc: 7, align: [] },
  { data: 34, ecc: 10, align: [6, 18] },
  { data: 55, ecc: 15, align: [6, 22] },
  { data: 80, ecc: 20, align: [6, 26] },
  { data: 108, ecc: 26, align: [6, 30] },
];

function makeQrCode(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let version = 1;
  for (; version < qrConfig.length; version += 1) {
    const countBits = 8;
    const usable = qrConfig[version].data * 8 - 4 - countBits - 4;
    if (bytes.length * 8 <= usable) break;
  }
  if (version >= qrConfig.length) throw new Error("URLが長すぎます。短いURLにしてください。");

  const cfg = qrConfig[version];
  const bits = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, cfg.data * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bitsToByte(bits.slice(i, i + 8)));
  for (let pad = 0; data.length < cfg.data; pad += 1) data.push(pad % 2 ? 0x11 : 0xec);

  const codewords = [...data, ...reedSolomon(data, cfg.ecc)];
  return buildQrMatrix(version, codewords);
}

function appendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
}

function bitsToByte(bits) {
  return bits.reduce((value, bit) => (value << 1) | bit, 0);
}

const gfExp = new Array(512);
const gfLog = new Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    gfExp[i] = x;
    gfLog[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) gfExp[i] = gfExp[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return gfExp[gfLog[a] + gfLog[b]];
}

function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    poly.forEach((coef, j) => {
      next[j] ^= gfMul(coef, gfExp[i]);
      next[j + 1] ^= coef;
    });
    poly = next;
  }
  return poly.slice(1);
}

function reedSolomon(data, degree) {
  const gen = rsGenerator(degree);
  const rem = new Array(degree).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ rem.shift();
    rem.push(0);
    gen.forEach((coef, i) => {
      rem[i] ^= gfMul(coef, factor);
    });
  });
  return rem;
}

function buildQrMatrix(version, codewords) {
  const size = 17 + version * 4;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r, c, dark, isReserved = true) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    matrix[r][c] = dark;
    if (isReserved) reserved[r][c] = true;
  };

  placeFinder(set, 0, 0);
  placeFinder(set, 0, size - 7);
  placeFinder(set, size - 7, 0);
  for (let i = 0; i < size; i += 1) {
    if (!reserved[6][i]) set(6, i, i % 2 === 0);
    if (!reserved[i][6]) set(i, 6, i % 2 === 0);
  }
  qrConfig[version].align.forEach((r) => {
    qrConfig[version].align.forEach((c) => {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) return;
      placeAlign(set, r - 2, c - 2);
    });
  });
  set(4 * version + 9, 8, true);
  reserveFormat(reserved, size);

  const dataBits = [];
  codewords.forEach((byte) => appendBits(dataBits, byte, 8));
  let bitIndex = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let i = 0; i < size; i += 1) {
      const row = upward ? size - 1 - i : i;
      for (let offset = 0; offset < 2; offset += 1) {
        const c = col - offset;
        if (reserved[row][c]) continue;
        let dark = bitIndex < dataBits.length ? dataBits[bitIndex] === 1 : false;
        if ((row + c) % 2 === 0) dark = !dark;
        matrix[row][c] = dark;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
  placeFormat(matrix, reserved, size, 0);
  return matrix;
}

function placeFinder(set, top, left) {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = top + r;
      const cc = left + c;
      const inFinder = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const dark = inFinder && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      set(rr, cc, dark);
    }
  }
}

function placeAlign(set, top, left) {
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      set(top + r, left + c, r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2));
    }
  }
}

function reserveFormat(reserved, size) {
  for (let i = 0; i < 9; i += 1) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }
}

function formatBits(mask) {
  let data = (1 << 3) | mask;
  let bits = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if ((bits >>> i) & 1) bits ^= 0x537 << (i - 10);
  }
  return (((data << 10) | bits) ^ 0x5412) & 0x7fff;
}

function placeFormat(matrix, reserved, size, mask) {
  const bits = formatBits(mask);
  const coords1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const coords2 = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];
  coords1.forEach(([r, c], i) => {
    matrix[r][c] = ((bits >>> i) & 1) === 1;
    reserved[r][c] = true;
  });
  coords2.forEach(([r, c], i) => {
    matrix[r][c] = ((bits >>> i) & 1) === 1;
    reserved[r][c] = true;
  });
}

function drawQr(matrix) {
  const canvas = $("qr-canvas");
  const size = matrix.length;
  const scale = Math.floor(canvas.width / (size + 8));
  const offset = Math.floor((canvas.width - size * scale) / 2);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  matrix.forEach((row, r) => {
    row.forEach((dark, c) => {
      if (dark) ctx.fillRect(offset + c * scale, offset + r * scale, scale, scale);
    });
  });
}

function validateUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

$("make-qr").addEventListener("click", () => {
  const value = $("qr-url").value.trim();
  $("save-qr").disabled = true;
  if (!value) return setResult("qr-result", "URLを入力してください。", true);
  if (!validateUrl(value)) return setResult("qr-result", "http:// または https:// で始まるURLを入力してください。", true);
  try {
    drawQr(makeQrCode(value));
    $("save-qr").disabled = false;
    setResult("qr-result", "QRコードを生成しました。");
  } catch (error) {
    setResult("qr-result", error.message, true);
  }
});

$("save-qr").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "qr-code.png";
  link.href = $("qr-canvas").toDataURL("image/png");
  link.click();
});
