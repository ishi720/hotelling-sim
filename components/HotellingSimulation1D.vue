<script setup lang="ts">
import { ref, computed, watch, onMounted, toRaw } from "vue";

const N = 200;
const PX_W = 560;
const PX_H = 120;
const S = PX_W / N;

const LABELS = ["A", "B", "C", "D", "E"];
const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7"];
const DOT_COLORS = [
  "rgba(147,197,253,0.9)",
  "rgba(252,165,165,0.9)",
  "rgba(134,239,172,0.9)",
  "rgba(252,211,77,0.9)",
  "rgba(216,180,254,0.9)",
];
const AREA_COLORS = [
  "rgba(59,130,246,0.22)",
  "rgba(239,68,68,0.22)",
  "rgba(34,197,94,0.22)",
  "rgba(245,158,11,0.22)",
  "rgba(168,85,247,0.22)",
];

interface SimState {
  stores: number[];
  people: number[];
}

const dist1 = (a: number, b: number) => Math.abs(a - b);

function randomPos(used: Set<number>): number {
  let x: number;
  do { x = Math.floor(Math.random() * N); } while (used.has(x));
  used.add(x);
  return x;
}

function nearestStore(p: number, stores: number[]): number {
  let minD = Infinity, idx = 0;
  for (let i = 0; i < stores.length; i++) {
    const d = dist1(p, stores[i]);
    if (d < minD) { minD = d; idx = i; }
  }
  return idx;
}

const storeCount = ref(2);
const count = ref(100);

function createSim(n: number, sc = storeCount.value): SimState {
  const used = new Set<number>();
  const stores = Array.from({ length: sc }, () => randomPos(used));
  const people = Array.from({ length: n }, () => randomPos(used));
  return { stores, people };
}

const sim = ref<SimState>(createSim(100));
const drag = ref<number | null>(null);
const hoveredIdx = ref<number | null>(null);
const cvRef = ref<HTMLCanvasElement | null>(null);
const animating = ref<boolean[]>(Array(storeCount.value).fill(false));
const simCount = ref(100);
const simRunning = ref(false);
const simProgress = ref(0);

const counts = computed(() => {
  const c = Array(sim.value.stores.length).fill(0);
  for (const p of sim.value.people) c[nearestStore(p, sim.value.stores)]++;
  return c;
});
const percents = computed(() =>
  counts.value.map((c) =>
    sim.value.people.length ? Math.round((c / sim.value.people.length) * 100) : 0
  )
);

// 住民のy座標オフセット（見栄え用、固定シード的に決定）
const peopleY = computed(() =>
  sim.value.people.map((_, i) => {
    const hash = (i * 2654435761) >>> 0;
    return 20 + (hash % 60);
  })
);

