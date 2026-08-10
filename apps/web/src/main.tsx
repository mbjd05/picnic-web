import { StrictMode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { installProductQueryPersistence } from "./lib/product-query-persistence";
import { queryClient, router } from "./app/router";
import { registerServiceWorker } from "./app/register-service-worker";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Application root element is missing");
}

void installProductQueryPersistence(queryClient)
  .catch(() => undefined)
  .finally(() => {
    void registerServiceWorker();

    createRoot(rootElement).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </StrictMode>
    );
  });
