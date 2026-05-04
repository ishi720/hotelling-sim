<script setup lang="ts">
const route = useRoute();
const tabs = [
  { label: "1次元", path: "/1d" },
  { label: "2次元", path: "/2d" },
  { label: "3次元", path: "/3d" },
];
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-200">
    <header class="flex items-center gap-6 px-8 h-12 border-b border-slate-800">
      <span class="text-sm font-medium text-slate-300">ホテリングの法則</span>
      <nav class="flex h-full">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.path"
          :to="tab.path"
          class="px-3 h-full flex items-center text-sm transition-colors border-b-2 -mb-px"
          :class="route.path === tab.path
            ? 'border-blue-500 text-white'
            : 'border-transparent text-slate-500 hover:text-slate-300'"
        >
          {{ tab.label }}
        </NuxtLink>
      </nav>
    </header>
    <NuxtPage />
  </div>
</template>
