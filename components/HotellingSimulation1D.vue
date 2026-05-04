<script setup lang="ts">
import { ref, computed, watch, onMounted, toRaw } from "vue";
import { LABELS, COLORS, DOT_COLORS, AREA_COLORS } from "~/utils/constants";

const N = 200;
const PX_W = 560;
const PX_H = 120;
const S = PX_W / N;

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

const { storeCount, count, simCount, simRunning, simProgress, animating, lastMovedIdx, buildRunAutoSim } = useSimState(100);

function createSim(n: number, sc = storeCount.value): SimState {
  const used = new Set<number>();
  const stores = Array.from({ length: sc }, () => randomPos(used));
  const people = Array.from({ length: n }, () => randomPos(used));
  return { stores, people };
}

const sim = ref<SimState>(createSim(count.value));
const drag = ref<number | null>(null);
const hoveredIdx = ref<number | null>(null);
const cvRef = ref<HTMLCanvasElement | null>(null);

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

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, PX_W, PX_H);

  for (let x = 0; x < N; x++) {
    const idx = nearestStore(x, stores);
    ctx.fillStyle = AREA_COLORS[idx];
    ctx.fillRect(x * S, 0, S, PX_H);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, PX_H / 2);
  ctx.lineTo(PX_W, PX_H / 2);
  ctx.stroke();

  for (let pi = 0; pi < people.length; pi++) {
    const idx = nearestStore(people[pi], stores);
    const cx = (people[pi] + 0.5) * S;
    const cy = peopleY.value[pi];
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fillStyle = DOT_COLORS[idx];
    ctx.fill();
  }

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
  lastMovedIdx.value = storeIdx;
}

const runAutoSim = buildRunAutoSim(counts, moveToBest);

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
  <div class="p-8 flex justify-center">
    <div class="flex flex-col lg:flex-row gap-8 w-full max-w-4xl">

      <div class="flex-shrink-0">
        <canvas
          ref="cvRef"
          :width="PX_W"
          :height="PX_H"
          class="block rounded-md border border-slate-800"
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

      <SimSidebar
        :storeCount="storeCount"
        :percents="percents"
        :animating="animating"
        :simRunning="simRunning"
        :simCount="simCount"
        :simProgress="simProgress"
        :populationCount="count"
        :populationMax="500"
        description="1次元では、競合する店舗は直線の中央に集まります（ナッシュ均衡）。"
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
