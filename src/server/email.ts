function emailTemplate(title: string, lines: string[], link?: { label: string; href: string }) {
  return `<!doctype html>
<html>
  <body style="font-family: sans-serif; color: #1a1a1a; line-height: 1.6">
    <h2>${title}</h2>
    ${lines.map((l) => `<p>${l}</p>`).join("\n")}
    ${link ? `<p><a href="${link.href}">${link.label}</a></p>` : ""}
    <p style="color:#888; font-size: 12px">banrai</p>
  </body>
</html>`;
}

export async function sendMail(env: Env, to: string, subject: string, html: string): Promise<void> {
  const from = env.EMAIL_FROM;
  if (!from) {
    console.log(`[mail:skip] no EMAIL_FROM configured: to=${to} subject=${subject}`);
    console.log(`[mail:skip] ${html}`);
    return;
  }
  try {
    await env.EMAIL.send({
      to,
      from: { email: from, name: "banrai" },
      subject,
      html,
      text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
    });
  } catch (err) {
    console.error(`[mail:error] to=${to} subject=${subject}`, err);
  }
}

export const sendVerificationEmail =
  (env: Env) =>
  async ({ user, url }: { user: { email: string }; url: string }) => {
    if (user.email.endsWith("banrai.test")) {
      console.log(`[mail:skip] demo user, verify email not sent: ${user.email}`);
      return;
    }
    await sendMail(
      env,
      user.email,
      "Verify your email",
      emailTemplate("Verify your email", ["Click the link below to verify your email address."], {
        label: "Verify",
        href: url,
      }),
    );
  };

export const sendResetPasswordEmail =
  (env: Env) =>
  async ({ user, url }: { user: { email: string }; url: string }) => {
    await sendMail(
      env,
      user.email,
      "Reset your password",
      emailTemplate("Reset your password", ["Click the link below to reset your password."], {
        label: "Reset password",
        href: url,
      }),
    );
  };

export const sendInvitationEmail =
  (env: Env) =>
  async ({
    email,
    invitation,
    organization,
    inviter,
  }: {
    email: string;
    invitation: { id: string };
    organization: { name: string };
    inviter: { user: { name: string } };
  }) => {
    const link = `${env.BETTER_AUTH_URL}/accept-invitation?id=${encodeURIComponent(invitation.id)}`;
    await sendMail(
      env,
      email,
      `You've been invited to ${organization.name}`,
      emailTemplate(
        "Organization invitation",
        [
          `${inviter.user.name} invited you to join "${organization.name}" on banrai.`,
          "Accept the invitation to set your password and join the organization.",
        ],
        { label: "Accept invitation", href: link },
      ),
    );
  };
