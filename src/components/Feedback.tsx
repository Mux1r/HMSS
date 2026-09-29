import { useEffect, useState, type ClipboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ImagePlus, Loader2, Send, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../lib/supabase";

interface Props {
  open: boolean;
  theme: "light" | "dark";
  email?: string;
  onClose: () => void;
  onSent: () => void;
}

const MAX_LEN = 2000;

// 截圖縮到長邊 1600px 再轉 JPEG：手機截圖從幾 MB 降到幾百 KB，上傳快也省空間。
async function shrinkImage(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("圖片轉檔失敗"))), "image/jpeg", 0.85),
  );
}

export default function Feedback({ open, theme, email, onClose, onSent }: Props) {
  const [message, setMessage] = useState("");
  // 刻意只收一張截圖；需要多張再改成陣列。
  const [image, setImage] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const dark = theme === "dark";

  useEffect(() => {
    if (!image) return setPreview("");
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const pickImage = async (file: Blob | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setError("");
    try {
      setImage(await shrinkImage(file));
    } catch {
      setError("這張圖片讀不到，請換一張試試");
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
    if (item) {
      e.preventDefault();
      pickImage(item.getAsFile());
    }
  };

  const submit = async () => {
    const text = message.trim();
    if (!text) return setError("請先寫一下發生了什麼事");
    setSending(true);
    setError("");
    try {
      let screenshot: string | null = null;
      if (image) {
        screenshot = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from("feedback").upload(screenshot, image, { contentType: "image/jpeg" });
        if (up.error) throw new Error(`截圖上傳失敗：${up.error.message}`);
      }
      const { error: dbError } = await supabase.from("feedback").insert({
        message: text,
        screenshot,
        email: email || null,
        app_version: __APP_VERSION__,
        user_agent: navigator.userAgent.slice(0, 300),
      });
      if (dbError) throw new Error(`送出失敗：${dbError.message}`);
      // 成功才清空；失敗時保留內容，讓使用者可以直接重送。
      setMessage("");
      setImage(null);
      onSent();
    } catch (e: any) {
      setError(e?.message || "送出失敗，請稍後再試");
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="feedback-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[170]"
          />
          <motion.div
            key="feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
            className={cn(
              "fixed inset-x-4 top-[8%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[480px] max-h-[84vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden z-[180]",
              dark ? "bg-zinc-900/95 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900",
            )}
          >
            <div className={cn("p-5 border-b flex items-center justify-between shrink-0", dark ? "border-white/5" : "border-slate-100")}>
              <div>
                <h3 id="feedback-title" className="text-sm font-bold">意見回報</h3>
                <p className={cn("text-[11px] mt-0.5", dark ? "text-zinc-500" : "text-slate-400")}>
                  遇到錯誤或有建議都可以寫在這裡
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="關閉"
                className={cn("p-1.5 rounded-full", dark ? "hover:bg-white/10 text-zinc-400" : "hover:bg-slate-100 text-slate-500")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <label className="block space-y-1.5">
                <span className="font-bold">發生了什麼事？</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
                  onPaste={onPaste}
                  rows={6}
                  placeholder="例如：查「頭痛」時，列表最上面出現不相關的藥。電腦上可以直接貼上截圖。"
                  className={cn(
                    "w-full rounded-xl border p-3 text-sm leading-relaxed resize-none outline-none focus:ring-2 focus:ring-brand-accent/40",
                    dark ? "bg-white/5 border-white/10 placeholder:text-zinc-600" : "bg-slate-50 border-slate-200 placeholder:text-slate-400",
                  )}
                />
                <span className={cn("block text-right text-[10px]", dark ? "text-zinc-600" : "text-slate-400")}>
                  {message.length}/{MAX_LEN}
                </span>
              </label>

              {preview ? (
                <div className="relative">
                  <img src={preview} alt="要附上的截圖" className="w-full max-h-56 object-contain rounded-xl border border-inherit" />
                  <button
                    onClick={() => setImage(null)}
                    aria-label="移除截圖"
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  className={cn(
                    "flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed cursor-pointer",
                    dark ? "border-white/15 text-zinc-400 hover:bg-white/5" : "border-slate-300 text-slate-500 hover:bg-slate-50",
                  )}
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>附上截圖（選填）</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickImage(e.target.files?.[0])} />
                </label>
              )}

              {error && <p role="alert" className="text-rose-500 font-medium">{error}</p>}

              <p className={cn("text-[10px] leading-relaxed", dark ? "text-zinc-500" : "text-slate-400")}>
                會一起送出目前的版本號和瀏覽器類型，方便找問題{email ? `；你已登入，也會附上 ${email} 方便回覆` : ""}。請不要寫病人的姓名或病歷號。
              </p>
            </div>

            <div className={cn("p-4 border-t flex justify-end shrink-0", dark ? "border-white/5" : "border-slate-100")}>
              <button
                onClick={submit}
                disabled={sending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-accent hover:bg-brand-accent/80 disabled:opacity-60 text-white font-bold text-xs"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {sending ? "送出中…" : "送出"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
