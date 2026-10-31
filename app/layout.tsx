import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AeroVista · Radar de vuelos",
  description: "Explora el cielo con posiciones reales de aeronaves, búsqueda de vuelos y favoritos.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
