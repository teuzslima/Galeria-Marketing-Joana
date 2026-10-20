<div align="center">

# 📸 Galeria — Joana Mirelly Fotografia

**Plataforma de entrega de galerias fotográficas e audiovisuais para eventos**
*Photo & video delivery platform for event galleries*

[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_·_DB_·_Storage-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare_R2-S3_compatible-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/r2/)

[**Português**](#-português) · [**English**](#-english)

</div>

> 📷 **Demo & screenshots:** _adicione aqui o link do deploy (Vercel) e algumas capturas das telas (home, galeria pública, painel admin)._

---

## 🇧🇷 Português

### Sobre o projeto

Aplicação full-stack que entrega, de forma elegante e segura, as fotos e vídeos de cada
evento fotografado. Cada cliente recebe um link exclusivo para sua galeria; o fotógrafo
gerencia tudo por um painel administrativo — criar galerias, subir mídias, publicar e
compartilhar. Os arquivos **originais** ficam em bucket **privado** e só são acessíveis por
**URLs assinadas temporárias**, enquanto as miniaturas otimizadas carregam rápido na galeria.

### Funcionalidades

- 🖼️ **Capa imersiva** em tela cheia e galeria responsiva com *lightbox* (fotos e vídeos)
- 🗂️ **Organização por abas** (ex.: *Takes* e *Editados*) e por categorias
- ⭐ **Favoritos** e **download individual** com o nome original do arquivo
- 📦 **Download em ZIP** da galeria inteira (streaming com JSZip, sem recompressão)
- 🔐 **Painel administrativo** protegido por autenticação + verificação de administrador
- 🧩 **Miniaturas geradas no navegador** (Canvas → WebP) para carregamento leve
- 🛡️ **Segurança por RLS** no banco: visitante anônimo só enxerga o que está *publicado*

### Stack

**Next.js 14 (App Router)** · **TypeScript** · **Tailwind CSS** · **Supabase** (Auth +
PostgreSQL com Row-Level Security + Storage) · **Cloudflare R2 / S3** (`@aws-sdk/client-s3`
+ Signed URLs) · **JSZip** · deploy **serverless** (Vercel).

### Arquitetura

| Camada | Detalhes |
| --- | --- |
| Página pública | Server Component lê galeria/mídias via RLS (anon só enxerga `published`). |
| Miniaturas | Geradas no navegador (Canvas → WebP, maior lado 1600px) em bucket público. |
| Originais | Bucket **privado**; acesso só por **Signed URL** emitida em `/api/download/[mediaId]` (60s, nome original). |
| ZIP | `/api/download/zip?galleryId=…` — JSZip em streaming, sem compressão (STORE). |
| Admin | Middleware exige sessão + registro em `admin_users` (função `is_admin()` usada também no RLS e no Storage). |

### Como rodar

```bash
# 1. Instale as dependências
npm install

# 2. Configure o ambiente
cp .env.example .env.local   # preencha com os dados do seu projeto Supabase

# 3. Banco de dados: rode supabase/schema.sql no SQL Editor do Supabase
#    e cadastre o administrador em admin_users

# 4. Suba em desenvolvimento
npm run dev
```

- Painel: `http://localhost:3000/admin` · Galeria pública: `http://localhost:3000/galeria/<slug>`

### Estrutura

```
src/
├── app/
│   ├── (public)/galeria/[slug]/   # galeria pública por slug
│   ├── (admin)/admin/             # login + dashboard + gestão de galerias
│   └── api/                       # download (signed url), zip, upload presigned
├── components/                    # public (hero, grid, lightbox) + admin
├── lib/                           # supabase, storage/r2, tipos e utilitários
└── middleware.ts                  # proteção das rotas /admin
```

---

## 🇺🇸 English

### About

A full-stack app that delivers each event's photos and videos in an elegant, secure way.
Every client gets a unique link to their gallery; the photographer manages everything from
an admin panel — create galleries, upload media, publish and share. **Original files** live
in a **private** bucket and are only reachable through **short-lived signed URLs**, while
optimized thumbnails keep the gallery fast.

### Features

- 🖼️ Full-screen **immersive cover** and responsive gallery with a **lightbox** (photos & videos)
- 🗂️ **Tabbed organization** (e.g. *Takes* and *Edited*) and categories
- ⭐ **Favorites** and **single-file download** preserving the original filename
- 📦 **Whole-gallery ZIP download** (streamed with JSZip, no re-compression)
- 🔐 **Admin panel** protected by authentication + admin check
- 🧩 **Browser-side thumbnails** (Canvas → WebP) for lightweight loading
- 🛡️ **Row-Level Security**: anonymous visitors only see *published* content

### Stack

**Next.js 14 (App Router)** · **TypeScript** · **Tailwind CSS** · **Supabase** (Auth +
PostgreSQL with RLS + Storage) · **Cloudflare R2 / S3** (`@aws-sdk/client-s3` + signed URLs)
· **JSZip** · **serverless** deploy (Vercel).

### Architecture

| Layer | Details |
| --- | --- |
| Public page | Server Component reads gallery/media through RLS (anon sees only `published`). |
| Thumbnails | Generated in the browser (Canvas → WebP, 1600px long edge), public bucket. |
| Originals | **Private** bucket; access only via **signed URL** from `/api/download/[mediaId]` (60s, original name). |
| ZIP | `/api/download/zip?galleryId=…` — streamed JSZip, store-only (no compression). |
| Admin | Middleware requires a session + an `admin_users` record (`is_admin()` reused by RLS and Storage). |

### Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
# run supabase/schema.sql in the Supabase SQL Editor, then register the admin in admin_users
npm run dev
```

Admin: `http://localhost:3000/admin` · Public gallery: `http://localhost:3000/galeria/<slug>`

---

<div align="center">

Desenvolvido por **[@teuzslima](https://github.com/teuzslima)** · Projeto comercial para Joana Mirelly Fotografia

</div>
