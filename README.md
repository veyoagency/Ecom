This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## API Setup (Storefront + Admin)

1) Create product/order tables using Sequelize migrations or a one-time `sequelize.sync()` script (models in `lib/models.ts`). For the one-time script, run `npx tsx scripts/sync-db.ts`.
2) Create Better Auth tables with `npx @better-auth/cli migrate` (requires `BETTER_AUTH_SECRET` + DB config). Generate with `openssl rand -base64 32`.
3) Copy `.env.example` to `.env` and set `POSTGRES`, `BETTER_AUTH_*`, the Brevo sender info, Supabase storage, and shipping.
4) Start the app with `npm run dev`.

### Admin access

Better Auth handles admin sign-in at `/api/auth/*`. Set `ADMIN_EMAILS` to the email(s) allowed to access `/api/admin/*` routes.
Use `/admin` for the back-office UI. If no admin user exists, you will be redirected to `/admin/register` to create the first account.
You can also create the first account via `POST /api/admin/register` or directly with `POST /api/auth/sign-up/email`, then sign in using `POST /api/auth/sign-in/email`.
If `ADMIN_EMAILS` is empty, any authenticated user is treated as admin (useful in dev only).

### Email (Brevo)

Emails are sent via the Brevo API. Save the Brevo secret key in Settings → Emailing, and set either `BREVO_SENDER_EMAIL`/`BREVO_SENDER_NAME` or `EMAIL_FROM` (`"Name <email>"`) in your env.

### Media uploads (Supabase Storage)

Product and collection media files are uploaded to Supabase Storage.
Set `SUPABASE_URL`, `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`, and optionally `SUPABASE_STORAGE_BUCKET` (default: `product-media`).
Use a public bucket if you want to serve images directly to storefront users.

### API Routes

Public:
- `GET /api/products?limit=24&offset=0`
- `GET /api/products/[slug]`
- `POST /api/orders`
- `GET /api/orders/[publicId]`

Auth (Better Auth):
- `POST /api/auth/sign-up/email`
- `POST /api/auth/sign-in/email`
- `POST /api/auth/sign-out`
- `GET /api/auth/get-session`
- `GET /api/auth/token` (JWT)
- `GET /api/auth/jwks`

Admin (requires session cookie or `Authorization: Bearer <jwt>`):
- `GET /api/admin/orders`
- `GET /api/admin/orders/[id]`
- `PATCH /api/admin/orders/[id]` (status updates)
- `POST /api/admin/orders/[id]/payment-link` (send PayPal link email)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## TO DO

- Front home design
- Front menu
- Front product page
- Front API connection
- Front checkout

- Brand page
- Order page
- Order details page

- View button, edit product page admin
- Adding/deleting admin user + name
- Setting page
-> Logo
-> Favicon
