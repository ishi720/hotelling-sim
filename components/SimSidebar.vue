<script setup lang="ts">
import { LABELS, COLORS } from "~/utils/constants";

defineProps<{
  storeCount: number;
  percents: number[];
  animating: boolean[];
  simRunning: boolean;
  simCount: number;
  simProgress: number;
  populationCount: number;
  populationMax: number;
}>();

const emit = defineEmits<{
  storeCountChange: [v: number];
  moveToBest: [i: number];
  simCountChange: [v: number];
  runAutoSim: [];
  populationChange: [v: number];
  randomize: [];
}>();
</script>

<template>
  <div class="w-full lg:w-52 flex-shrink-0 divide-y divide-slate-800">

    <div class="pb-5">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold text-slate-400">ステップ実行</span>
        <label class="text-xs text-slate-500 flex items-center gap-1.5">
          回数
          <input type="number" min="1" max="9999" :value="simCount"
            class="w-14 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200 text-xs text-right disabled:opacity-40"
            :disabled="simRunning"
            @change="emit('simCountChange', Math.max(1, Number(($event.target as HTMLInputElement).value)))" />
        </label>
      </div>
      <button class="w-full py-1.5 text-sm rounded border transition-colors"
        :class="simRunning ? 'border-red-800 text-red-400 hover:bg-red-950/40' : 'border-emerald-800 text-emerald-400 hover:bg-emerald-950/40'"
        @click="emit('runAutoSim')">{{ simRunning ? '■ 停止' : '▶ 実行' }}</button>
      <div v-if="simRunning || simProgress > 0" class="mt-1.5 text-[11px] text-slate-600 text-right tabular-nums">{{ simProgress }} / {{ simCount }}</div>
    </div>

    <div class="py-5">
      <div class="flex items-center justify-between mb-4">
        <span class="text-xs font-semibold text-slate-400">競合店舗</span>
        <div class="flex items-center gap-1">
          <button class="w-5 h-5 flex items-center justify-center rounded border border-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed text-xs"
            :disabled="storeCount <= 2 || simRunning" @click="emit('storeCountChange', storeCount - 1)">－</button>
          <span class="text-xs text-slate-500 w-4 text-center tabular-nums">{{ storeCount }}</span>
          <button class="w-5 h-5 flex items-center justify-center rounded border border-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed text-xs"
            :disabled="storeCount >= 5 || simRunning" @click="emit('storeCountChange', storeCount + 1)">＋</button>
        </div>
      </div>
      <div v-for="(label, i) in LABELS.slice(0, storeCount)" :key="label" class="mb-3 last:mb-0">
        <div class="flex justify-between items-center mb-1.5">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold" :style="{ color: COLORS[i] }">{{ label }}</span>
            <button
              class="text-[10px] px-1.5 py-0.5 rounded border transition-opacity"
              :style="{ color: animating[i] ? '#475569' : COLORS[i], borderColor: animating[i] ? '#47556933' : COLORS[i] + '44' }"
              :disabled="animating[i] || simRunning"
              :class="animating[i] || simRunning ? 'cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'"
              @click="emit('moveToBest', i)"
            >{{ animating[i] ? '移動中' : '最適化' }}</button>
          </div>
          <span class="text-xs tabular-nums" :style="{ color: COLORS[i] }">{{ percents[i] }}<span class="text-slate-700 text-[10px]">%</span></span>
        </div>
        <div class="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-300" :style="{ width: `${percents[i]}%`, backgroundColor: COLORS[i] }" />
        </div>
      </div>
    </div>

    <div class="py-5">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold text-slate-400">住民数</span>
        <span class="text-[11px] text-slate-600 tabular-nums">{{ populationCount }} 人</span>
      </div>
      <input type="range" min="10" :max="populationMax" step="10" :value="populationCount" :disabled="simRunning"
        class="w-full accent-blue-500 mb-3 disabled:opacity-40"
        @input="emit('populationChange', Number(($event.target as HTMLInputElement).value))" />
      <button class="w-full py-1.5 text-xs rounded border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="simRunning" @click="emit('randomize')">↺ ランダム再配置</button>
    </div>

  </div>
</template>
