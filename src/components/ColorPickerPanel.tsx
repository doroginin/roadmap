import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  view: "resource" | "task";
  teamFnKey: string;
  anchor: { x: number; y: number };
  initialColors: { bg: string; text: string };
  onApply(bg: string, text: string): void;
  onCancel(): void;
  onCloseOutside(): void;
};

export function ColorPickerPanel(props: Props) {
  const { anchor, initialColors, onApply, onCancel, onCloseOutside } = props;
  const [bg, setBg] = useState(initialColors.bg);
  const [text, setText] = useState(initialColors.text);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: anchor.x, top: anchor.y });


  // Position within viewport bounds
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = anchor.x;
    let top = anchor.y;

    if (left + rect.width + pad > vw) left = Math.max(pad, vw - rect.width - pad);
    if (top + rect.height + pad > vh) top = Math.max(pad, vh - rect.height - pad);

    setPos({ left, top });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onCloseOutside();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseOutside();
      }
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onCloseOutside]);

  const content = (
    <div
      ref={panelRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg p-3"
      style={{ left: pos.left, top: pos.top, zIndex: 9999, backgroundColor: "#ffffff" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          className="min-h-[64px] rounded border border-gray-200 flex items-center justify-center p-3"
          style={{ backgroundColor: bg, color: text }}
        >
          Пример
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">Выбор цветов</div>

          <label className="text-xs text-gray-500">Фон</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bg}
              onChange={(e) => { setBg(e.currentTarget.value); }}
              className="h-9 w-12 p-0 border rounded cursor-pointer"
            />
            <span className="text-xs text-gray-500">{bg}</span>
          </div>

          <label className="text-xs text-gray-500 mt-2">Текст</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={text}
              onChange={(e) => { setText(e.currentTarget.value); }}
              className="h-9 w-12 p-0 border rounded cursor-pointer"
            />
            <span className="text-xs text-gray-500">{text}</span>
          </div>

          <div className="mt-2 flex gap-2 justify-end">
            <button
              type="button"
              className="px-3 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200"
              onClick={() => { onCancel(); }}
            >
              Отмена
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => { onApply(bg, text); }}
            >
              Ок
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render via portal to body
  return createPortal(content, document.body);
}