import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Remix Remix tolls lengkap v1 dari ahmaddavid0906',
  description: 'Sat Set AI Automation Tools & Workspace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
