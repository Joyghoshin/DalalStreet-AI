import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const validEmail    = process.env.ADMIN_EMAIL    || "admin@dalalstreet.ai";
        const validPassword = process.env.ADMIN_PASSWORD || "dalalstreet2024";

        if (
          credentials?.email    === validEmail &&
          credentials?.password === validPassword
        ) {
          return { id: "1", name: "Admin", email: validEmail };
        }
        return null;
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages:   { signIn: "/login", error: "/login" },
  secret:  process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
