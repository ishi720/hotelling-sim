<script setup lang="ts">
import { ref, computed, watch, onMounted, toRaw } from "vue";

// 定数
const N = 80;
const PX = 560;
const S = PX / N;
const LABELS = ["A", "B", "C", "D", "E"];
const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7"];
const AREA_COLORS = [
  "rgba(59,130,246,0.22)",
  "rgba(239,68,68,0.22)",
  "rgba(34,197,94,0.22)",
  "rgba(245,158,11,0.22)",
  "rgba(168,85,247,0.22)",
];
const DOT_COLORS = [
  "rgba(147,197,253,0.9)",
  "rgba(252,165,165,0.9)",
  "rgba(134,239,172,0.9)",
  "rgba(252,211,77,0.9)",
  "rgba(216,180,254,0.9)",
];

// 型
interface Point {
  x: number;
  y: number;
}
interface SimState {
  stores: Point[];
  people: Point[];
}

// ユーティリティ
const dist = (a: Point, b: Point) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const dist2 = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const toPx = (v: number) => (v + 0.5) * S;
const toGrid = (px: number) => Math.max(0, Math.min(N - 1, Math.floor(px / S)));

function randomPoint(used: Set<string>): Point {
  let x: number, y: number, k: string;
  do {
    x = Math.floor(Math.random() * N);
    y = Math.floor(Math.random() * N);
    k = `${x},${y}`;
  } while (used.has(k));
  used.add(k);
  return { x, y };
}

function nearestStore(p: Point, stores: Point[]): number {
  let minD = Infinity, idx = 0;
  for (let i = 0; i < stores.length; i++) {
    const d = dist(p, stores[i]);
    if (d < minD) { minD = d; idx = i; }
  }
  return idx;
}

function createSim(n: number, sc = storeCount.value): SimState {
  const used = new Set<string>();
  const stores = Array.from({ length: sc }, () => randomPoint(used));
  const people = Array.from({ length: n }, () => randomPoint(used));
  return { stores, people };
}

// リアクティブ状態
const storeCount = ref(2);
const count = ref(100);
const sim = ref<SimState>(createSim(100));
const drag = ref<number | null>(null);
const hoveredIdx = ref<number | null>(null);
const cvRef = ref<HTMLCanvasElement | null>(null);

// 計算プロパティ
const counts = computed(() => {
  const c = Array(sim.value.stores.length).fill(0);
  for (const p of sim.value.people) {
    c[nearestStore(p, sim.value.stores)]++;
  }
  return c;
});
const percents = computed(() =>
  counts.value.map((c) =>
    sim.value.people.length
      ? Math.round((c / sim.value.people.length) * 100)
      : 0
  )
);

// Canvas 描画
function draw() {
  const cv = cvRef.value;
  if (!cv) return;
  const ctx = cv.getContext("2d");
  if (!ctx) return;

  const { stores, people } = sim.value;

  // 背景
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, PX, PX);

  // ボロノイ領域
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const idx = nearestStore({ x, y }, stores);
      ctx.fillStyle = AREA_COLORS[idx];
      ctx.fillRect(x * S, y * S, S, S);
    }
  }

  // グリッド線
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= N; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i * S, 0);
    ctx.lineTo(i * S, PX);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * S);
    ctx.lineTo(PX, i * S);
    ctx.stroke();
  }

  // 住民ドット
  for (const p of people) {
    const idx = nearestStore(p, stores);
    ctx.beginPath();
    ctx.arc(toPx(p.x), toPx(p.y), 2.5, 0, Math.PI * 2);
    ctx.fillStyle = DOT_COLORS[idx];
    ctx.fill();
  }

  // 店舗マーカー（ホバー中の店舗を最後＝最前面に描画）
  const drawStore = (i: number) => {
    const cx = toPx(stores[i].x);
    const cy = toPx(stores[i].y);
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[i];
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(LABELS[i], cx, cy);
  };
  const hi = hoveredIdx.value ?? drag.value;
  for (let i = 0; i < stores.length; i++) { if (i !== hi) drawStore(i); }
  if (hi !== null && hi < stores.length) drawStore(hi);
}

