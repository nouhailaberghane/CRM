declare module "html2canvas" {
  export default function html2canvas(
    element: HTMLElement,
    options?: { backgroundColor?: string | null }
  ): Promise<HTMLCanvasElement>;
}
