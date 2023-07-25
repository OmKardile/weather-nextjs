import './globals.css'
import { Rajdhani } from 'next/font/google'

const railway = Rajdhani({
  weight: ['400', '700'],
  style: ['normal'],
  subsets: ['latin'],
  display: 'swap',
})

export const metadata = {
  title: 'Weather',
  description: 'Generated by create next app',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={railway.className}>{children}</body>
    </html>
  )
}
