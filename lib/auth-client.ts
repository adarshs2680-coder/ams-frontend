import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins"

export type Session = NonNullable<
  ReturnType<typeof authClient.useSession>["data"]
>;

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    sessionOptions: {
        refetchOnWindowFocus: false,
    },
    plugins: [adminClient()],
})