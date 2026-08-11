// @nuxt/eslint 가 nuxt prepare 시 .nuxt/eslint.config.mjs 를 생성한다 (Nuxt 규약 기반 flat config).
// 그래서 postinstall 에 nuxt prepare 가 필요하다 — 없으면 eslint 가 이 import 를 못 찾는다.
import withNuxt from "./.nuxt/eslint.config.mjs"

export default withNuxt({
  ignores: [".nuxt", ".output", "dist", "node_modules"],
})