watch(sim, draw, { deep: true });
watch(hoveredIdx, draw);
onMounted(draw);

// ─── ドラッグ操作 ────────────────────────────────────────
function getPos(e: MouseEvent | TouchEvent): Point {
  const cv = cvRef.value!;
  const rect = cv.getBoundingClientRect();
  const src = "touches" in e ? e.touches[0] : e;
  const px = (src.clientX - rect.left) * (PX / rect.width);
  const py = (src.clientY - rect.top) * (PX / rect.height);
  return { x: toGrid(px), y: toGrid(py) };
}

function onDown(e: MouseEvent | TouchEvent) {
  if (simRunning.value) return;
  // hoveredIdx がセット済みならその店舗を掴む（マウス）、なければタッチ用フォールバック
  if (hoveredIdx.value !== null) {
    drag.value = hoveredIdx.value;
    e.preventDefault();
    return;
  }
  if ('touches' in e) {
    const pos = getPos(e);
    const idx = sim.value.stores.reduce<{ i: number; d: number }>(
      (best, s, i) => { const d = dist(pos, s); return d < best.d ? { i, d } : best; },
      { i: -1, d: 4 }
    ).i;
    if (idx !== -1) { drag.value = idx; e.preventDefault(); }
  }
}

function onMove(e: MouseEvent | TouchEvent) {
  if (drag.value === null) {
    if (!('touches' in e)) {
      const pos = getPos(e);
      // カーソルに最も近い店舗を前面候補に（同距離なら高インデックス優先）
      let bestD = 4;
      for (let i = 0; i < sim.value.stores.length; i++) {
        const d = dist(pos, sim.value.stores[i]);
        if (d < bestD || (d === bestD && (hoveredIdx.value === null || i > hoveredIdx.value))) {
          bestD = d; hoveredIdx.value = i;
        }
      }
    }
    return;
  }
  e.preventDefault();
  const pos = getPos(e);
  if (sim.value.stores.some((s, i) => i !== drag.value && s.x === pos.x && s.y === pos.y)) return;
  if (sim.value.people.some((p) => p.x === pos.x && p.y === pos.y)) return;
  const stores = [...sim.value.stores];
  stores[drag.value] = pos;
  sim.value = { ...sim.value, stores };
}

function onUp() {
  drag.value = null;
}

