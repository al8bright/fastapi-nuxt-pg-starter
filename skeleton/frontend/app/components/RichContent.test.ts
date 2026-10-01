import { mount } from "@vue/test-utils"
import { describe, expect, it } from "vitest"
import RichContent from "./RichContent.vue"

describe("RichContent", () => {
  it(".rich-text 래퍼 안에 (서버가 정화한) HTML 을 그대로 렌더한다", () => {
    const wrapper = mount(RichContent, {
      props: { html: `<h2 class="align-center">제목</h2><ul><li>항목</li></ul>` },
      attrs: { class: "mt-4" },
    })
    const root = wrapper.element as HTMLElement
    expect(root.classList.contains("rich-text")).toBe(true)
    expect(root.classList.contains("mt-4")).toBe(true)
    expect(root.querySelector("h2.align-center")?.textContent).toBe("제목")
    expect(root.querySelector("ul > li")?.textContent).toBe("항목")
  })
})
