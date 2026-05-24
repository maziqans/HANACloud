import type { Metadata } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'HANACloud',
  description: 'Premium private cloud storage with precision engineering',
  generator: 'Ammar Haziq',
  manifest: '/manifest.json',
  icons: {
    icon: [
      {
        url: '/HANACloud.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/HANACloud.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/HANACloud.png',
        type: 'image/png',
      },
    ],
    apple: '/HANACloud.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
