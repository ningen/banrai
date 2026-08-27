import type { BetterAuthOptions } from "better-auth";
import { admin, organization } from "better-auth/plugins";
import { ac, roles } from "../shared/permissions";
import { sendInvitationEmail, sendResetPasswordEmail, sendVerificationEmail } from "./email";
import type { Env } from "./types";

export function buildAuthPlugins(env: Env) {
  return [
    admin(),
    organization({
      ac,
      roles,
      dynamicAccessControl: { enabled: true },
      sendInvitationEmail: sendInvitationEmail(env),
    }),
  ];
}

export function buildEmailConfig(env: Env): Pick<BetterAuthOptions, "emailAndPassword" | "emailVerification"> {
  return {
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      sendResetPassword: sendResetPasswordEmail(env),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: sendVerificationEmail(env),
    },
  };
}
