import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { cn } from "../lib/utils";

export interface TourStep {
  target: string; // 畫面元素上的 data-tour 值
  title: string;
  body: string;
}

interface Props {
  steps: TourStep[];
  theme: "light" | "dark";
  onClose: () => void;
}

// 引導教學：把目標元素用聚光燈框起來，旁邊放說明卡。找不到目標時說明卡置中。
export default function Tour({ steps, theme, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[index];
  const dark = theme === "dark";

  // 找到目標、捲到畫面中間，量位置；視窗大小改變時重量
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) return setRect(null);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    const t = window.setTimeout(measure, 350); // 等捲動結束再量一次
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [step.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length, onClose]);

  const pad = 6;
  const last = index === steps.length - 1;
  // 說明卡放在目標下方；下方空間不夠就放上方
  const below = rect ? rect.bottom + 200 < window.innerHeight : true;
  const cardStyle: CSSProperties = rect
    ? {
        left: Math.min(Math.max(12, rect.left), window.innerWidth - 12 - Math.min(340, window.innerWidth - 24)),
        ...(below ? { top: rect.bottom + pad + 10 } : { bottom: window.innerHeight - rect.top + pad + 10 }),
      }
    : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        (() => {
          // 聚光燈：用上下左右四塊暗色蓋住目標以外的地方（刻意不用超大陰影，瀏覽器可能不畫）
          const l = rect.left - pad, t = rect.top - pad, w = rect.width + pad * 2, h = rect.height + pad * 2;
          const shade = "absolute bg-black/60";
          return (
            <>
              <div className={shade} style={{ left: 0, right: 0, top: 0, height: Math.max(0, t) }} />
              <div className={shade} style={{ left: 0, right: 0, top: t + h, bottom: 0 }} />
              <div className={shade} style={{ left: 0, width: Math.max(0, l), top: t, height: h }} />
              <div className={shade} style={{ left: l + w, right: 0, top: t, height: h }} />
              <div
                className="absolute rounded-xl outline outline-2 outline-amber-400 pointer-events-none"
                style={{ left: l, top: t, width: w, height: h }}
              />
            </>
          );
        })()
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}
      <div
        className={cn(
          "absolute w-[min(340px,calc(100vw-24px))] rounded-2xl border shadow-2xl p-4 space-y-3",
          dark ? "bg-zinc-900 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900",
        )}
        style={cardStyle}
      >
        <div>
          <p className={cn("text-[11px] font-bold", dark ? "text-zinc-400" : "text-slate-500")}>
            {index + 1} / {steps.length}
          </p>
          <h3 id="tour-title" className="text-base font-bold mt-0.5">{step.title}</h3>
          <p className={cn("text-sm leading-relaxed mt-1", dark ? "text-zinc-300" : "text-slate-600")}>{step.body}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className={cn("text-xs font-bold mr-auto", dark ? "text-zinc-400" : "text-slate-500")}>
            結束
          </button>
          {index > 0 && (
            <button
              onClick={() => setIndex(index - 1)}
              className={cn("px-3 h-9 rounded-xl border text-xs font-bold", dark ? "border-white/10" : "border-slate-200")}
            >
              上一步
            </button>
          )}
          <button
            autoFocus
            onClick={() => (last ? onClose() : setIndex(index + 1))}
            className="px-4 h-9 rounded-xl bg-brand-accent text-white text-xs font-bold"
          >
            {last ? "完成" : "下一步"}
          </button>
        </div>
      </div>
    </div>
  );
}
