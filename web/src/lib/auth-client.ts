import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";
import { ac, roles } from "../../../src/shared/permissions";

export const authClient = createAuthClient({
  plugins: [
    adminClient({ ac, roles }),
    organizationClient({ ac, roles, dynamicAccessControl: { enabled: true } }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
