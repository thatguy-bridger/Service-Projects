import NextAuth from "next-auth";
import { authOptions } from "@service-projects/core-auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
