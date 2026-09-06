// https://nuxt.com/docs/api/configuration/nuxt-config

// Googleアナリティクスの測定ID
const gaId = process.env.GA_ID;

export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: ["@nuxtjs/tailwindcss"],

  css: ["~/assets/css/main.css"],

  app: {
    baseURL: '/hotelling-sim/',
    head: {
      title: "ホテリングの法則シミュレーション",
      script: gaId
        ? [
            { src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`, async: true },
            {
              innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
            },
          ]
        : [],
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
