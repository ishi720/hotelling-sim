<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, toRaw } from "vue";

const N = 20;
const LABELS = ["A", "B", "C", "D", "E"];
const COLORS_HEX = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7"];
const COLORS_NUM = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b, 0xa855f7];
const DOT_COLORS_NUM = [0x93c5fd, 0xfca5a5, 0x86efac, 0xfcd34d, 0xd8b4fe];

interface Point3 { x: number; y: number; z: number; }
interface SimState { stores: Point3[]; people: Point3[]; }

const dist3sq = (a: Point3, b: Point3) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
const dist3 = (a: Point3, b: Point3) => Math.sqrt(dist3sq(a, b));

function randomPoint3(used: Set<string>): Point3 {
  let x: number, y: number, z: number, k: string;
  do {
    x = Math.floor(Math.random() * N);
    y = Math.floor(Math.random() * N);
    z = Math.floor(Math.random() * N);
    k = `${x},${y},${z}`;
  } while (used.has(k));
  used.add(k);
  return { x, y, z };
}

function nearestStore(p: Point3, stores: Point3[]): number {
  let minD = Infinity, idx = 0;
  for (let i = 0; i < stores.length; i++) {
    const d = dist3(p, stores[i]);
    if (d < minD) { minD = d; idx = i; }
  }
  return idx;
}

const storeCount = ref(2);
const count = ref(80);

function createSim(n: number, sc = storeCount.value): SimState {
  const used = new Set<string>();
  const stores = Array.from({ length: sc }, () => randomPoint3(used));
  const people = Array.from({ length: n }, () => randomPoint3(used));
  return { stores, people };
}

const sim = ref<SimState>(createSim(80));
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

// Three.js
const mountRef = ref<HTMLDivElement | null>(null);
let renderer: any = null;
let scene: any = null;
let camera: any = null;
let controls: any = null;
let storeObjects: any[] = [];
let peopleObjects: any[] = [];
let animFrameId: number | null = null;

const SCALE = 1;

function toWorld(p: Point3) {
  return {
    x: (p.x - N / 2) * SCALE,
    y: (p.y - N / 2) * SCALE,
    z: (p.z - N / 2) * SCALE,
  };
}

async function initThree() {
  const THREE = await import("three");
  const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");

  const el = mountRef.value;
  if (!el) return;

  const W = el.clientWidth || 560;
  const H = 420;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(W, H);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x0f172a);
  el.appendChild(renderer.domElement);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
  camera.position.set(N * 1.2, N * 0.8, N * 1.2);
  camera.lookAt(0, 0, 0);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(N, N, N);
  scene.add(dirLight);

  // ボックスアウトライン
  const boxGeo = new THREE.BoxGeometry(N, N, N);
  const edges = new THREE.EdgesGeometry(boxGeo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x374151 });
  scene.add(new THREE.LineSegments(edges, lineMat));

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  rebuildScene(THREE);

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  const resizeObs = new ResizeObserver(() => {
    const w = el.clientWidth;
    renderer.setSize(w, H);
    camera.aspect = w / H;
    camera.updateProjectionMatrix();
  });
  resizeObs.observe(el);
}

function rebuildScene(THREE?: any) {
  if (!scene) return;
  // clear people & stores
  for (const obj of [...storeObjects, ...peopleObjects]) scene.remove(obj);
  storeObjects = [];
  peopleObjects = [];

  if (!THREE) {
    import("three").then((T) => rebuildScene(T));
    return;
  }

  const { stores, people } = toRaw(sim.value);

  // 住民
  const pGeo = new THREE.SphereGeometry(0.3, 6, 6);
  for (let pi = 0; pi < people.length; pi++) {
    const idx = nearestStore(people[pi], stores);
    const mat = new THREE.MeshLambertMaterial({ color: DOT_COLORS_NUM[idx] });
    const mesh = new THREE.Mesh(pGeo, mat);
    const w = toWorld(people[pi]);
    mesh.position.set(w.x, w.y, w.z);
    scene.add(mesh);
    peopleObjects.push(mesh);
  }

  // 店舗
  const sGeo = new THREE.SphereGeometry(1.2, 16, 16);
  for (let i = 0; i < stores.length; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: COLORS_NUM[i] });
    const mesh = new THREE.Mesh(sGeo, mat);
    const w = toWorld(stores[i]);
    mesh.position.set(w.x, w.y, w.z);
    scene.add(mesh);
    storeObjects.push(mesh);
  }
}

