import { ContactMode, normalizeContactValue } from "@/lib/contact";
import { LANDING_VARIANT, type LandingVariant } from "@/lib/experiment";

type RegisterBody = {
  contactMode: ContactMode;
  value: string;
  email?: string;
  submissionKey?: string;
  variant?: LandingVariant;
};

export async function POST(request: Request) {
  const scriptUrl = process.env.APPS_SCRIPT_URL;
  if (!scriptUrl) {
    return Response.json(
      { error: "APPS_SCRIPT_URL not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json()) as RegisterBody;
  const {
    contactMode,
    value,
    email = "",
    submissionKey: providedSubmissionKey,
    variant = LANDING_VARIANT,
  } = body;

  if (!contactMode || !value) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const normalizedValue = normalizeContactValue(contactMode, value);
  if (!normalizedValue) {
    return Response.json({ error: "Invalid contact value" }, { status: 400 });
  }

  const trimmedEmail = email.trim();
  const normalizedEmail = trimmedEmail
    ? normalizeContactValue("email", trimmedEmail)
    : "";
  if (trimmedEmail && !normalizedEmail) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  const submissionKey = providedSubmissionKey?.trim() || crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const res = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "register",
      createdAt,
      submissionKey,
      contactMode,
      contactValue: normalizedValue,
      value: normalizedValue,
      email: normalizedEmail,
      variant,
    }),
  });

  const payload = (await res.json().catch(() => null)) as
    | { ok?: boolean; error?: string }
    | null;

  if (!res.ok || !payload?.ok) {
    return Response.json({ error: "Failed to save" }, { status: 502 });
  }

  return Response.json({ ok: true, submissionKey });
}
