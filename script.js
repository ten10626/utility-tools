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
      <label>支払い明細</label>
      <textarea class="settlement-amount" rows="3" inputmode="numeric" placeholder="1000&#10;2000円">${escapeText(amount)}</textarea>
      <p class="person-total">合計：0円</p>
      <p class="person-warning" aria-live="polite"></p>
    </div>
    <button type="button" class="remove-row" aria-label="行を削除">×</button>
  `;
  const amountInput = row.querySelector(".settlement-amount");
  amountInput.addEventListener("input", () => updateSettlementRowTotal(row));
  updateSettlementRowTotal(row);
  row.querySelector(".remove-row").addEventListener("click", () => {
    row.remove();
    if (!list.children.length) addSettlementRow();
  });
  list.appendChild(row);
}

function escapeAttr(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function escapeText(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}

function parsePaymentLines(value) {
  const invalidLines = [];
  const total = value.split(/\r?\n/).reduce((sum, rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return sum;
    const normalized = line.replaceAll(",", "").replace(/円$/u, "").trim();
    if (!/^\d+$/u.test(normalized)) {
      invalidLines.push(index + 1);
      return sum;
    }
    return sum + Number(normalized);
  }, 0);
  return { total, invalidLines };
}

function updateSettlementRowTotal(row) {
  const amountInput = row.querySelector(".settlement-amount");
  const totalEl = row.querySelector(".person-total");
  const warningEl = row.querySelector(".person-warning");
  const { total, invalidLines } = parsePaymentLines(amountInput.value);
  totalEl.textContent = `合計：${yen.format(total)}円`;
  if (invalidLines.length) {
    warningEl.textContent = `${invalidLines.join(", ")}行目の金額を確認してください。`;
  } else {
    warningEl.textContent = "";
  }
  row.classList.toggle("has-warning", invalidLines.length > 0);
  return { total, invalidLines };
}

function calculateSettlement() {
  const rows = [...document.querySelectorAll(".person-row")].map((row) => {
    const parsed = updateSettlementRowTotal(row);
    return {
      name: row.querySelector(".settlement-name").value.trim(),
      paid: parsed.total,
      invalidLines: parsed.invalidLines,
    };
  });
  const invalidPeople = rows.filter((person) => person.name && person.invalidLines.length);
  if (invalidPeople.length) {
    setResult("settlement-result", "支払い明細に不正な行があります。各行の警告を確認してください。", true);
    return;
  }

  const people = rows.filter((person) => person.name);

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
addSettlementRow();
addSettlementRow();
addSettlementRow();

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

const qrQuietZoneModules = 4;

function makeQrCode(text) {
  if (typeof qrcode !== "function") {
    throw new Error("QRコード生成ライブラリを読み込めませんでした。");
  }
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr;
}

function drawQr(qr) {
  const canvas = $("qr-canvas");
  const moduleCount = qr.getModuleCount();
  const totalModules = moduleCount + qrQuietZoneModules * 2;
  const scale = Math.max(1, Math.floor(canvas.width / totalModules));
  const drawnSize = totalModules * scale;
  const offset = Math.floor((canvas.width - drawnSize) / 2);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(
          offset + (col + qrQuietZoneModules) * scale,
          offset + (row + qrQuietZoneModules) * scale,
          scale,
          scale,
        );
      }
    }
  }
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
