import { ref } from "vue";
import type { ComputedRef } from "vue";

export function useSimState(initialCount = 100) {
  const storeCount = ref(2);
  const count = ref(initialCount);
  const simCount = ref(100);
  const simRunning = ref(false);
  const simProgress = ref(0);
  const animating = ref<boolean[]>(Array(2).fill(false));
  const lastMovedIdx = ref<number | null>(null);

  function buildRunAutoSim(
    counts: ComputedRef<number[]>,
    moveToBest: (idx: number) => Promise<void>
  ) {
    return async function runAutoSim() {
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
    };
  }

  return { storeCount, count, simCount, simRunning, simProgress, animating, lastMovedIdx, buildRunAutoSim };
}
