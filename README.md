# Joana Mirelly Fotografia — Galerias

Plataforma de entrega de fotos e vídeos de eventos (Next.js 14 App Router + Tailwind + Supabase).

## Configuração

1. **Supabase**
   - Crie um projeto e execute `supabase/schema.sql` no **SQL Editor**.
   - Em **Authentication → Users**, crie o usuário da Joana (e-mail + senha).
   - Em **Authentication → Providers → Email**, desative **Allow new users to sign up**.
   - Cadastre-a como administradora:
     ```sql
     insert into public.admin_users (user_id)
     select id from auth.users where email = 'joana@exemplo.com';
     ```
2. **Variáveis de ambiente**: copie `.env.example` para `.env.local` e preencha.
3. **Rodar**
   ```bash
   npm install
   npm run dev
   ```
   - Painel: `http://localhost:3000/admin`
   - Galeria pública: `http://localhost:3000/galeria/<slug>`

## Arquitetura

| Camada | Detalhes |
| --- | --- |
| Página pública | Server Component lê galeria/mídias via RLS (anon só enxerga `published`). |
| Miniaturas | Geradas no navegador (Canvas → WebP, maior lado 1600px) e enviadas ao bucket público `gallery-thumbnails`. |
| Originais | Bucket privado `gallery-originals`; acesso só por Signed URL emitida em `/api/download/[mediaId]` (60s, nome original). |
| ZIP | `/api/download/zip?galleryId=…` (GET) ou POST `{ galleryId }` — JSZip em streaming, sem compressão (STORE). |
| Admin | Middleware exige sessão + registro em `admin_users` (função `is_admin()` usada também no RLS e no Storage). |

## Observações de produção

- O plano Free do Supabase limita uploads a 50 MB por arquivo (ajuste o limite global em *Storage → Settings*).
- A rota de ZIP mantém os originais em memória durante a montagem; para galerias muito grandes (vários GB),
  hospede em um ambiente com memória/tempo de execução adequados (`maxDuration = 300`).
- Fotos em HEIC não são decodificadas pela maioria dos navegadores: converta para JPEG antes do envio.

