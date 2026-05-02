// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: ["@nuxtjs/tailwindcss"],

  css: ["~/assets/css/main.css"],

  app: {
    head: {
      title: "ホテリングの法則シミュレーション",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "競合店舗の立地戦略をシミュレーションするインタラクティブツール",
        },
      ],
    },
  },

  compatibilityDate: "2024-11-01",
});
