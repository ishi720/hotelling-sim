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
const storeCount = ref(3);
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
  ctx.fillStyle = "#111827";
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

  // 各住民から「対象店舗以外」への最小距離²を事前計算
  const minOtherDist2 = people.map((p) => {
    let min = Infinity;
    for (let i = 0; i < stores.length; i++) {
      if (i === storeIdx) continue;
      const d = dist2(p, stores[i]);
      if (d < min) min = d;
    }
    return min;
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
        if (dx * dx + dy * dy <= minOtherDist2[pi]) c++;
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
  <div class="min-h-screen bg-gray-950 text-white p-6 flex flex-col items-center gap-6">
    <!-- タイトル -->
    <div class="text-center">
      <h1 class="text-2xl font-semibold tracking-wide text-gray-100">
        ホテリングの法則
      </h1>
      <p class="text-sm text-gray-500 mt-1 tracking-widest uppercase">
        Competitive Location Simulation
      </p>
    </div>

    <div class="flex flex-col lg:flex-row gap-6 w-full max-w-4xl">
      <!-- Canvas -->
      <div class="flex-shrink-0">
        <canvas
          ref="cvRef"
          :width="PX"
          :height="PX"
          class="rounded-xl border border-gray-800 block"
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

      <!-- サイドパネル -->
      <div class="flex flex-col gap-4 min-w-[220px]">
        <!-- マーケットシェア -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs text-gray-500 tracking-widest uppercase">市場シェア</p>
            <div class="flex items-center gap-1.5">
              <button
                class="w-5 h-5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                :disabled="storeCount <= 2 || simRunning"
                @click="handleStoreCount(storeCount - 1)"
              >－</button>
              <span class="text-xs text-gray-400 w-3 text-center">{{ storeCount }}</span>
              <button
                class="w-5 h-5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                :disabled="storeCount >= 5 || simRunning"
                @click="handleStoreCount(storeCount + 1)"
              >＋</button>
            </div>
          </div>

          <div
            v-for="(label, i) in LABELS.slice(0, sim.stores.length)"
            :key="label"
            class="mb-3 last:mb-0"
          >
            <div class="flex justify-between items-baseline mb-1">
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-medium" :style="{ color: COLORS[i] }">
                  店舗 {{ label }}
                </span>
                <button
                  class="text-[10px] px-1.5 py-0.5 rounded border transition-opacity"
                  :style="{
                    color: animating[i] ? '#6b7280' : COLORS[i],
                    borderColor: animating[i] ? '#6b728066' : COLORS[i] + '66',
                  }"
                  :disabled="animating[i] || simRunning"
                  :class="animating[i] || simRunning ? 'cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'"
                  @click="moveToBest(i)"
                  title="顧客数が最大になる位置へ移動"
                >
                  {{ animating[i] ? '移動中…' : '最適化' }}
                </button>
              </div>
              <span :style="{ color: COLORS[i] }">
                {{ counts[i] }}
                <span class="text-gray-500 text-xs ml-1">({{ percents[i] }}%)</span>
              </span>
            </div>
            <div class="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-300"
                :style="{ width: `${percents[i]}%`, backgroundColor: COLORS[i] }"
              />
            </div>
          </div>

          <div class="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500">
            総住民数: {{ sim.people.length }}
          </div>
        </div>

        <!-- コントロール -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-500 tracking-widest uppercase mb-3">
            設定
          </p>
          <label class="text-xs text-gray-400 block mb-2">
            住民数: {{ count }}
          </label>
          <input
            type="range"
            min="10"
            max="500"
            step="10"
            :value="count"
            :disabled="simRunning"
            class="w-full accent-blue-500 mb-3 disabled:opacity-40"
            @input="handleCount(Number(($event.target as HTMLInputElement).value))"
          />
          <button
            class="w-full py-2 text-sm rounded-lg border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="simRunning"
            @click="randomize"
          >
            ↺ ランダム再配置
          </button>
        </div>

        <!-- 自動最適化 -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-500 tracking-widest uppercase mb-3">
            自動最適化
          </p>
          <label class="text-xs text-gray-400 block mb-2">
            回数:
            <input
              type="number"
              min="1"
              max="9999"
              :value="simCount"
              class="ml-1 w-20 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-white text-xs disabled:opacity-40"
              :disabled="simRunning"
              @change="simCount = Math.max(1, Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <button
            class="w-full py-2 text-sm rounded-lg border transition-colors"
            :class="simRunning
              ? 'border-red-500/40 text-red-400 hover:bg-red-500/10'
              : 'border-green-500/40 text-green-400 hover:bg-green-500/10'"
            @click="runAutoSim"
          >
            {{ simRunning ? '■ 停止' : '▶ 実行' }}
          </button>
          <div v-if="simRunning || simProgress > 0" class="mt-2 text-xs text-gray-500 text-center">
            {{ simProgress }} / {{ simCount }}
          </div>
        </div>

        <!-- 使い方 -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-500 tracking-widest uppercase mb-2">
            使い方
          </p>
          <p class="text-xs text-gray-400 leading-relaxed">
            店舗をドラッグして位置を変更できます。各住民は最も近い店舗を利用します。
          </p>
        </div>

        <!-- 解説 -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-500 tracking-widest uppercase mb-2">
            ホテリングの法則とは
          </p>
          <p class="text-xs text-gray-400 leading-relaxed">
            競合する店舗は市場の中央に集まる傾向があります。これがナッシュ均衡であり、どちらも位置を変えても顧客数を増やせない状態です。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
