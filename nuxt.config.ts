// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: ["@nuxtjs/tailwindcss"],

  css: ["~/assets/css/main.css"],

  app: {
    baseURL: '/hotelling-sim/',
    head: {
      title: "ホテリングの法則シミュレーション",
      script: [
        { src: "https://www.googletagmanager.com/gtag/js?id=G-KH1ZJRPR4J", async: true },
        {
          innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-KH1ZJRPR4J');`,
        },
      ],
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
