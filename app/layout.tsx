import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'QR Connect | Kitchen Dashboard',
    description: 'Kitchen Display System for QR Connect',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    )
}
