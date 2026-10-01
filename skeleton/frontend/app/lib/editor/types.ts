import type { Rect, Rotation } from "./imageTransform"

// 에디터 컴포넌트끼리 주고받는 타입 (SFC 의 <script setup> 은 export 를 둘 수 없어 여기 둔다).

/** 자르기 다이얼로그 결과 (components/editor/ImageCropDialog.vue). */
export interface CropResult {
  /** 회전한 이미지 기준 원본 px 사각형. null 이면 전체. */
  crop: Rect | null
  rotate: Rotation
}