function draw() {
  const cv = cvRef.value;
  if (!cv) return;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  const { stores, people } = sim.value;

  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, PX_W, PX_H);

  // ボロノイ帯（ライン）
  for (let x = 0; x < N; x++) {
    const idx = nearestStore(x, stores);
    ctx.fillStyle = AREA_COLORS[idx];
    ctx.fillRect(x * S, 0, S, PX_H);
  }

  // 軸ライン
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, PX_H / 2);
  ctx.lineTo(PX_W, PX_H / 2);
  ctx.stroke();

  // 住民ドット（y方向に散らばせて表示）
  for (let pi = 0; pi < people.length; pi++) {
    const idx = nearestStore(people[pi], stores);
    const cx = (people[pi] + 0.5) * S;
    const cy = peopleY.value[pi];
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fillStyle = DOT_COLORS[idx];
    ctx.fill();
  }

  // 店舗マーカー
  const drawStore = (i: number) => {
    const cx = (stores[i] + 0.5) * S;
    const cy = PX_H / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[i];
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
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

function getGridX(e: MouseEvent | TouchEvent): number {
  const cv = cvRef.value!;
  const rect = cv.getBoundingClientRect();
  const src = "touches" in e ? e.touches[0] : e;
  const px = (src.clientX - rect.left) * (PX_W / rect.width);
  return Math.max(0, Math.min(N - 1, Math.floor(px / S)));
}

function onDown(e: MouseEvent | TouchEvent) {
  if (simRunning.value) return;
  if (hoveredIdx.value !== null) {
    drag.value = hoveredIdx.value;
    e.preventDefault();
    return;
  }
  if ("touches" in e) {
    const x = getGridX(e);
    let bestD = 4, idx = -1;
    for (let i = 0; i < sim.value.stores.length; i++) {
      const d = dist1(x, sim.value.stores[i]);
      if (d < bestD) { bestD = d; idx = i; }
    }
    if (idx !== -1) { drag.value = idx; e.preventDefault(); }
  }
}

function onMove(e: MouseEvent | TouchEvent) {
  if (drag.value === null) {
    if (!("touches" in e)) {
      const x = getGridX(e);
      let bestD = 4;
      for (let i = 0; i < sim.value.stores.length; i++) {
        const d = dist1(x, sim.value.stores[i]);
        if (d < bestD || (d === bestD && (hoveredIdx.value === null || i > hoveredIdx.value))) {
          bestD = d; hoveredIdx.value = i;
        }
      }
    }
    return;
  }
  e.preventDefault();
  const x = getGridX(e);
  if (sim.value.stores.some((s, i) => i !== drag.value && s === x)) return;
  if (sim.value.people.some((p) => p === x)) return;
  const stores = [...sim.value.stores];
  stores[drag.value] = x;
  sim.value = { ...sim.value, stores };
}

function onUp() { drag.value = null; }

async function findBestPosition(storeIdx: number): Promise<number> {
  const rawSim = toRaw(sim.value);
  const stores = [...rawSim.stores];
  const people = [...rawSim.people];

  const minOther = people.map((p) => {
    let minD = Infinity, minI = Infinity;
    for (let i = 0; i < stores.length; i++) {
      if (i === storeIdx) continue;
      const d = dist1(p, stores[i]);
      if (d < minD || (d === minD && i < minI)) { minD = d; minI = i; }
    }
    return { d: minD, i: minI };
  });

  let best = stores[storeIdx];
  let bestCount = -1;
  for (let x = 0; x < N; x++) {
    if (x % 32 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    if (stores.some((s, i) => i !== storeIdx && s === x)) continue;
    let c = 0;
    for (let pi = 0; pi < people.length; pi++) {
      const d = dist1(people[pi], x);
      if (d < minOther[pi].d || (d === minOther[pi].d && storeIdx < minOther[pi].i)) c++;
    }
    if (c > bestCount) { bestCount = c; best = x; }
  }
  return best;
}

async function moveToBest(storeIdx: number) {
  if (animating.value[storeIdx]) return;
  const target = await findBestPosition(storeIdx);
  animating.value = animating.value.map((v, i) => (i === storeIdx ? true : v));
  while (true) {
    const current = sim.value.stores[storeIdx];
    if (current === target) break;
    const next = current + Math.sign(target - current);
    const stores = [...sim.value.stores];
    stores[storeIdx] = next;
    sim.value = { ...sim.value, stores };
    await new Promise((r) => setTimeout(r, 20));
  }
  animating.value = animating.value.map((v, i) => (i === storeIdx ? false : v));
}

async function runAutoSim() {
  if (simRunning.value) { simRunning.value = false; return; }
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

function usedPositions(): Set<number> {
  const s = sim.value;
  return new Set<number>([...s.stores, ...s.people]);
}

function handleStoreCount(v: number) {
  const sc = Math.max(2, Math.min(5, v));
  simRunning.value = false; simProgress.value = 0;
  if (sc > storeCount.value) {
    const used = usedPositions();
    const stores = [...sim.value.stores];
    for (let i = storeCount.value; i < sc; i++) stores.push(randomPos(used));
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
    for (let i = count.value; i < n; i++) people.push(randomPos(used));
    count.value = n;
    sim.value = { ...sim.value, people };
  } else {
    count.value = n;
    sim.value = { ...sim.value, people: sim.value.people.slice(0, n) };
  }
}

function randomize() { sim.value = createSim(count.value); }
</script>

<template>
  <div class="bg-gray-950 text-white p-6 flex flex-col items-center gap-6">
    <div class="text-center">
      <h1 class="text-2xl font-semibold tracking-wide text-gray-100">ホテリングの法則 <span class="text-gray-500 text-lg">— 1次元</span></h1>
      <p class="text-sm text-gray-500 mt-1 tracking-widest uppercase">1D Competitive Location Simulation</p>
    </div>

    <div class="flex flex-col lg:flex-row gap-6 w-full max-w-4xl">
      <div class="flex flex-col gap-3">
        <canvas
          ref="cvRef"
          :width="PX_W"
          :height="PX_H"
          class="rounded-xl border border-gray-800 block"
          :style="{
            width: '100%',
            maxWidth: `${PX_W}px`,
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

      <div class="flex flex-col gap-4 min-w-[220px]">
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs text-gray-500 tracking-widest uppercase">市場シェア</p>
            <div class="flex items-center gap-1.5">
              <button class="w-5 h-5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                :disabled="storeCount <= 2 || simRunning" @click="handleStoreCount(storeCount - 1)">－</button>
              <span class="text-xs text-gray-400 w-3 text-center">{{ storeCount }}</span>
              <button class="w-5 h-5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                :disabled="storeCount >= 5 || simRunning" @click="handleStoreCount(storeCount + 1)">＋</button>
            </div>
          </div>
          <div v-for="(label, i) in LABELS.slice(0, sim.stores.length)" :key="label" class="mb-3 last:mb-0">
            <div class="flex justify-between items-baseline mb-1">
              <div class="flex items-center gap-1.5">
                <span class="text-sm font-medium" :style="{ color: COLORS[i] }">店舗 {{ label }}</span>
                <button
                  class="text-[10px] px-1.5 py-0.5 rounded border transition-opacity"
                  :style="{ color: animating[i] ? '#6b7280' : COLORS[i], borderColor: animating[i] ? '#6b728066' : COLORS[i] + '66' }"
                  :disabled="animating[i] || simRunning"
                  :class="animating[i] || simRunning ? 'cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'"
                  @click="moveToBest(i)"
                >{{ animating[i] ? '移動中…' : '最適化' }}</button>
              </div>
              <span :style="{ color: COLORS[i] }">{{ counts[i] }} <span class="text-gray-500 text-xs ml-1">({{ percents[i] }}%)</span></span>
            </div>
            <div class="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-300" :style="{ width: `${percents[i]}%`, backgroundColor: COLORS[i] }" />
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500">総住民数: {{ sim.people.length }}</div>
        </div>

        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-500 tracking-widest uppercase mb-3">設定</p>
          <label class="text-xs text-gray-400 block mb-2">住民数: {{ count }}</label>
          <input type="range" min="10" max="500" step="10" :value="count" :disabled="simRunning"
            class="w-full accent-blue-500 mb-3 disabled:opacity-40"
            @input="handleCount(Number(($event.target as HTMLInputElement).value))" />
          <button class="w-full py-2 text-sm rounded-lg border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="simRunning" @click="randomize">↺ ランダム再配置</button>
        </div>

        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-500 tracking-widests uppercase mb-3">自動最適化</p>
          <label class="text-xs text-gray-400 block mb-2">回数:
            <input type="number" min="1" max="9999" :value="simCount"
              class="ml-1 w-20 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-white text-xs disabled:opacity-40"
              :disabled="simRunning"
              @change="simCount = Math.max(1, Number(($event.target as HTMLInputElement).value))" />
          </label>
          <button class="w-full py-2 text-sm rounded-lg border transition-colors"
            :class="simRunning ? 'border-red-500/40 text-red-400 hover:bg-red-500/10' : 'border-green-500/40 text-green-400 hover:bg-green-500/10'"
            @click="runAutoSim">{{ simRunning ? '■ 停止' : '▶ 実行' }}</button>
          <div v-if="simRunning || simProgress > 0" class="mt-2 text-xs text-gray-500 text-center">{{ simProgress }} / {{ simCount }}</div>
        </div>

        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-500 tracking-widests uppercase mb-2">ホテリングの法則とは</p>
          <p class="text-xs text-gray-400 leading-relaxed">1次元では、競合する店舗は直線の中央に集まります。均衡状態では全店舗が中央付近に密集します。</p>
        </div>
      </div>
    </div>
  </div>
</template>
