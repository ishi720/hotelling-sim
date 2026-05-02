<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";

// 定数
const N = 80;
const PX = 560;
const S = PX / N;

// 型
interface Point {
  x: number;
  y: number;
}
interface SimState {
  storeA: Point;
  storeB: Point;
  people: Point[];
}

// ユーティリティ
const dist = (a: Point, b: Point) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
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

function createSim(n: number): SimState {
  const used = new Set<string>();
  const storeA = randomPoint(used);
  const storeB = randomPoint(used);
  const people = Array.from({ length: n }, () => randomPoint(used));
  return { storeA, storeB, people };
}

// リアクティブ状態
const count = ref(100);
const sim = ref<SimState>(createSim(100));
const drag = ref<"A" | "B" | null>(null);
const cvRef = ref<HTMLCanvasElement | null>(null);

// 計算プロパティ
const cA = computed(() =>
  sim.value.people.filter(
    (p) => dist(p, sim.value.storeA) <= dist(p, sim.value.storeB)
  ).length
);
const cB = computed(() => sim.value.people.length - cA.value);
const pA = computed(() =>
  sim.value.people.length
    ? Math.round((cA.value / sim.value.people.length) * 100)
    : 0
);
const pB = computed(() => 100 - pA.value);

// Canvas 描画
function draw() {
  const cv = cvRef.value;
  if (!cv) return;
  const ctx = cv.getContext("2d");
  if (!ctx) return;

  const { storeA, storeB, people } = sim.value;

  // 背景
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, PX, PX);

  // エリア色分け（ボロノイ領域）
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const isA = dist({ x, y }, storeA) <= dist({ x, y }, storeB);
      ctx.fillStyle = isA ? "rgba(59,130,246,0.22)" : "rgba(239,68,68,0.22)";
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
    const isA = dist(p, storeA) <= dist(p, storeB);
    ctx.beginPath();
    ctx.arc(toPx(p.x), toPx(p.y), 2.5, 0, Math.PI * 2);
    ctx.fillStyle = isA ? "rgba(147,197,253,0.9)" : "rgba(252,165,165,0.9)";
    ctx.fill();
  }

  // 店舗マーカー
  const drawStore = (s: Point, label: string, color: string) => {
    const cx = toPx(s.x);
    const cy = toPx(s.y);
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy);
  };

  drawStore(storeA, "A", "#3b82f6");
  drawStore(storeB, "B", "#ef4444");
}

watch(sim, draw, { deep: true });
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
  const pos = getPos(e);
  if (dist(pos, sim.value.storeA) < 4) {
    drag.value = "A";
    e.preventDefault();
  } else if (dist(pos, sim.value.storeB) < 4) {
    drag.value = "B";
    e.preventDefault();
  }
}

function onMove(e: MouseEvent | TouchEvent) {
  if (!drag.value) return;
  e.preventDefault();
  const pos = getPos(e);
  const other =
    drag.value === "A" ? sim.value.storeB : sim.value.storeA;
  if (pos.x === other.x && pos.y === other.y) return;
  sim.value = { ...sim.value, [`store${drag.value}`]: pos };
}

function onUp() {
  drag.value = null;
}

// コントロール
function handleCount(v: number) {
  const n = Math.max(10, Math.min(500, v));
  count.value = n;
  sim.value = createSim(n);
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
            cursor: drag ? 'grabbing' : 'grab',
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
          <p class="text-xs text-gray-500 tracking-widest uppercase mb-3">
            市場シェア
          </p>

          <div class="mb-3">
            <div class="flex justify-between items-baseline mb-1">
              <span class="text-blue-400 text-sm font-medium">店舗 A</span>
              <span class="text-blue-400">
                {{ cA }}
                <span class="text-gray-500 text-xs ml-1">({{ pA }}%)</span>
              </span>
            </div>
            <div class="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-blue-500 rounded-full transition-all duration-300"
                :style="{ width: `${pA}%` }"
              />
            </div>
          </div>

          <div>
            <div class="flex justify-between items-baseline mb-1">
              <span class="text-red-400 text-sm font-medium">店舗 B</span>
              <span class="text-red-400">
                {{ cB }}
                <span class="text-gray-500 text-xs ml-1">({{ pB }}%)</span>
              </span>
            </div>
            <div class="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-red-500 rounded-full transition-all duration-300"
                :style="{ width: `${pB}%` }"
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
            class="w-full accent-blue-500 mb-3"
            @input="handleCount(Number(($event.target as HTMLInputElement).value))"
          />
          <button
            class="w-full py-2 text-sm rounded-lg border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors"
            @click="randomize"
          >
            ↺ ランダム再配置
          </button>
        </div>

        <!-- 使い方 -->
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p class="text-xs text-gray-500 tracking-widest uppercase mb-2">
            使い方
          </p>
          <p class="text-xs text-gray-400 leading-relaxed">
            店舗 A・B をドラッグして位置を変更できます。各住民は最も近い店舗を利用します。
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
