import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./sw-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Campo Vivo | Gestão Equestre",
  description: "Gestão simples para centros de treinamento e haras.",
  applicationName: "Campo Vivo",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Campo Vivo",
  },
  icons: {
    icon: [
      { url: "/icons/campo-vivo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/campo-vivo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/campo-vivo-192.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
