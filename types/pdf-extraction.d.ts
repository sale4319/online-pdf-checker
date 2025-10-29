declare module "pdf-extraction" {
  interface PDFPage {
    pageInfo?: {
      num: number;
      scale: number;
      rotation: number;
      offsetX: number;
      offsetY: number;
      width: number;
      height: number;
    };
  }

  interface PDFData {
    text: string;
    pages?: PDFPage[];
    info?: Record<string, unknown>;
  }

  function extract(buffer: Buffer): Promise<PDFData>;

  export = extract;
}
