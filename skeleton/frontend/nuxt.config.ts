import tailwindcss from "@tailwindcss/vite"

// Nuxt 설정 (ARCHITECTURE.md §13).
// SPA 모드: 백엔드가 별도 FastAPI 서버이고 access 토큰은 메모리, refresh 토큰은
// HttpOnly 쿠키(DB 세션)로 관리하므로 SSR 없이 SPA 로 충분하다.
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

  // 프론트 환경변수 (ARCHITECTURE.md §17). NUXT_PUBLIC_* 로 덮인다 (VITE_ 아님).
  // 예) NUXT_PUBLIC_API_BASE_URL=https://api.example.com → public.apiBaseUrl
  runtimeConfig: {
    public: {
      apiBaseUrl: "",
      backendUrl: "http://localhost:8000",
    },
  },

  // Tailwind v4 는 PostCSS 설정 없이 Vite 플러그인으로 붙인다 (ARCHITECTURE.md §15).
  vite: {
    plugins: [tailwindcss()],
  },

  // dev 서버 포트는 5173 고정 — 백엔드 .env 의 CORS_ORIGINS 와 맞춘다.
  // host 를 지정하지 않으면 nuxt dev 는 [::1](IPv6)에만 바인딩해 127.0.0.1 접속이 거부된다.
  devServer: { port: 5173, host: "0.0.0.0" },

  // dev 프록시: /api → FastAPI. 운영에서는 NUXT_PUBLIC_API_BASE_URL 로 절대 URL 을 준다.
  // dev 는 프록시 덕에 refresh 쿠키가 same-origin 으로 동작한다. 운영에서 다른 오리진을 줄 경우
  // 쿠키(SameSite=Lax)가 전송되려면 same-site(같은 사이트의 서브도메인) 배포가 전제다.
  // /uploads → 백엔드 공개 파일(에디터·배너 이미지, UPLOAD_DIR/public). 백엔드가 주는 파일 URL 은
  // 루트 상대(/uploads/public/...)라 dev 에서도 같은 오리진으로 받게 한다. 운영은 리버스 프록시가
  // /api·/uploads 를 백엔드로 넘기거나, 백엔드 .env 의 PUBLIC_FILES_BASE_URL 로 절대 URL 을 받는다(§17).
  // ⚠️ nitro devProxy 는 prefix 를 벗겨 target 뒤에 붙인다 — target 에 prefix 를 포함해야 한다.
  nitro: {
    devProxy: {
      "/api": { target: "http://localhost:8000/api", changeOrigin: true },
      "/uploads": { target: "http://localhost:8000/uploads", changeOrigin: true },
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
