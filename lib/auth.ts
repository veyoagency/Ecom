import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";

import { getPgPool } from "@/lib/postgres";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  database: getPgPool(),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    jwt({
      jwt: {
        definePayload: ({ user }) => {
          const role = (user as { role?: string }).role;
          return {
            user: {
              id: user.id,
              email: user.email,
              role,
            },
          };
        },
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
