import tailwindcss from "@tailwindcss/vite"

// Nuxt 설정 (architecture.md §13).
// SPA 모드: 백엔드가 별도 FastAPI 서버이고 JWT 를 localStorage 에 두므로 SSR 을 쓰지 않는다.
// ssr: false + nuxt generate → 빈 셸(index.html) + SPA fallback(200.html) 만 미리 만들고 렌더링은 전부 브라우저에서 한다.
// https://nuxt.com/docs/api/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2026-08-01",
  ssr: false,

  modules: ["@nuxt/eslint", "@pinia/nuxt"],

  // 소스는 app/ 아래에 둔다 (Nuxt 4 기본 규약 — srcDir 을 따로 지정할 필요가 없다).
  css: ["~/assets/css/main.css"],

  app: {
    head: {
      htmlAttrs: { lang: "ko" },
      title: "__PROJECT_NAME__",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      ],
    },
  },

  // 프론트 환경변수 (architecture.md §17). NUXT_PUBLIC_* 로 덮인다 (VITE_ 아님).
  // 예) NUXT_PUBLIC_API_BASE_URL=https://api.example.com → public.apiBaseUrl
  runtimeConfig: {
    public: {
      apiBaseUrl: "",
      backendUrl: "http://localhost:8000",
    },
  },

  // Tailwind v4 는 PostCSS 설정 없이 Vite 플러그인으로 붙인다 (architecture.md §15).
  vite: {
    plugins: [tailwindcss()],
  },

  // dev 서버 포트는 5173 고정 — 백엔드 .env 의 CORS_ORIGINS 와 맞춘다.
  // host 를 지정하지 않으면 nuxt dev 는 [::1](IPv6)에만 바인딩해 127.0.0.1 접속이 거부된다.
  devServer: { port: 5173, host: "0.0.0.0" },

  // dev 프록시: /api → FastAPI. 운영에서는 NUXT_PUBLIC_API_BASE_URL 로 절대 URL 을 준다.
  nitro: {
    devProxy: {
      "/api": { target: "http://localhost:8000/api", changeOrigin: true },
    },
  },

  eslint: {
    config: {
      // 코드 스타일(세미콜론/따옴표)은 규칙으로 강제하지 않는다 — 포매터 없이 운영한다.
      stylistic: false,
    },
  },

  devtools: { enabled: false },
})
