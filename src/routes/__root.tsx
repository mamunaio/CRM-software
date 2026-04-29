import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { NotificationProvider } from "@/lib/notifications";
import "@/i18n";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Pinnacle CRM — Agency & Freelance CRM" },
      {
        name: "description",
        content:
          "Professional CRM for agencies and freelancers — leads, clients, deals, invoices, and tasks in one workspace.",
      },
      { property: "og:title", content: "Pinnacle CRM — Agency & Freelance CRM" },
      { name: "twitter:title", content: "Pinnacle CRM — Agency & Freelance CRM" },
      { name: "description", content: "Agency & Freelance CRM for managing leads, clients, deals, invoices, and tasks." },
      { property: "og:description", content: "Agency & Freelance CRM for managing leads, clients, deals, invoices, and tasks." },
      { name: "twitter:description", content: "Agency & Freelance CRM for managing leads, clients, deals, invoices, and tasks." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a5ce2697-0d60-4a29-9814-db8020b648e4/id-preview-a5c3a462--54ee14d9-2dae-448d-8cc4-4db811c66acb.lovable.app-1777397838501.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a5ce2697-0d60-4a29-9814-db8020b648e4/id-preview-a5c3a462--54ee14d9-2dae-448d-8cc4-4db811c66acb.lovable.app-1777397838501.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <Outlet />
            <Toaster richColors position="top-right" />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <p className="mt-4 text-muted-foreground">Page not found</p>
        <a href="/" className="mt-6 inline-block text-accent underline">Go home</a>
      </div>
    </div>
  );
}
