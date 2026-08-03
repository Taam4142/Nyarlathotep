export type Status = "comply" | "partial" | "notcomply" | "na";

export type PdfType = "digital" | "scanned";

export interface Row {
  id: string;
  ref: string;
  requirement: string;
  translation: string;
  category: string;
  status: Status;
  remarks: string;
  _warn: boolean;
}

export interface LibItem {
  id: string;
  label: string;
  status: Status;
  text: string;
}

/** Raw shape returned by an AI engine before validation/mapping. */
export interface ExtractedItem {
  ref?: string;
  requirement?: string;
  translation?: string;
  category?: string;
}

/** OCR progress callback: (currentPage, totalPages, percentWithinPage?). */
export type OcrProgress = (
  page: number | null,
  total: number | null,
  pct?: number,
) => void;
