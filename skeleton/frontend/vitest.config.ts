import { fileURLToPath } from "node:url"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vitest/config"

// 단위 테스트 (ARCHITECTURE.md §13 "프론트 테스트"). Nuxt 런타임 없이 도는 것만 대상으로 한다 —
// 순수 모듈(app/lib/**)과 Nuxt 자동 import 에 기대지 않는 컴포넌트(에디터·RichContent).
// ⛔ 페이지·레이아웃·useAsyncData 를 쓰는 컴포넌트는 Nuxt 런타임이 필요해 여기서 테스트하지 않는다.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
      "@": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["app/**/*.test.ts"],
  },
})
