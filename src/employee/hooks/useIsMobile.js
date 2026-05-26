import { useState, useEffect } from "react";

/**
 * Hook phát hiện màn hình mobile (≤ breakpoint px)
 * SSR-safe: khởi tạo từ window.innerWidth nếu đã có DOM
 */
export const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= breakpoint
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [breakpoint]);

  return isMobile;
};
