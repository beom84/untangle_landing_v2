import { LANDING_VARIANT } from "@/lib/experiment";

type SurveyBody = {
  submissionKey: string;
  step: number;
  thoughtCategory?: string;
  thoughtCategoryOther?: string;
  painMoment?: string;
  currentMethods?: string[];
  currentMethodsOther?: string;
  branchTarget?: string;
  branchChoice?: string;
  biggestGap?: string;
  completed?: boolean;
};

export async function POST(request: Request) {
  const scriptUrl = process.env.APPS_SCRIPT_URL;
  if (!scriptUrl) {
    return Response.json(
      { error: "APPS_SCRIPT_URL not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json()) as SurveyBody;
  const {
    submissionKey,
    step,
    thoughtCategory = "",
    thoughtCategoryOther = "",
    painMoment = "",
    currentMethods = [],
    currentMethodsOther = "",
    branchTarget = "",
    branchChoice = "",
    biggestGap = "",
    completed = false,
  } = body;

  if (!submissionKey || !step) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();

  const res = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "survey",
      submissionKey,
      surveyStep: step,
      thoughtCategory,
      thoughtCategoryOther,
      painMoment,
      currentMethods,
      currentMethodsOther,
      branchTarget,
      branchChoice,
      biggestGap,
      surveyCompleted: completed,
      surveyCompletedAt: completed ? updatedAt : "",
      updatedAt,
      variant: LANDING_VARIANT,
    }),
  });

  const payload = (await res.json().catch(() => null)) as
    | { ok?: boolean; error?: string }
    | null;

  if (!res.ok || !payload?.ok) {
    return Response.json({ error: "Failed to save survey" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
