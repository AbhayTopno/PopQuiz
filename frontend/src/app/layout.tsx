import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PopQuiz',
  description: 'Step Into the Quizverse - Master the Game of Knowledge',
  icons: {
    icon: [{ url: '/img/PQ Logo.png', type: 'image/png' }],
    shortcut: '/img/PQ Logo.png',
    apple: '/img/PQ Logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Inject runtime config from server-side env vars
  const runtimeConfig = {
    API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_URL ||
      process.env.INTERNAL_API_URL ||
      'http://localhost:5000',
    SOCKET_URL:
      process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SOCKET_URL || 'http://localhost:5000',
  };

  return (
    <html lang="en" className="hide-scrollbar">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__ = ${JSON.stringify(runtimeConfig)};`,
          }}
        />
      </head>
      <body className="overflow-x-hidden hide-scrollbar">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
