import "./globals.css";

export const metadata = {
  title: "2026 12U AAA OBA Provincial Championship | Live Bracket",
  description: "Live 12U AAA OBA Provincial Championship bracket from Waterloo, Ontario."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