// 最適位置探索（他店舗を固定し顧客数が最大になるグリッドセルを返す）
async function findBestPosition(storeIdx: number): Promise<Point> {
  // リアクティブ参照を外し、計算中に状態が変わっても影響を受けない純粋な配列にコピー
  const rawSim = toRaw(sim.value);
  const stores: Point[] = rawSim.stores.map((s) => ({ x: s.x, y: s.y }));
  const people: Point[] = rawSim.people.map((p) => ({ x: p.x, y: p.y }));

  // 各住民から「対象店舗以外」への最小距離²と、その店舗の最低インデックスを事前計算
  // nearestStore は同距離なら低インデックス優先なので、その判定を再現する
  const minOther = people.map((p) => {
    let minD = Infinity, minI = Infinity;
    for (let i = 0; i < stores.length; i++) {
      if (i === storeIdx) continue;
      const d = dist2(p, stores[i]);
      if (d < minD || (d === minD && i < minI)) { minD = d; minI = i; }
    }
    return { d: minD, i: minI };
  });
  let best: Point = { ...stores[storeIdx] };
  let bestCount = -1;
  for (let x = 0; x < N; x++) {
    // 16列ごとにブラウザへ制御を返してフリーズを防ぐ
    if (x % 16 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    for (let y = 0; y < N; y++) {
      if (stores.some((s, i) => i !== storeIdx && s.x === x && s.y === y)) continue;
      let c = 0;
      for (let pi = 0; pi < people.length; pi++) {
        const dx = people[pi].x - x;
        const dy = people[pi].y - y;
        const d = dx * dx + dy * dy;
        // 厳密に近い、または同距離でも自分のインデックスが低い場合に獲得
        if (d < minOther[pi].d || (d === minOther[pi].d && storeIdx < minOther[pi].i)) c++;
      }
      if (c > bestCount) { bestCount = c; best = { x, y }; }
    }
  }
  return best;
}

const animating = ref<boolean[]>(Array(storeCount.value).fill(false));

async function moveToBest(storeIdx: number) {
  if (animating.value[storeIdx]) return;
  const target = await findBestPosition(storeIdx);
  animating.value = animating.value.map((v, i) => (i === storeIdx ? true : v));

  while (true) {
    const current = sim.value.stores[storeIdx];
    if (current.x === target.x && current.y === target.y) break;
    const next = {
      x: current.x + Math.sign(target.x - current.x),
      y: current.y + Math.sign(target.y - current.y),
    };
    const stores = [...sim.value.stores];
    stores[storeIdx] = next;
    sim.value = { ...sim.value, stores };
    await new Promise((r) => setTimeout(r, 20));
  }

  animating.value = animating.value.map((v, i) => (i === storeIdx ? false : v));
}

// 自動最適化
const simCount = ref(100);
const simRunning = ref(false);
const simProgress = ref(0);

async function runAutoSim() {
  if (simRunning.value) {
    simRunning.value = false;
    return;
  }
  simRunning.value = true;
  simProgress.value = 0;
  for (let i = 0; i < simCount.value; i++) {
    if (!simRunning.value) break;
    const minIdx = counts.value.indexOf(Math.min(...counts.value));
    await moveToBest(minIdx);
    simProgress.value = i + 1;
  }
  simRunning.value = false;
}

// 現在の配置から使用済み座標セットを生成
function usedPositions(): Set<string> {
  const s = sim.value;
  return new Set<string>([
    ...s.stores.map((p) => `${p.x},${p.y}`),
    ...s.people.map((p) => `${p.x},${p.y}`),
  ]);
}

// コントロール
function handleStoreCount(v: number) {
  const sc = Math.max(2, Math.min(5, v));
  simRunning.value = false;
  simProgress.value = 0;
  if (sc > storeCount.value) {
    const used = usedPositions();
    const stores = [...sim.value.stores];
    for (let i = storeCount.value; i < sc; i++) stores.push(randomPoint(used));
    storeCount.value = sc;
    animating.value = Array(sc).fill(false);
    sim.value = { ...sim.value, stores };
  } else {
    storeCount.value = sc;
    animating.value = Array(sc).fill(false);
    sim.value = { ...sim.value, stores: sim.value.stores.slice(0, sc) };
  }
}

function handleCount(v: number) {
  const n = Math.max(10, Math.min(500, v));
  if (n > count.value) {
    const used = usedPositions();
    const people = [...sim.value.people];
    for (let i = count.value; i < n; i++) people.push(randomPoint(used));
    count.value = n;
    sim.value = { ...sim.value, people };
  } else {
    count.value = n;
    sim.value = { ...sim.value, people: sim.value.people.slice(0, n) };
  }
}

function randomize() {
  sim.value = createSim(count.value);
}
</script>

<template>
  <div class="p-8 flex justify-center">
    <div class="flex flex-col lg:flex-row gap-8 w-full max-w-4xl">

      <div class="flex-shrink-0">
        <canvas
          ref="cvRef"
          :width="PX"
          :height="PX"
          class="block rounded-md border border-slate-800"
          :style="{
            width: '100%',
            maxWidth: `${PX}px`,
            cursor: drag !== null ? 'grabbing' : hoveredIdx !== null ? 'grab' : 'default',
          }"
          @mousedown="onDown"
          @mousemove="onMove"
          @mouseup="onUp"
          @mouseleave="onUp"
          @touchstart.prevent="onDown"
          @touchmove.prevent="onMove"
          @touchend="onUp"
        />
      </div>

      <div class="w-full lg:w-52 flex-shrink-0 divide-y divide-slate-800">

        <div class="pb-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold text-slate-400">ステップ実行</span>
            <label class="text-xs text-slate-500 flex items-center gap-1.5">
              回数
              <input
                type="number" min="1" max="9999" :value="simCount"
                class="w-14 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200 text-xs text-right disabled:opacity-40"
                :disabled="simRunning"
                @change="simCount = Math.max(1, Number(($event.target as HTMLInputElement).value))"
              />
            </label>
          </div>
          <button
            class="w-full py-1.5 text-sm rounded border transition-colors"
            :class="simRunning ? 'border-red-800 text-red-400 hover:bg-red-950/40' : 'border-emerald-800 text-emerald-400 hover:bg-emerald-950/40'"
            @click="runAutoSim"
          >{{ simRunning ? '■ 停止' : '▶ 実行' }}</button>
          <div v-if="simRunning || simProgress > 0" class="mt-1.5 text-[11px] text-slate-600 text-right tabular-nums">
            {{ simProgress }} / {{ simCount }}
          </div>
        </div>

        <div class="py-5">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-semibold text-slate-400">市場シェア</span>
            <div class="flex items-center gap-1">
              <button
                class="w-5 h-5 flex items-center justify-center rounded border border-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed text-xs"
                :disabled="storeCount <= 2 || simRunning"
                @click="handleStoreCount(storeCount - 1)"
              >－</button>
              <span class="text-xs text-slate-500 w-4 text-center tabular-nums">{{ storeCount }}</span>
              <button
                class="w-5 h-5 flex items-center justify-center rounded border border-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed text-xs"
                :disabled="storeCount >= 5 || simRunning"
                @click="handleStoreCount(storeCount + 1)"
              >＋</button>
            </div>
          </div>
          <div v-for="(label, i) in LABELS.slice(0, sim.stores.length)" :key="label" class="mb-3 last:mb-0">
            <div class="flex justify-between items-center mb-1.5">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold" :style="{ color: COLORS[i] }">{{ label }}</span>
                <button
                  class="text-[10px] px-1.5 py-0.5 rounded border transition-opacity"
                  :style="{
                    color: animating[i] ? '#475569' : COLORS[i],
                    borderColor: animating[i] ? '#47556933' : COLORS[i] + '44',
                  }"
                  :disabled="animating[i] || simRunning"
                  :class="animating[i] || simRunning ? 'cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'"
                  @click="moveToBest(i)"
                >{{ animating[i] ? '移動中' : '最適化' }}</button>
              </div>
              <span class="text-xs tabular-nums" :style="{ color: COLORS[i] }">{{ percents[i] }}<span class="text-slate-700 text-[10px]">%</span></span>
            </div>
            <div class="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-300" :style="{ width: `${percents[i]}%`, backgroundColor: COLORS[i] }" />
            </div>
          </div>
          <div class="mt-4 text-[11px] text-slate-700">住民 {{ sim.people.length }} 人</div>
        </div>

        <div class="py-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold text-slate-400">設定</span>
            <span class="text-[11px] text-slate-600 tabular-nums">{{ count }} 人</span>
          </div>
          <input
            type="range" min="10" max="500" step="10" :value="count" :disabled="simRunning"
            class="w-full accent-blue-500 mb-3 disabled:opacity-40"
            @input="handleCount(Number(($event.target as HTMLInputElement).value))"
          />
          <button
            class="w-full py-1.5 text-xs rounded border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="simRunning"
            @click="randomize"
          >↺ ランダム再配置</button>
        </div>

        <div class="pt-5 text-[11px] leading-relaxed text-slate-600">
          競合する店舗は市場の中央に集まる傾向があります（ナッシュ均衡）。
        </div>

      </div>
    </div>
  </div>
</template>
