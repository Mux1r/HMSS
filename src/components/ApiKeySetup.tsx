import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  KeyRound,
  X,
  ExternalLink,
  ClipboardPaste,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { cn } from "../lib/utils";
import { GROQ_KEYS_URL, GroqKeyError, verifyGroqKey } from "../lib/groq";

interface Props {
  open: boolean;
  theme: "light" | "dark";
  currentKey: string;
  onClose: () => void;
  onSave: (key: string) => void;
  onClear: () => void;
}

const STEPS: { title: string; detail: string }[] = [
  { title: "開啟 Groq 金鑰頁面", detail: "點下方紫色按鈕，會在新分頁開啟 Groq 官方網站。" },
  { title: "登入（免費）", detail: "用 Google 帳號或 Email 登入，第一次會自動註冊，不需要信用卡。" },
  { title: "建立金鑰", detail: "按「Create API Key」，名稱隨意（例如 HMSS），再按「Submit」。" },
  { title: "複製金鑰", detail: "按金鑰旁的複製按鈕。金鑰以 gsk_ 開頭，只會顯示這一次。" },
  { title: "回到這裡貼上", detail: "按「貼上」或手動貼到下方欄位，再按「驗證並儲存」。" },
];

const maskKey = (k: string) => (k.length > 10 ? `${k.slice(0, 4)}…${k.slice(-4)}` : "••••");

export default function ApiKeySetup({ open, theme, currentKey, onClose, onSave, onClear }: Props) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "error" | "success">("idle");
  const [message, setMessage] = useState("");
  const dark = theme === "dark";

  useEffect(() => {
    if (open) {
      setInput("");
      setStatus("idle");
      setMessage("");
    }
  }, [open]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInput(text.trim());
    } catch {
      setStatus("error");
      setMessage("瀏覽器不允許自動貼上，請長按欄位手動貼上。");
    }
  };

  const handleVerify = async () => {
    const key = input.trim();
    if (!key) return;
    setStatus("verifying");
    setMessage("");
    try {
      await verifyGroqKey(key);
      onSave(key);
      setStatus("success");
      setMessage("設定完成！現在可以使用 AI 功能了。");
      setTimeout(onClose, 1200);
    } catch (e: any) {
      setStatus("error");
      if (e instanceof GroqKeyError) {
        setMessage(
          key.startsWith("gsk_")
            ? "金鑰無效，請確認是否完整複製，或重新建立一把。"
            : "這看起來不是 Groq 金鑰（應以 gsk_ 開頭），請重新複製。",
        );
      } else {
        setMessage(`無法連線驗證：${e?.message || "網路錯誤"}，請稍後再試。`);
      }
    }
  };

  const muted = dark ? "text-zinc-400" : "text-slate-500";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="apikey-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[150]"
          />
          <motion.div
            key="apikey-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
            className={cn(
              "fixed inset-x-4 top-[6%] bottom-[6%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[500px] md:top-[8%] md:bottom-auto md:max-h-[84%] rounded-3xl border shadow-2xl flex flex-col overflow-hidden z-[160]",
              dark
                ? "bg-zinc-900/95 border-white/10 text-white shadow-black/80"
                : "bg-white border-slate-200 text-slate-900 shadow-slate-900/20",
            )}
          >
            {/* Header */}
            <div
              className={cn(
                "p-5 border-b shrink-0 flex items-center justify-between",
                dark ? "border-white/5 bg-white/[0.02]" : "border-slate-100 bg-slate-50",
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl flex items-center justify-center shrink-0 bg-violet-500/15 text-violet-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">設定你的免費 AI 金鑰</h3>
                  <p className={cn("text-[10px] mt-0.5", muted)}>約 1 分鐘・免費・不需信用卡</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={cn(
                  "p-1.5 rounded-full transition-colors",
                  dark ? "hover:bg-white/10 text-zinc-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-800",
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
              <p className={cn("leading-relaxed text-[11px]", muted)}>
                AI 功能使用你自己的 Groq 金鑰。依照下列步驟操作即可，只需設定一次。
              </p>

              {currentKey && (
                <div
                  className={cn(
                    "flex items-center justify-between gap-2 p-3 rounded-xl border",
                    dark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-200",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-emerald-500 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    已設定：<span className="font-mono">{maskKey(currentKey)}</span>
                  </span>
                  <button
                    onClick={onClear}
                    className="text-[10px] font-bold text-rose-500 hover:underline shrink-0"
                  >
                    移除金鑰
                  </button>
                </div>
              )}

              <ol className="space-y-3">
                {STEPS.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div className="space-y-1 min-w-0">
                      <p className="font-bold text-[12px]">{s.title}</p>
                      <p className={cn("leading-relaxed text-[11px]", muted)}>{s.detail}</p>
                      {i === 0 && (
                        <a
                          href={GROQ_KEYS_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-500/85 text-white font-bold text-[11px] transition-all active:scale-95"
                        >
                          開啟 Groq 金鑰頁面
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              {/* Input */}
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (status === "error") setStatus("idle");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                    placeholder="gsk_..."
                    className={cn(
                      "flex-1 min-w-0 px-3 py-2 rounded-xl border font-mono text-[12px] outline-none focus:border-violet-500",
                      dark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200",
                    )}
                  />
                  <button
                    onClick={handlePaste}
                    className={cn(
                      "px-3 rounded-xl border flex items-center gap-1 font-bold text-[11px] shrink-0",
                      dark ? "border-white/10 hover:bg-white/10" : "border-slate-200 hover:bg-slate-100",
                    )}
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    貼上
                  </button>
                </div>

                {message && (
                  <p
                    className={cn(
                      "flex items-start gap-1.5 text-[11px] leading-relaxed",
                      status === "success" ? "text-emerald-500" : "text-rose-500",
                    )}
                  >
                    {status === "success" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    )}
                    {message}
                  </p>
                )}
              </div>

              <p className={cn("flex items-start gap-1.5 text-[10px] leading-relaxed", muted)}>
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
                金鑰只存在這台裝置的瀏覽器，直接用來呼叫 Groq，不會上傳到 HMSS。免費方案每天約 1,000 次請求，一般使用足夠。
              </p>
            </div>

            {/* Footer */}
            <div
              className={cn(
                "p-4 border-t flex justify-end gap-2 shrink-0",
                dark ? "border-white/5 bg-white/[0.01]" : "border-slate-100 bg-slate-50",
              )}
            >
              <button
                onClick={onClose}
                className={cn(
                  "px-4 py-1.5 rounded-xl font-bold text-[11px] transition-all",
                  dark ? "text-zinc-400 hover:bg-white/10" : "text-slate-500 hover:bg-slate-100",
                )}
              >
                稍後再說
              </button>
              <button
                onClick={handleVerify}
                disabled={!input.trim() || status === "verifying"}
                className="px-4 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-500/85 disabled:opacity-40 text-white font-bold transition-all active:scale-95 shadow-sm text-[11px] flex items-center gap-1.5"
              >
                {status === "verifying" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                驗證並儲存
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
