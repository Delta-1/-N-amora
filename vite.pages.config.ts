import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
export default defineConfig({base:process.env.NAMORA_BASE_PATH || './',plugins:[react()],css:{postcss:{plugins:[tailwindcss()]}},build:{outDir:'dist-pages',emptyOutDir:true},server:{host:'0.0.0.0',port:4173,allowedHosts:['terminal.local']}});
