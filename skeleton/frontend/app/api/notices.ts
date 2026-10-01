import { cleanParams, fileForm, type Page, type PageParams } from "./common"

// 공지사항 API (백엔드 schemas/notice.py 와 동기화, ARCHITECTURE.md §8).
// 날짜는 KST naive ISO 문자열이다. $api 를 쓰므로 setup·컴포저블 컨텍스트에서 useNoticesApi() 를 꺼내 둔다.

export interface Attachment {
  id: number
  original_name: string
  size_bytes: number
  content_type: string
  /** 공개 다운로드 URL(게시된 공지만 동작). 관리자 화면은 downloadAdminAttachment 를 쓴다. */
  download_url: string
}

export interface NoticeListItem {
  id: number
  title: string
  is_pinned: boolean
  published_at: string | null
  view_count: number
  has_attachments: boolean
}

export interface NoticeDetail {
  id: number
  title: string
  /** 서버가 저장 시 정화한 HTML — RichContent 에 그대로 넣는다. */
  body_html: string
  is_pinned: boolean
  published_at: string | null
  view_count: number
  created_at: string
  updated_at: string
  attachments: Attachment[]
}

export interface AdminNoticeListItem {
  id: number
  title: string
  is_pinned: boolean
  is_published: boolean
  published_at: string | null
  view_count: number
  has_attachments: boolean
  author_id: number | null
  author_username: string | null
  created_at: string
  updated_at: string
}

export interface AdminNoticeDetail extends AdminNoticeListItem {
  body_html: string
  attachments: Attachment[]
}

/** 생성(POST)·수정(PUT) 공통 본문 — PUT 은 전체 교체. */
export interface NoticeWrite {
  title: string
  body_html: string
  is_pinned: boolean
  is_published: boolean
}

export function useNoticesApi() {
  const { $api } = useNuxtApp()

  return {
    // ---------- 공개 ----------
    listNotices: (params: PageParams = {}) =>
      $api<Page<NoticeListItem>>("/notices", { query: cleanParams(params) }),
    /** 상세 — 서버가 조회수를 올린 뒤의 값을 준다. 임시저장·미존재는 404. */
    getNotice: (id: number) => $api<NoticeDetail>(`/notices/${id}`),

    // ---------- 관리자 ----------
    listAdminNotices: (params: PageParams = {}) =>
      $api<Page<AdminNoticeListItem>>("/admin/notices", { query: cleanParams(params) }),
    getAdminNotice: (id: number) => $api<AdminNoticeDetail>(`/admin/notices/${id}`),
    createNotice: (body: NoticeWrite) => $api<AdminNoticeDetail>("/admin/notices", { method: "POST", body }),
    updateNotice: (id: number, body: NoticeWrite) =>
      $api<AdminNoticeDetail>(`/admin/notices/${id}`, { method: "PUT", body }),
    deleteNotice: (id: number) => $api(`/admin/notices/${id}`, { method: "DELETE" }),
    /** 첨부 업로드 — multipart `file`. 413 용량, 422 형식, 409 10개 초과. */
    uploadAttachment: (noticeId: number, file: File) =>
      $api<Attachment>(`/admin/notices/${noticeId}/attachments`, { method: "POST", body: fileForm(file, file.name) }),
    deleteAttachment: (noticeId: number, attachmentId: number) =>
      $api(`/admin/notices/${noticeId}/attachments/${attachmentId}`, { method: "DELETE" }),
    /** 관리자 다운로드(임시저장 공지 포함) — Bearer 가 필요해 <a href> 로 못 받는다 → blob 으로 받는다. */
    downloadAdminAttachment: (noticeId: number, attachmentId: number) =>
      $api<Blob>(`/admin/notices/${noticeId}/attachments/${attachmentId}`, { responseType: "blob" }),
  }
}
