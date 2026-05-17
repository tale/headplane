import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "~/tailwind.css";
import { App } from "./app";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Unable to find root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
