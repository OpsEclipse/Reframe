import type { ReactNode } from "react";

type CrtFrameProps = {
  children: ReactNode;
};

export function CrtFrame({ children }: CrtFrameProps) {
  return (
    <div className="crt-shell">
      <div className="crt-bezel">
        <div className="crt-screen">
          <div className="crt-content">{children}</div>
          <div aria-hidden="true" className="crt-glass" />
        </div>
      </div>
    </div>
  );
}

