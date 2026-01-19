import { decryptSecret } from "@/lib/encryption";
import { WebsiteSetting } from "@/lib/models";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type Sender = {
  name?: string;
  email: string;
};

function getSender(): Sender | null {
  const from = process.env.EMAIL_FROM?.trim();
  const nameOverride = process.env.BREVO_SENDER_NAME?.trim();
  const emailOverride = process.env.BREVO_SENDER_EMAIL?.trim();

  if (emailOverride) {
    return {
      email: emailOverride,
      name: nameOverride || undefined,
    };
  }

  if (!from) {
    return null;
  }

  const match = from.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const name = match[1]?.trim().replace(/^"|"$/g, "");
    const email = match[2]?.trim();
    if (!email) return null;
    return {
      email,
      name: name || undefined,
    };
  }

  return { email: from };
}

async function getApiKey() {
  const settings = await WebsiteSetting.findOne();
  const encrypted = settings?.brevo_api_key_encrypted?.trim();
  if (encrypted) {
    return decryptSecret(encrypted);
  }
  return null;
}

export async function sendEmail(payload: EmailPayload) {
  if (process.env.EMAIL_DISABLED === "true") {
    return { skipped: true };
  }

  const apiKey = await getApiKey();
  const sender = getSender();

  if (!apiKey || !sender) {
    return { skipped: true };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender,
      to: [{ email: payload.to }],
      subject: payload.subject,
      htmlContent: payload.html,
      textContent: payload.text,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `Brevo email failed (${response.status}): ${message || "unknown error"}`,
    );
  }

  return { skipped: false };
}
