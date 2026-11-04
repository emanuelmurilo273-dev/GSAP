"use client";
import { useMotionLevel } from "./useMotion";
import { useTiltVars } from "./useTiltVars";

/** Moldura de navegador para a prévia; em modo 3D fica inclinada e se endireita ao passar o mouse. */
export function PreviewFrame({ srcDoc, title, mode, width = "100%", height = 640, url = "prévia não publicada" }: { srcDoc: string; title: string; mode: "3d" | "flat"; width?: string | number; height?: number; url?: string }) {
  const level = useMotionLevel();
  const three = mode === "3d" && level !== "flat";
  const ref = useTiltVars<HTMLDivElement>(three);
  return (
    <div ref={ref} className={`pframe-wrap ${three ? "is-3d" : ""}`}>
      <div className="pframe" style={{ width, maxWidth: "100%" }}>
        <div className="pframe-chrome">
          <span className="dots"><b /><b /><b /></span>
          <span className="pframe-url">{url}</span>
          <span className="pframe-badge">PRÉVIA · NÃO PUBLICADA</span>
        </div>
        <iframe title={title} srcDoc={srcDoc} sandbox="allow-scripts allow-popups" style={{ height }} className="block w-full bg-white" />
      </div>
    </div>
  );
}