watch(sim, () => rebuildScene(), { deep: true });

onMounted(() => initThree());

onUnmounted(() => {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId);
  if (renderer) renderer.dispose();
});

async function findBestPosition(storeIdx: number): Promise<Point3> {
  const rawSim = toRaw(sim.value);
  const stores: Point3[] = rawSim.stores.map((s) => ({ ...s }));
  const people: Point3[] = rawSim.people.map((p) => ({ ...p }));

  const minOther = people.map((p) => {
    let minD = Infinity, minI = Infinity;
    for (let i = 0; i < stores.length; i++) {
      if (i === storeIdx) continue;
      const d = dist3sq(p, stores[i]);
      if (d < minD || (d === minD && i < minI)) { minD = d; minI = i; }
    }
    return { d: minD, i: minI };
  });

  let best: Point3 = { ...stores[storeIdx] };
  let bestCount = -1;

  for (let x = 0; x < N; x++) {
    if (x % 4 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    for (let y = 0; y < N; y++) {
      for (let z = 0; z < N; z++) {
        if (stores.some((s, i) => i !== storeIdx && s.x === x && s.y === y && s.z === z)) continue;
        let c = 0;
        for (let pi = 0; pi < people.length; pi++) {
          const dx = people[pi].x - x, dy = people[pi].y - y, dz = people[pi].z - z;
          const d = dx * dx + dy * dy + dz * dz;
          if (d < minOther[pi].d || (d === minOther[pi].d && storeIdx < minOther[pi].i)) c++;
        }
        if (c > bestCount) { bestCount = c; best = { x, y, z }; }
      }
    }
  }
  return best;
}

async function moveToBest(storeIdx: number) {
  if (animating.value[storeIdx]) return;
  const target = await findBestPosition(storeIdx);
  animating.value = animating.value.map((v, i) => (i === storeIdx ? true : v));
  while (true) {
    const cur = sim.value.stores[storeIdx];
    if (cur.x === target.x && cur.y === target.y && cur.z === target.z) break;
    const next = {
      x: cur.x + Math.sign(target.x - cur.x),
      y: cur.y + Math.sign(target.y - cur.y),
      z: cur.z + Math.sign(target.z - cur.z),
    };
    const stores = [...sim.value.stores];
    stores[storeIdx] = next;
    sim.value = { ...sim.value, stores };
    await new Promise((r) => setTimeout(r, 30));
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

function usedPositions(): Set<string> {
  const s = sim.value;
  return new Set<string>([
    ...s.stores.map((p) => `${p.x},${p.y},${p.z}`),
    ...s.people.map((p) => `${p.x},${p.y},${p.z}`),
  ]);
}

function handleStoreCount(v: number) {
  const sc = Math.max(2, Math.min(5, v));
  simRunning.value = false; simProgress.value = 0;
  if (sc > storeCount.value) {
    const used = usedPositions();
    const stores = [...sim.value.stores];
    for (let i = storeCount.value; i < sc; i++) stores.push(randomPoint3(used));
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
  const n = Math.max(10, Math.min(200, v));
  if (n > count.value) {
    const used = usedPositions();
    const people = [...sim.value.people];
    for (let i = count.value; i < n; i++) people.push(randomPoint3(used));
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

      <div class="flex-shrink-0 w-full lg:w-[560px]">
        <div ref="mountRef" class="rounded-md border border-slate-800 overflow-hidden" style="width:100%;height:420px;" />
        <p class="text-[11px] text-slate-700 text-center mt-2">ドラッグで回転 / スクロールでズーム</p>
      </div>

      <div class="w-full lg:w-52 flex-shrink-0 divide-y divide-slate-800">

        <div class="pb-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold text-slate-400">ステップ実行</span>
            <label class="text-xs text-slate-500 flex items-center gap-1.5">
              回数
              <input type="number" min="1" max="9999" :value="simCount"
                class="w-14 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200 text-xs text-right disabled:opacity-40"
                :disabled="simRunning"
                @change="simCount = Math.max(1, Number(($event.target as HTMLInputElement).value))" />
            </label>
          </div>
          <button class="w-full py-1.5 text-sm rounded border transition-colors"
            :class="simRunning ? 'border-red-800 text-red-400 hover:bg-red-950/40' : 'border-emerald-800 text-emerald-400 hover:bg-emerald-950/40'"
            @click="runAutoSim">{{ simRunning ? '■ 停止' : '▶ 実行' }}</button>
          <div v-if="simRunning || simProgress > 0" class="mt-1.5 text-[11px] text-slate-600 text-right tabular-nums">{{ simProgress }} / {{ simCount }}</div>
        </div>

        <div class="py-5">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-semibold text-slate-400">市場シェア</span>
            <div class="flex items-center gap-1">
              <button class="w-5 h-5 flex items-center justify-center rounded border border-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed text-xs"
                :disabled="storeCount <= 2 || simRunning" @click="handleStoreCount(storeCount - 1)">－</button>
              <span class="text-xs text-slate-500 w-4 text-center tabular-nums">{{ storeCount }}</span>
              <button class="w-5 h-5 flex items-center justify-center rounded border border-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed text-xs"
                :disabled="storeCount >= 5 || simRunning" @click="handleStoreCount(storeCount + 1)">＋</button>
            </div>
          </div>
          <div v-for="(label, i) in LABELS.slice(0, sim.stores.length)" :key="label" class="mb-3 last:mb-0">
            <div class="flex justify-between items-center mb-1.5">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold" :style="{ color: COLORS_HEX[i] }">{{ label }}</span>
                <button
                  class="text-[10px] px-1.5 py-0.5 rounded border transition-opacity"
                  :style="{ color: animating[i] ? '#475569' : COLORS_HEX[i], borderColor: animating[i] ? '#47556933' : COLORS_HEX[i] + '44' }"
                  :disabled="animating[i] || simRunning"
                  :class="animating[i] || simRunning ? 'cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'"
                  @click="moveToBest(i)"
                >{{ animating[i] ? '移動中' : '最適化' }}</button>
              </div>
              <span class="text-xs tabular-nums" :style="{ color: COLORS_HEX[i] }">{{ percents[i] }}<span class="text-slate-700 text-[10px]">%</span></span>
            </div>
            <div class="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-300" :style="{ width: `${percents[i]}%`, backgroundColor: COLORS_HEX[i] }" />
            </div>
          </div>
          <div class="mt-4 text-[11px] text-slate-700">住民 {{ sim.people.length }} 人</div>
        </div>

        <div class="py-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold text-slate-400">設定</span>
            <span class="text-[11px] text-slate-600 tabular-nums">{{ count }} 人</span>
          </div>
          <input type="range" min="10" max="200" step="10" :value="count" :disabled="simRunning"
            class="w-full accent-blue-500 mb-3 disabled:opacity-40"
            @input="handleCount(Number(($event.target as HTMLInputElement).value))" />
          <button class="w-full py-1.5 text-xs rounded border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="simRunning" @click="randomize">↺ ランダム再配置</button>
        </div>

        <div class="pt-5 text-[11px] leading-relaxed text-slate-600">
          3次元空間でも同様に、競合する店舗は空間の中心に集まる傾向があります（ナッシュ均衡）。
        </div>

      </div>
    </div>
  </div>
</template>
