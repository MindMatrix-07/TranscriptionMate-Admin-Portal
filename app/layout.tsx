import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TranscriptionMate Admin Portal",
  description: "Train source-detection behavior, review feedback, and manage site fingerprints.",
};

const themeScript = `
  (() => {
    const storedTheme = window.localStorage.getItem("transcriptionmate-admin-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = storedTheme ?? (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
