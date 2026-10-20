import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'(N)amora · Nosso pequeno mundo',description:'Um cantinho para organizar a vida, dividir os planos e cuidar de vocês dois.',manifest:'/manifest.webmanifest',icons:{icon:'/favicon.svg',apple:'/icon-192.png'},appleWebApp:{capable:true,statusBarStyle:'default',title:'(N)amora'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><head><meta name="theme-color" content="#7f405d"/><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/></head><body>{children}</body></html>;}
