import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { IconArrow, IconShieldCheck } from "./icons";

export type SheetPayload = {
  icon?: ReactNode;
  title: string;
  desc: string;
  ctaText?: string;
  onCta?: () => void;
};

type SheetCtx = {
  openSheet: (p: SheetPayload) => void;
  closeSheet: () => void;
};

const Ctx = createContext<SheetCtx>({ openSheet: () => {}, closeSheet: () => {} });

export const useSheet = () => useContext(Ctx);

export const SheetProvider = ({ children }: { children: ReactNode }) => {
  const [payload, setPayload] = useState<SheetPayload | null>(null);

  const openSheet = useCallback((p: SheetPayload) => setPayload(p), []);
  const closeSheet = useCallback(() => setPayload(null), []);

  return (
    <Ctx.Provider value={{ openSheet, closeSheet }}>
      {children}
      <div
        className={`scrim${payload ? " show" : ""}`}
        onClick={closeSheet}
        aria-hidden="true"
      />
      <div
        className={`glass sheet${payload ? " show" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!payload}
      >
        <div className="handle" />
        <div className="sheet-icon">{payload?.icon ?? <IconShieldCheck />}</div>
        <h2>{payload?.title ?? ""}</h2>
        <p>{payload?.desc ?? ""}</p>
        <button
          className="cta"
          onClick={() => {
            payload?.onCta?.();
            closeSheet();
          }}
        >
          <span>{payload?.ctaText ?? "Done"}</span>
        </button>
      </div>
    </Ctx.Provider>
  );
};
