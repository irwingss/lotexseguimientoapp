"use client";

import React, { useEffect, useRef } from "react";

type Props = {
  action?: ((formData: FormData) => Promise<any>) | undefined;
  className?: string;
  children: React.ReactNode;
  // Optional human-readable description for debugging/UX
  offlineDesc?: string;
  // Endpoint to POST queued mutations to when back online
  endpoint?: string;
};

type QueuedItem = {
  id: string;
  endpoint: string;
  createdAt: string; // ISO
  fields: [string, FormDataEntryValue][];
  offlineDesc?: string;
};

const STORAGE_KEY = "offlineMutationQueue";
let listenerStarted = false;

function loadQueue(): QueuedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(items: QueuedItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

async function flushQueueOnce() {
  const items = loadQueue();
  if (!items.length) return;

  const remaining: QueuedItem[] = [];
  for (const item of items) {
    try {
      const fd = new FormData();
      for (const [k, v] of item.fields) {
        // Only string values expected here; if File is used in the future, this preserves it.
        fd.append(k, v as any);
      }
      const res = await fetch(item.endpoint, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        // Keep it for retry on next online event
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }
  saveQueue(remaining);
}

function startGlobalListener() {
  if (listenerStarted) return;
  listenerStarted = true;
  window.addEventListener("online", () => {
    flushQueueOnce();
  });
}

export const OfflineQueueForm = React.forwardRef<HTMLFormElement, Props>(function OfflineQueueForm(
  { action, className, children, offlineDesc, endpoint }: Props,
  ref
) {
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    // Try a flush on first mount (in case the app was reopened online)
    if (typeof window !== "undefined") {
      startGlobalListener();
      if (navigator.onLine) {
        flushQueueOnce();
      }
    }
  }, []);

  return (
    <form
      ref={(node) => {
        formRef.current = node;
        if (typeof ref === "function") ref(node as HTMLFormElement);
        else if (ref && typeof (ref as any) === "object") (ref as React.MutableRefObject<HTMLFormElement | null>).current = node;
      }}
      action={action as any}
      method="POST"
      className={className}
      onSubmit={async (e) => {
        if (typeof window === "undefined") return;
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        const fd = new FormData(form);
        const targetEndpoint = endpoint || window.location.pathname;

        if (navigator.onLine) {
          // Submit via fetch to avoid navigation to JSON endpoints
          try {
            const res = await fetch(targetEndpoint, {
              method: "POST",
              body: fd,
              credentials: "include",
            });
            if (!res.ok) {
              const msg = await res.text();
              // eslint-disable-next-line no-alert
              alert(`Error al enviar: ${msg || res.status}`);
            }
          } catch (err: any) {
            // eslint-disable-next-line no-alert
            alert(`Error de red: ${err?.message || "desconocido"}`);
          }
          return;
        }

        // Offline: queue for later
        const entries: [string, FormDataEntryValue][] = [];
        for (const pair of fd.entries()) entries.push([pair[0], pair[1]]);
        const item: QueuedItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          endpoint: targetEndpoint,
          createdAt: new Date().toISOString(),
          fields: entries,
          offlineDesc,
        };
        const queue = loadQueue();
        queue.push(item);
        saveQueue(queue);
        try {
          // eslint-disable-next-line no-alert
          alert("Sin conexión: acción encolada. Se enviará automáticamente al reconectarse.");
        } catch {}
      }}
    >
      {children}
    </form>
  );
});
