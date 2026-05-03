<script setup lang="ts">
const route = useRoute();
const tabs = [
  { label: "1次元", path: "/1d" },
  { label: "2次元", path: "/" },
  { label: "3次元", path: "/3d" },
];
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <nav class="flex justify-center gap-2 pt-4 pb-0">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="px-4 py-1.5 text-sm rounded-t-lg border border-b-0 transition-colors"
        :class="route.path === tab.path
          ? 'bg-gray-900 border-gray-700 text-white'
          : 'border-transparent text-gray-500 hover:text-gray-300'"
      >
        {{ tab.label }}
      </NuxtLink>
    </nav>
    <NuxtPage />
  </div>
</template>
