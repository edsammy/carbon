import { useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";

export function useKeyboardWedgeNavigation() {
  const [inputBuffer, setInputBuffer] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (/^[a-zA-Z0-9\-./:?=&_]$/.test(event.key)) {
        setInputBuffer((prev) => prev + event.key);
      } else if (event.key === "Enter") {
        if (inputBuffer.startsWith("http")) {
          event.preventDefault();
        }

        if (inputBuffer.startsWith("http")) {
          try {
            const url = new URL(inputBuffer);
            navigate(url.pathname + url.search);
          } catch {
            navigate(inputBuffer);
          }
        }
        setInputBuffer("");
      } else if (event.key === "Escape") {
        setInputBuffer("");
      }
    };

    const timeoutId = setTimeout(() => {
      setInputBuffer("");
    }, 3000);

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timeoutId);
    };
  }, [inputBuffer, navigate]);
}
