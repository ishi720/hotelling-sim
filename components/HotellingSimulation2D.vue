<script setup lang="ts">
import { ref, computed, watch, onMounted, toRaw } from "vue";
import { LABELS, COLORS, AREA_COLORS, DOT_COLORS } from "~/utils/constants";

const N = 80;
const PX = 560;
const S = PX / N;

interface Point { x: number; y: number; }
interface SimState { stores: Point[]; people: Point[]; }

const dist = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
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

const { storeCount, count, simCount, simRunning, simProgress, animating, lastMovedIdx, buildRunAutoSim } = useSimState(100);

function createSim(n: number, sc = storeCount.value): SimState {
  const used = new Set<string>();
  const stores = Array.from({ length: sc }, () => randomPoint(used));
  const people = Array.from({ length: n }, () => randomPoint(used));
  return { stores, people };
}

const sim = ref<SimState>(createSim(count.value));
const drag = ref<number | null>(null);
const hoveredIdx = ref<number | null>(null);
const cvRef = ref<HTMLCanvasElement | null>(null);

const counts = computed(() => {
  const c = Array(sim.value.stores.length).fill(0);
  for (const p of sim.value.people) {
    c[nearestStore(p, sim.value.stores)]++;
  }
  return c;
});
const percents = computed(() =>
  counts.value.map((c) =>
    sim.value.people.length ? Math.round((c / sim.value.people.length) * 100) : 0
  )
);

function draw() {
  const cv = cvRef.value;
  if (!cv) return;
  const ctx = cv.getContext("2d");
  if (!ctx) return;

  const { stores, people } = sim.value;

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, PX, PX);

  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const idx = nearestStore({ x, y }, stores);
      ctx.fillStyle = AREA_COLORS[idx];
      ctx.fillRect(x * S, y * S, S, S);
    }
  }

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

  for (const p of people) {
    const idx = nearestStore(p, stores);
    ctx.beginPath();
    ctx.arc(toPx(p.x), toPx(p.y), 2.5, 0, Math.PI * 2);
    ctx.fillStyle = DOT_COLORS[idx];
    ctx.fill();
  }

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
  const animIdx = animating.value.findIndex(v => v);
  const top = drag.value !== null ? drag.value : animIdx !== -1 ? animIdx : lastMovedIdx.value ?? hoveredIdx.value;
  for (let i = 0; i < stores.length; i++) { if (i !== top) drawStore(i); }
  if (top !== null && top < stores.length) drawStore(top);
}

watch(sim, draw, { deep: true });
watch(hoveredIdx, draw);
watch(lastMovedIdx, draw);
watch(animating, draw);
onMounted(draw);

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

async function findBestPosition(storeIdx: number): Promise<Point> {
  const rawSim = toRaw(sim.value);
  const stores: Point[] = rawSim.stores.map((s) => ({ x: s.x, y: s.y }));
  const people: Point[] = rawSim.people.map((p) => ({ x: p.x, y: p.y }));

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
    if (x % 16 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    for (let y = 0; y < N; y++) {
      if (stores.some((s, i) => i !== storeIdx && s.x === x && s.y === y)) continue;
      let c = 0;
      for (let pi = 0; pi < people.length; pi++) {
        const dx = people[pi].x - x;
        const dy = people[pi].y - y;
        const d = dx * dx + dy * dy;
        if (d < minOther[pi].d || (d === minOther[pi].d && storeIdx < minOther[pi].i)) c++;
      }
      if (c > bestCount) { bestCount = c; best = { x, y }; }
    }
  }
  return best;
}

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
  lastMovedIdx.value = storeIdx;
}

const runAutoSim = buildRunAutoSim(counts, moveToBest);

function usedPositions(): Set<string> {
  const s = sim.value;
  return new Set<string>([
    ...s.stores.map((p) => `${p.x},${p.y}`),
    ...s.people.map((p) => `${p.x},${p.y}`),
  ]);
}

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

      <SimSidebar
        :storeCount="storeCount"
        :percents="percents"
        :animating="animating"
        :simRunning="simRunning"
        :simCount="simCount"
        :simProgress="simProgress"
        :populationCount="count"
        :populationMax="500"
        description="競合する店舗は市場の中央に集まる傾向があります（ナッシュ均衡）。"
        @storeCountChange="handleStoreCount"
        @moveToBest="moveToBest"
        @simCountChange="simCount = $event"
        @runAutoSim="runAutoSim"
        @populationChange="handleCount"
        @randomize="randomize"
      />

    </div>
  </div>
</template>
