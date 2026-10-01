import { type EditorImageResponse, createEditorUploader, EDITOR_IMAGE_ENDPOINT, resolveUploadUrl } from "~/lib/editor/upload"

// 업로드 파일 주소·에디터 이미지 업로드 (editor-spec §0-7·§4 ⑤).

/**
 * 백엔드가 준 파일 URL(`/uploads/...`)을 브라우저 주소로 바꾸는 함수.
 * 백엔드를 다른 오리진(NUXT_PUBLIC_API_BASE_URL)에 둔 경우에만 그 오리진을 붙인다 — dev 는 devProxy(/uploads).
 */
export function useFileUrl(): (url: string) => string {
  const { public: publicConfig } = useRuntimeConfig()
  return (url) => resolveUploadUrl(url, publicConfig.apiBaseUrl)
}

/**
 * 관리자 에디터의 uploadImage — `POST /admin/editor/images` (multipart `file`).
 * 공용 $api 를 쓰므로 Bearer 주입·401 refresh·재시도가 그대로 적용된다. 실패는 reject 대신 `{ error }`.
 * ⚠️ setup 에서 한 번 만들어 prop 으로 넘긴다(이벤트 핸들러 안에서 useNuxtApp 을 부르지 않도록).
 */
export function useEditorImageUpload() {
  const { $api } = useNuxtApp()
  const { public: publicConfig } = useRuntimeConfig()
  return createEditorUploader(
    (form) => $api<EditorImageResponse>(EDITOR_IMAGE_ENDPOINT, { method: "POST", body: form }),
    publicConfig.apiBaseUrl,
  )
}
