"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { initAmplitude, track } from "@/lib/amplitude";
import { initClarity } from "@/lib/clarity";
import type { ContactMode } from "@/lib/contact";
import { normalizeContactValue, normalizePhoneNumber } from "@/lib/contact";
import { LANDING_VARIANT, type LandingVariant } from "@/lib/experiment";
import styles from "./page.module.css";

type SurveyMethod =
  | "adhd_app"
  | "endure"
  | "notes"
  | "calendar"
  | "ai"
  | "support"
  | "none";

type ThoughtCategoryOption =
  | "cant_start"
  | "time_blind"
  | "mental_overload"
  | "cant_resume"
  | "forget_important"
  | "freeze_volume";

type PainMomentOption =
  | "deadline_rush"
  | "cant_start"
  | "didnt_recheck"
  | "missed_priority"
  | "plan_fell_apart"
  | "froze_from_volume";

type BiggestGapOption =
  | "record_only"
  | "priority_too_long"
  | "plan_breaks"
  | "hard_resume"
  | "guilt_avoidance"
  | "tool_maintenance";

type SurveyStep = 1 | 2 | 3 | 4 | 5;

type FlowStage = "idle" | "form" | SurveyStep | "complete";

type SurveyDraft = {
  currentStep: SurveyStep;
  thoughtCategory: ThoughtCategoryOption | "";
  thoughtCategoryOther: string;
  painMoment: PainMomentOption | "";
  currentMethods: SurveyMethod[];
  currentMethodsOther: string;
  branchChoice: string;
  biggestGap: BiggestGapOption[];
};

type SurveyStorage = {
  contactMode: ContactMode;
  contactValue: string;
  email: string;
  submissionKey: string;
  surveyDraft: LegacySurveyDraft;
  surveyCompleted: boolean;
};

type LegacySurveyDraft = {
  currentStep?: number;
  thoughtCategory?: string;
  thoughtCategoryOther?: string;
  painMoment?: string;
  currentMethods?: SurveyMethod[];
  currentMethodsOther?: string;
  biggestGap?: string | BiggestGapOption[];
  biggestGapSelections?: BiggestGapOption[];
  biggestGapOther?: string;
  branchChoice?: string;
};

type RegisterRequestPayload = {
  contactMode: ContactMode;
  value: string;
  email: string;
  submissionKey: string;
  variant: LandingVariant;
};

type SurveyRequestPayload = {
  submissionKey: string;
  step: SurveyStep;
  thoughtCategory: string;
  thoughtCategoryOther: string;
  painMoment: string;
  currentMethods: string[];
  currentMethodsOther: string;
  branchTarget: SurveyBranchTarget;
  branchChoice: string;
  biggestGap: string;
  completed: boolean;
};

type SurveyBranchTarget = "adhd_app" | "ai" | "none" | "general_methods";

type RestoredSurveyState = {
  contactValue: string;
  email: string;
  registrationSubmitted: boolean;
  submissionKey: string | null;
  surveyDraft: SurveyDraft;
  flowStage: FlowStage;
  isSurveyComplete: boolean;
  surveyStatusMessage: string | null;
};

const SURVEY_STORAGE_KEY = "untangle-survey-progress";

const thoughtCategoryOptions: {
  id: ThoughtCategoryOption;
  label: string;
}[] = [
  { id: "cant_start", label: "해야 할 일은 아는데 시작을 못 해요" },
  { id: "time_blind", label: "시간이 어떻게 사라지는지 모르겠어요" },
  { id: "mental_overload", label: "머릿속이 복잡해서 멈춰버려요" },
  { id: "cant_resume", label: "한 번 흐트러지면 다시 못 돌아오겠어요" },
  { id: "forget_important", label: "중요한 걸 자꾸 놓치거나 잊어요" },
  { id: "freeze_volume", label: "해야 할 일이 너무 많아 보여서 그냥 멈춰 있어요" },
];

const painMomentOptions: { id: PainMomentOption; label: string }[] = [
  {
    id: "deadline_rush",
    label: "해야 할 일을 미루다가 마감 직전에 몰아서 했어요",
  },
  {
    id: "cant_start",
    label: "뭘 해야 할지 알지만 시작을 못 했어요",
  },
  {
    id: "didnt_recheck",
    label: "적어뒀지만 다시 확인하지 않았어요",
  },
  {
    id: "missed_priority",
    label: "이것저것 하다가 중요한 일을 놓쳤어요",
  },
  {
    id: "plan_fell_apart",
    label: "계획은 세웠지만 금방 흐트러졌어요",
  },
  {
    id: "froze_from_volume",
    label: "해야 할 일이 너무 많아 보여서 그냥 멈춰 있었어요",
  },
];

const surveyOptions: { id: SurveyMethod; label: string }[] = [
  { id: "adhd_app", label: "Tiimo, Structured 같은 ADHD용 앱을 써요" },
  { id: "notes", label: "일반 메모나 간단한 투두앱을 써요" },
  { id: "calendar", label: "캘린더나 알람을 써요" },
  { id: "ai", label: "AI에게 정리하거나 물어봐요" },
  { id: "support", label: "약, 상담, 주변 도움을 받아요" },
  { id: "none", label: "따로 쓰는 방법 없이 그냥 버텨요" },
];

const primaryMethodOptions = [
  { id: "paper_notes", label: "종이/메모앱에 적어요" },
  { id: "todo_app", label: "일반 투두앱을 써요" },
  { id: "adhd_app", label: "ADHD용 앱을 써요" },
  { id: "calendar_alarm", label: "캘린더/알람을 써요" },
  { id: "ai", label: "AI를 써요" },
  { id: "human_help", label: "사람 도움에 가장 많이 의지해요" },
] as const;

const biggestGapOptions: { id: BiggestGapOption; label: string }[] = [
  {
    id: "record_only",
    label: "적어두기만 하고 실제 시작으로 이어지지 않아요",
  },
  {
    id: "priority_too_long",
    label: "무엇부터 할지 정하는 데 너무 오래 걸려요",
  },
  {
    id: "plan_breaks",
    label: "계획이 조금만 틀어져도 금방 무너져요",
  },
  {
    id: "hard_resume",
    label: "중간에 끊기면 다시 이어붙이기 어려워요",
  },
  {
    id: "guilt_avoidance",
    label: "밀린 걸 보면 죄책감이 커져 더 피하게 돼요",
  },
  {
    id: "tool_maintenance",
    label: "도구를 유지하는 것 자체가 번거로워요",
  },
];

type SurveyBranchOption = { id: string; label: string };

const diffBlocks: {
  num: string;
  title: string;
  intro: string;
  bullets: string[];
}[] = [
  {
    num: "01",
    title: "머릿속을 쏟아내면,\n걱정 · 생각 · 할 일로 갈라줘요",
    intro: "정리 안 된 채 다 쏟아내도 돼요. AI가 질문으로 함께 갈라줍니다.",
    bullets: [
      "할 일·걱정·감정이 섞여도 그대로 받아요",
      "막연한 걱정·생각은 ‘할 일’로 바꿀지 함께 정해요",
      "다 적었을 뿐인데, 머리가 한결 가벼워져요",
    ],
  },
  {
    num: "02",
    title: "오늘 뭐부터 할지는\n당신이 정해요",
    intro: "우선순위(P1~P4)나 긴급×중요 2×2로 직접 배치해요.",
    bullets: [
      "AI는 ‘이거 하세요’라고 1개를 추천하지 않아요",
      "제안·구체화는 AI, 결정은 당신",
    ],
  },
  {
    num: "03",
    title: "고른 일을, 지금 할 수 있는\n첫 행동까지 쪼개줘",
    intro: "막히면 AI가 짧게 묻고 시작점을 잘라줍니다.",
    bullets: [
      "첫 행동은 2분짜리 하나로 (예: 문서 열고 제목 한 줄)",
      "그 뒤 큰 단계 3개로 전체 그림까지",
      "더 막히면 ‘이것도 쪼개줘’로 다시",
    ],
  },
];

const audienceStats: { num: string; caption: string; source: string }[] = [
  { num: "4.4%", caption: "성인 4.4%가 ADHD, 도움받는 비율은 20% 미만", source: "NIH" },
  { num: "80%", caption: "정리·시간관리·할 일 완료에 어려움", source: "J. of Attention Disorders" },
  { num: "3×", caption: "스트레스·우울 등 정서적 어려움 가능성", source: "NCS-R" },
];

function createInitialSurveyDraft(): SurveyDraft {
  return {
    currentStep: 1,
    thoughtCategory: "",
    thoughtCategoryOther: "",
    painMoment: "",
    currentMethods: [],
    currentMethodsOther: "",
    branchChoice: "",
    biggestGap: [],
  };
}

function getSurveyStepError(step: SurveyStep, draft: SurveyDraft) {
  if (step === 1) {
    if (!draft.thoughtCategory) {
      return "가장 자주 막히는 순간을 골라주세요.";
    }
  }

  if (step === 2 && !draft.painMoment) {
    return "최근 2주 동안 가장 자주 있었던 일을 하나 골라주세요.";
  }

  if (step === 3) {
    if (draft.currentMethods.length === 0) {
      return "지금 버티는 방법을 한 가지 이상 골라주세요.";
    }
  }

  if (step === 4) {
    if (!draft.branchChoice) {
      return "가장 많이 의지하는 방식을 하나 골라주세요.";
    }

    if (!primaryMethodOptions.some((option) => option.id === draft.branchChoice)) {
      return "가장 많이 의지하는 방식을 하나 골라주세요.";
    }
  }

  if (step === 5 && draft.biggestGap.length === 0) {
    return "현재 방식의 한계를 한 가지 이상 골라주세요.";
  }

  return null;
}

function parseSingleChoice<T extends string>(
  options: { id: T; label: string }[],
  value: unknown,
) {
  if (typeof value !== "string") {
    return "";
  }

  const matchedOption = options.find(
    (option) => option.id === value || option.label === value,
  );
  return matchedOption?.id ?? "";
}

function parseSurveyMethods(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (item === "endure") {
      return ["none" as SurveyMethod];
    }

    const matchedOption = surveyOptions.find((option) => option.id === item);
    return matchedOption ? [matchedOption.id] : [];
  });
}

function parseChoiceArray<T extends string>(
  options: { id: T; label: string }[],
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.flatMap((item) => {
        const matchedOption = options.find((option) => option.id === item);
        return matchedOption ? [matchedOption.id] : [];
      }),
    ),
  );
}

function normalizeBranchChoice(branchChoice: unknown) {
  return parseSingleChoice(
    primaryMethodOptions as unknown as SurveyBranchOption[],
    branchChoice,
  );
}

function parseBiggestGapChoices(value: unknown) {
  if (Array.isArray(value)) {
    return parseChoiceArray(biggestGapOptions, value);
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .split("|")
    .map((part) => part.trim())
    .flatMap((part) => {
      const matched = biggestGapOptions.find(
        (option) => option.id === part || option.label === part,
      );
      return matched ? [matched.id] : [];
    })
    .filter((item, index, items) => items.indexOf(item) === index);
}

function normalizeSurveyDraft(savedDraft: LegacySurveyDraft | null): SurveyDraft {
  const emptyDraft = createInitialSurveyDraft();

  if (!savedDraft) {
    return emptyDraft;
  }

  const thoughtCategory = parseSingleChoice(
    thoughtCategoryOptions,
    savedDraft.thoughtCategory,
  ) as ThoughtCategoryOption | "";

  const normalizedCurrentStep =
    savedDraft.currentStep === 2 ||
    savedDraft.currentStep === 3 ||
    savedDraft.currentStep === 4 ||
    savedDraft.currentStep === 5
      ? savedDraft.currentStep
      : 1;

  const currentStep: SurveyStep = thoughtCategory ? normalizedCurrentStep : 1;

  const currentMethods = parseSurveyMethods(savedDraft.currentMethods);
  const branchChoice = normalizeBranchChoice(savedDraft.branchChoice ?? "");
  const biggestGap = parseBiggestGapChoices(
    savedDraft.biggestGapSelections ?? savedDraft.biggestGap ?? "",
  );

  return {
    currentStep,
    thoughtCategory,
    thoughtCategoryOther: "",
    painMoment: parseSingleChoice(painMomentOptions, savedDraft.painMoment) as
      | PainMomentOption
      | "",
    currentMethods,
    currentMethodsOther: "",
    branchChoice,
    biggestGap,
  };
}

function getChoiceLabel<T extends string>(
  options: { id: T; label: string }[],
  id: T,
) {
  return options.find((option) => option.id === id)?.label ?? "";
}

function getThoughtCategoryEventProps(draft: SurveyDraft) {
  if (!draft.thoughtCategory) {
    return {};
  }

  return {
    thought_category: draft.thoughtCategory,
  };
}

function getSurveyBranchTargetFromChoice(
  branchChoice: string,
  methods: SurveyMethod[],
) {
  if (branchChoice === "adhd_app") {
    return "adhd_app" as const;
  }

  if (branchChoice === "ai") {
    return "ai" as const;
  }

  if (methods.includes("adhd_app")) {
    return "adhd_app" as const;
  }

  if (methods.includes("ai")) {
    return "ai" as const;
  }

  if (methods.includes("none")) {
    return "none" as const;
  }

  return "general_methods" as const;
}

function serializeBiggestGapChoices(choices: BiggestGapOption[]) {
  return choices
    .map((choice) => getChoiceLabel(biggestGapOptions, choice))
    .filter(Boolean)
    .join(" | ");
}

function serializeCurrentMethods(methods: SurveyMethod[]) {
  return methods
    .map((method) => getChoiceLabel(surveyOptions, method))
    .filter(Boolean);
}

function createDefaultSurveyState(): RestoredSurveyState {
  const emptyDraft = createInitialSurveyDraft();

  return {
    contactValue: "",
    email: "",
    registrationSubmitted: false,
    submissionKey: null,
    surveyDraft: emptyDraft,
    flowStage: "idle",
    isSurveyComplete: false,
    surveyStatusMessage: null,
  };
}

function readStoredSurveyState(): RestoredSurveyState {
  const defaultState = createDefaultSurveyState();

  if (typeof window === "undefined") {
    return defaultState;
  }

  const saved = window.localStorage.getItem(SURVEY_STORAGE_KEY);
  if (!saved) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(saved) as SurveyStorage;
    const restoredDraft = normalizeSurveyDraft(parsed.surveyDraft ?? null);
    const restoredStep = restoredDraft.currentStep ?? 1;

    return {
      contactValue: parsed.contactValue ?? defaultState.contactValue,
      email: parsed.email ?? defaultState.email,
      registrationSubmitted: Boolean(parsed.submissionKey),
      submissionKey: parsed.submissionKey ?? null,
      surveyDraft: restoredDraft,
      flowStage: parsed.surveyCompleted ? "idle" : restoredStep,
      isSurveyComplete: Boolean(parsed.surveyCompleted),
      surveyStatusMessage: parsed.surveyCompleted
        ? null
        : "이전 설문 내용을 이어서 작성할 수 있어요.",
    };
  } catch {
    window.localStorage.removeItem(SURVEY_STORAGE_KEY);
    return defaultState;
  }
}

async function saveRegistrationRequest(payload: RegisterRequestPayload) {
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "사전 등록 저장에 실패했습니다.");
  }
}

function createSurveySavePayload(
  submissionKey: string,
  step: SurveyStep,
  draft: SurveyDraft,
  completed: boolean,
): SurveyRequestPayload {
  return {
    submissionKey,
    step,
    thoughtCategory: draft.thoughtCategory
      ? getChoiceLabel(thoughtCategoryOptions, draft.thoughtCategory)
      : "",
    thoughtCategoryOther: "",
    painMoment: draft.painMoment
      ? getChoiceLabel(painMomentOptions, draft.painMoment)
      : "",
    currentMethods: serializeCurrentMethods(draft.currentMethods),
    currentMethodsOther: draft.currentMethodsOther.trim(),
    branchTarget: getSurveyBranchTargetFromChoice(
      draft.branchChoice,
      draft.currentMethods,
    ),
    branchChoice: draft.branchChoice
      ? getChoiceLabel(
          primaryMethodOptions as unknown as SurveyBranchOption[],
          draft.branchChoice,
        )
      : "",
    biggestGap: serializeBiggestGapChoices(draft.biggestGap),
    completed,
  };
}

async function saveSurveyRequest(payload: SurveyRequestPayload) {
  const res = await fetch("/api/survey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "답변 저장에 실패했습니다.");
  }
}

function isSurveyStep(stage: FlowStage): stage is SurveyStep {
  return (
    stage === 1 || stage === 2 || stage === 3 || stage === 4 || stage === 5
  );
}

function LogoMark() {
  return (
    <svg
      className={styles.logoMark}
      viewBox="-2.5 -2.5 24.8 25"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7.77088 20c16 0 16-20 0-20-10 0-10 12-2 12 6 0 6-6 2-6"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.5 13.9 8 19 9.8 13.9 11.6 12 17l-1.9-5.4L5 9.8 10.1 8z" />
    </svg>
  );
}

function TimerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 2h4" />
      <circle cx="12" cy="14" r="8" />
      <path d="M12 14V9.5" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function PhoneMockup({ onPlay }: { onPlay: () => void }) {
  return (
    <div className={styles.phoneMockup}>
      <div className={styles.phoneScreen}>
        <div className={styles.protoTopbar}>
          <span className={styles.protoBrand}>Untangle</span>
          <span className={styles.protoAvatar} aria-hidden="true" />
        </div>
        <div className={styles.protoBody}>
          <p className={styles.protoSectionTitle}>머릿속 쏟아내기</p>
          <div className={styles.protoDumpBox}>
            보고서 마무리 / 엄마 생신 선물 / 운동 다시 시작…
          </div>
          <div className={styles.protoAiRow}>
            <SparkleIcon className={styles.protoSparkle} />
            <span>AI가 갈라줬어요</span>
          </div>
          <div className={styles.protoSplit}>
            <div className={`${styles.protoCard} ${styles.protoCardWorry}`}>
              <span className={styles.protoTag}>걱정</span>
              <span className={styles.protoItems}>
                <span className={styles.protoItem}>발표 망치면 어쩌지</span>
              </span>
            </div>
            <div className={`${styles.protoCard} ${styles.protoCardThought}`}>
              <span className={styles.protoTag}>생각</span>
              <span className={styles.protoItems}>
                <span className={styles.protoItem}>새 운동 루틴 짜보기</span>
              </span>
            </div>
            <div className={`${styles.protoCard} ${styles.protoCardTodo}`}>
              <span className={styles.protoTag}>할 일</span>
              <span className={styles.protoItems}>
                <span className={styles.protoItem}>보고서 마무리</span>
                <span className={styles.protoItem}>생신 선물 주문</span>
              </span>
            </div>
          </div>
          <div className={styles.protoActionCard}>
            <div className={styles.protoActionHead}>
              <ArrowRightIcon className={styles.protoActionArrow} />
              <span>지금 할 첫 행동</span>
            </div>
            <div className={styles.protoActionMain}>
              <span>문서 열고 제목 한 줄 쓰기</span>
              <span className={styles.protoCheckCircle} aria-hidden="true" />
            </div>
            <span className={styles.protoTimeChip}>
              <TimerIcon className={styles.protoTimerIcon} />
              2분
            </span>
          </div>
        </div>
        <button
          type="button"
          className={styles.phonePlayOverlay}
          onClick={onPlay}
          aria-label="프로토타입 미리보기"
        >
          <span className={styles.phonePlayButton}>
            <PlayIcon className={styles.phonePlayIcon} />
          </span>
          <span className={styles.phoneDurationChip}>0:30</span>
        </button>
      </div>
    </div>
  );
}

function CtaButton({
  onClick,
  label = "사전 등록하기",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button type="button" className={styles.ctaButton} onClick={onClick}>
      <span>{label}</span>
      <ArrowRightIcon className={styles.ctaArrow} />
    </button>
  );
}

function OptionItem({
  checked,
  inputType,
  name,
  onChange,
  label,
}: {
  checked: boolean;
  inputType: "radio" | "checkbox";
  name: string;
  onChange: () => void;
  label: string;
}) {
  return (
    <label
      className={`${styles.option} ${checked ? styles.optionChecked : ""}`}
    >
      <input
        className={styles.optionInput}
        type={inputType}
        name={name}
        checked={checked}
        onChange={onChange}
      />
      <span
        className={`${styles.optionMark} ${
          inputType === "radio" ? styles.optionMarkRound : ""
        }`}
      >
        {checked ? <CheckIcon className={styles.optionCheck} /> : null}
      </span>
      <span className={styles.optionText}>{label}</span>
    </label>
  );
}

const surveyMeta: Record<SurveyStep, { title: string; body: string }> = {
  1: {
    title: "가장 자주 막히는 순간은 언제인가요?",
    body: "가장 가까운 답변 하나를 골라주세요.",
  },
  2: {
    title: "최근 2주 동안 가장 자주 있었던 일은 무엇인가요?",
    body: "가장 가까운 답변 하나를 골라주세요.",
  },
  3: {
    title: "지금은 주로 어떻게 버티고 있나요?",
    body: "해당되는 걸 모두 골라주세요.",
  },
  4: {
    title: "그중 가장 많이 의지하는 한 가지는 무엇인가요?",
    body: "가장 가까운 답변 하나를 골라주세요.",
  },
  5: {
    title: "현재 방식의 한계는 무엇인가요?",
    body: "해당되는 걸 모두 골라주세요.",
  },
};

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [consentChecked, setConsentChecked] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false);
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [surveyDraft, setSurveyDraft] = useState<SurveyDraft>(
    createInitialSurveyDraft,
  );
  const [flowStage, setFlowStage] = useState<FlowStage>("idle");
  const [isSurveyComplete, setIsSurveyComplete] = useState(false);
  const [registrationSaveCount, setRegistrationSaveCount] = useState(0);
  const [surveySaveCount, setSurveySaveCount] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const [surveyStatusMessage, setSurveyStatusMessage] = useState<string | null>(
    null,
  );
  const [hasRestoredSurveyState, setHasRestoredSurveyState] = useState(false);
  const surveySaveChainRef = useRef(Promise.resolve());
  const isRegistrationSaving = registrationSaveCount > 0;
  const isSurveySaving = surveySaveCount > 0;

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    initAmplitude();
    initClarity();
    track("page_viewed", { variant: LANDING_VARIANT });

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-section]"),
    );
    const seenSections = new Set<string>();
    const sectionRatios = new Map<string, number>();
    let activeSection: string | null = null;
    let activeSectionStartedAt = 0;

    const trackSectionDuration = (reason: string) => {
      if (!activeSection || activeSectionStartedAt === 0) {
        return;
      }

      const durationMs = Date.now() - activeSectionStartedAt;
      if (durationMs > 0) {
        track("section_duration", {
          section: activeSection,
          duration_ms: durationMs,
          duration_seconds: Number((durationMs / 1000).toFixed(2)),
          exit_reason: reason,
        });
      }

      activeSection = null;
      activeSectionStartedAt = 0;
    };

    const updateActiveSection = (reason: string) => {
      let nextSection: string | null = null;
      let nextRatio = 0;

      sectionRatios.forEach((ratio, section) => {
        if (ratio >= 0.3 && ratio > nextRatio) {
          nextSection = section;
          nextRatio = ratio;
        }
      });

      if (nextSection === activeSection) {
        return;
      }

      trackSectionDuration(reason);

      if (nextSection) {
        activeSection = nextSection;
        activeSectionStartedAt = Date.now();
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const section = entry.target.getAttribute("data-section");
          if (!section) {
            return;
          }

          const ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
          sectionRatios.set(section, ratio);

          if (entry.isIntersecting && ratio >= 0.3 && !seenSections.has(section)) {
            seenSections.add(section);
            track("section_viewed", {
              section,
            });
          }
        });

        updateActiveSection("section_changed");
      },
      { threshold: [0, 0.3, 0.6, 0.9] },
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        trackSectionDuration("page_hidden");
        return;
      }

      updateActiveSection("page_visible");
    };

    const handlePageHide = () => {
      trackSectionDuration("page_hide");
    };

    sections.forEach((section) => observer.observe(section));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      observer.disconnect();
      trackSectionDuration("unmount");
    };
  }, []);

  useEffect(() => {
    const restoredState = readStoredSurveyState();
    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      if (restoredState.registrationSubmitted) {
        setPhoneValue(restoredState.contactValue);
        setEmailValue(restoredState.email);
        setRegistrationSubmitted(restoredState.registrationSubmitted);
        setSubmissionKey(restoredState.submissionKey);
        setSurveyDraft(restoredState.surveyDraft);
        setFlowStage(restoredState.flowStage);
        setIsSurveyComplete(restoredState.isSurveyComplete);
        setSurveyStatusMessage(restoredState.surveyStatusMessage);
        track("survey_restored");
      }

      setHasRestoredSurveyState(true);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !hasRestoredSurveyState ||
      !submissionKey
    ) {
      return;
    }

    const payload: SurveyStorage = {
      contactMode: "phone",
      contactValue: phoneValue,
      email: emailValue,
      submissionKey,
      surveyDraft,
      surveyCompleted: isSurveyComplete,
    };

    window.localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(payload));
  }, [
    emailValue,
    hasRestoredSurveyState,
    isSurveyComplete,
    phoneValue,
    submissionKey,
    surveyDraft,
  ]);

  useEffect(() => {
    if (typeof document === "undefined" || flowStage === "idle") return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [flowStage]);

  function queueSurveySave(
    payload: SurveyRequestPayload,
    options?: {
      silent?: boolean;
    },
  ) {
    const silent = options?.silent ?? false;
    setSurveySaveCount((count) => count + 1);

    if (!silent) {
      setSurveyStatusMessage("답변을 저장하고 있어요...");
    }

    const request = surveySaveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await saveSurveyRequest(payload);

          if (!silent) {
            setSurveyError(null);
            setSurveyStatusMessage(
              payload.completed ? null : "답변이 저장되었어요.",
            );
          }
          return true;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "답변 저장 중 오류가 발생했습니다.";

          if (!silent) {
            setSurveyError(message);
            setSurveyStatusMessage("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
          }

          track("survey_save_error", { step: payload.step, error: message });
          return false;
        } finally {
          setSurveySaveCount((count) => Math.max(0, count - 1));
        }
      });

    surveySaveChainRef.current = request.then(() => undefined);
    return request;
  }

  function updateSurveyDraft(updater: (draft: SurveyDraft) => SurveyDraft) {
    setSurveyError(null);
    setSurveyStatusMessage(
      flowStage === 5
        ? "제출 버튼을 누르면 답변이 저장됩니다."
        : "다음 버튼을 누르면 답변이 저장됩니다.",
    );
    setSurveyDraft((currentDraft) => updater(currentDraft));
  }

  function setStep(step: SurveyStep) {
    setFlowStage(step);
    setSurveyDraft((currentDraft) => ({
      ...currentDraft,
      currentStep: step,
    }));
  }

  function openRegistration(location: string) {
    track("cta_clicked", { location });

    if (registrationSubmitted) {
      if (isSurveyComplete) {
        setFlowStage("complete");
      } else {
        setSurveyStatusMessage("이전 설문 내용을 이어서 작성할 수 있어요.");
        setFlowStage(surveyDraft.currentStep);
      }
      return;
    }

    setSubmitError(null);
    setFlowStage("form");
  }

  function closeForm() {
    setSubmitError(null);
    setFlowStage("idle");
  }

  async function handleRegistrationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    setSurveyError(null);

    const normalizedPhone = normalizePhoneNumber(phoneValue);
    if (!normalizedPhone) {
      setIsSubmitting(false);
      setSubmitError("전화번호를 다시 확인해 주세요. 숫자만 입력해도 괜찮아요.");
      return;
    }

    const trimmedEmail = emailValue.trim();
    let normalizedEmail = "";
    if (trimmedEmail) {
      const validatedEmail = normalizeContactValue("email", trimmedEmail);
      if (!validatedEmail) {
        setIsSubmitting(false);
        setSubmitError("이메일 주소를 다시 확인해 주세요. 비워두셔도 괜찮아요.");
        return;
      }
      normalizedEmail = validatedEmail;
    }

    if (!consentChecked) {
      setIsSubmitting(false);
      setSubmitError("개인정보 수집·이용에 동의해 주세요.");
      return;
    }

    track("registration_submitted", {
      contact_mode: "phone",
      has_email: Boolean(normalizedEmail),
    });

    const nextSubmissionKey = crypto.randomUUID();
    const nextDraft = createInitialSurveyDraft();

    setPhoneValue(normalizedPhone);
    setEmailValue(normalizedEmail);
    setRegistrationSubmitted(true);
    setSubmissionKey(nextSubmissionKey);
    setSurveyDraft(nextDraft);
    setFlowStage(1);
    setIsSurveyComplete(false);
    setSurveyStatusMessage("사전 등록을 저장하고 있어요.");

    setRegistrationSaveCount((count) => count + 1);

    try {
      await saveRegistrationRequest({
        contactMode: "phone",
        value: normalizedPhone,
        email: normalizedEmail,
        submissionKey: nextSubmissionKey,
        variant: LANDING_VARIANT,
      });

      setSurveyStatusMessage("다음 버튼을 누르면 답변이 저장됩니다.");
      track("registration_success", {
        contact_mode: "phone",
        has_email: Boolean(normalizedEmail),
        submission_key: nextSubmissionKey,
        variant: LANDING_VARIANT,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      setSurveyError("등록 내용을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setSurveyStatusMessage("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      track("registration_error", { contact_mode: "phone", error: message });
    } finally {
      setRegistrationSaveCount((count) => Math.max(0, count - 1));
      setIsSubmitting(false);
    }
  }

  async function handleSurveyNext() {
    if (!isSurveyStep(flowStage)) return;
    if (!submissionKey) return;

    const validationError = getSurveyStepError(flowStage, surveyDraft);
    if (validationError) {
      setSurveyError(validationError);
      return;
    }

    const currentStep = flowStage;

    if (currentStep === 5) {
      setSurveyError(null);
      setIsSurveyComplete(true);
      setFlowStage("complete");
      setSurveyStatusMessage(null);
      track("survey_completed", {
        submission_key: submissionKey,
        ...getThoughtCategoryEventProps(surveyDraft),
        branch_target: getSurveyBranchTargetFromChoice(
          surveyDraft.branchChoice,
          surveyDraft.currentMethods,
        ),
        branch_choice: surveyDraft.branchChoice,
      });

      void queueSurveySave(
        createSurveySavePayload(submissionKey, 5, surveyDraft, true),
        { silent: true },
      );
      return;
    }

    const nextStep = (currentStep + 1) as SurveyStep;
    setSurveyError(null);
    setStep(nextStep);
    setSurveyStatusMessage(
      nextStep === 5
        ? "제출 버튼을 누르면 답변이 저장됩니다."
        : "다음 버튼을 누르면 답변이 저장됩니다.",
    );
    track("survey_step_completed", {
      step: currentStep,
      next_step: nextStep,
      ...getThoughtCategoryEventProps(surveyDraft),
      branch_target: getSurveyBranchTargetFromChoice(
        surveyDraft.branchChoice,
        surveyDraft.currentMethods,
      ),
      branch_choice: surveyDraft.branchChoice,
    });

    void queueSurveySave(
      createSurveySavePayload(submissionKey, nextStep, surveyDraft, false),
      { silent: true },
    );
  }

  function handleSurveyBack() {
    if (
      flowStage === 2 ||
      flowStage === 3 ||
      flowStage === 4 ||
      flowStage === 5
    ) {
      setStep((flowStage - 1) as SurveyStep);
    }
  }

  function handleSurveyClose() {
    setSurveyError(null);
    setFlowStage("complete");
    setSurveyStatusMessage(null);
  }

  function handleComplete() {
    setFlowStage("idle");
    setSurveyStatusMessage(null);
  }

  function toggleMethod(method: SurveyMethod) {
    const hasMethod = surveyDraft.currentMethods.includes(method);
    const nextMethods = hasMethod
      ? surveyDraft.currentMethods.filter((item) => item !== method)
      : [...surveyDraft.currentMethods, method];
    const nextDraft = {
      ...surveyDraft,
      currentMethods: nextMethods,
      currentMethodsOther: "",
      branchChoice: normalizeBranchChoice(surveyDraft.branchChoice),
    };

    updateSurveyDraft(() => nextDraft);

    if (!submissionKey || flowStage !== 3) {
      return;
    }

    void queueSurveySave(
      createSurveySavePayload(submissionKey, 3, nextDraft, false),
      { silent: true },
    );
  }

  function toggleBranchChoice(branchChoice: string) {
    const nextDraft = {
      ...surveyDraft,
      branchChoice,
    };

    updateSurveyDraft(() => nextDraft);

    if (!submissionKey || flowStage !== 4) {
      return;
    }

    void queueSurveySave(
      createSurveySavePayload(submissionKey, 4, nextDraft, false),
      { silent: true },
    );
  }

  function toggleBiggestGap(option: BiggestGapOption) {
    const hasOption = surveyDraft.biggestGap.includes(option);
    const nextDraft = {
      ...surveyDraft,
      biggestGap: hasOption
        ? surveyDraft.biggestGap.filter((item) => item !== option)
        : [...surveyDraft.biggestGap, option],
    };

    updateSurveyDraft(() => nextDraft);

    if (!submissionKey || flowStage !== 5) {
      return;
    }

    void queueSurveySave(
      createSurveySavePayload(submissionKey, 5, nextDraft, false),
      { silent: true },
    );
  }

  const surveyStep = isSurveyStep(flowStage) ? flowStage : null;

  return (
    <div className={styles.page}>
      <header
        className={`${styles.header} ${isScrolled ? styles.headerScrolled : ""}`}
        id="top"
      >
        <div className={styles.headerInner}>
          <a className={styles.brand} href="#top" aria-label="Untangle 홈">
            <LogoMark />
            <span className={styles.brandName}>Untangle</span>
          </a>
          <button
            type="button"
            className={styles.headerCta}
            onClick={() => openRegistration("header")}
          >
            사전 등록
          </button>
        </div>
      </header>

      <main>
        <section className={styles.hero} data-section="hero">
          <div className={styles.inner}>
            <div className={styles.eyebrowPill}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              <span>출시 예정 · 사전 등록 받는 중</span>
            </div>
            <h1 className={styles.heroHeadline}>
              해야 할 일은 아는데,
              <br />
              시작이 안 될 때
            </h1>
            <p className={styles.heroSub}>
              지금 할 1개를 대신 골라주지 않아요. 머릿속을 함께 정리하고, 당신이
              고른 일을 지금 붙을 수 있는 첫 행동으로 쪼개줘요.
            </p>
            <div className={styles.demoBlock}>
              <PhoneMockup
                onPlay={() => {
                  track("demo_clicked");
                  openRegistration("hero_demo");
                }}
              />
              <p className={styles.demoCaption}>프로토타입 미리보기 · 30초</p>
            </div>
            <div className={styles.ctaWrap}>
              <CtaButton onClick={() => openRegistration("hero")} />
            </div>
          </div>
        </section>

        <section className={styles.problem} data-section="problem">
          <div className={styles.inner}>
            <span className={styles.rule} aria-hidden="true" />
            <h2 className={styles.problemMain}>
              메모엔 다 있는데,
              <br />
              시작이 안 됐다면
            </h2>
            <p className={styles.problemSub}>
              종이에, 메모앱에, 투두에 적기는 했어요. 그런데 목록은 길어지고, 손은
              안 움직이고, 밀린 걸 보면 더 미루게 되죠.
            </p>
            <p className={styles.problemEmphasis}>
              부족한 건 ‘적는 도구’가 아니라, 적은 게 시작으로 이어지는 그 한
              칸이에요.
            </p>
          </div>
        </section>

        <section className={styles.diff} data-section="differentiation">
          <div className={styles.inner}>
            <div className={styles.diffHeading}>
              <p className={styles.eyebrowLabel}>어떻게 다를까요</p>
              <h2 className={styles.sectionTitle}>적은 것이, 시작이 되도록</h2>
            </div>
            <div className={styles.diffCards}>
              {diffBlocks.map((block) => (
                <article key={block.num} className={styles.diffCard}>
                  <div className={styles.diffCardHead}>
                    <span className={styles.diffBadge}>{block.num}</span>
                    <h3 className={styles.diffCardTitle}>
                      {block.title.split("\n").map((line, index) => (
                        <span key={line} className={styles.diffCardTitleLine}>
                          {index > 0 ? <br /> : null}
                          {line}
                        </span>
                      ))}
                    </h3>
                  </div>
                  <p className={styles.diffIntro}>{block.intro}</p>
                  <span className={styles.diffDivider} aria-hidden="true" />
                  <ul className={styles.diffBullets}>
                    {block.bullets.map((bullet) => (
                      <li key={bullet} className={styles.diffBullet}>
                        <CheckIcon className={styles.diffBulletCheck} />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.who} data-section="audience">
          <div className={styles.inner}>
            <p className={styles.whoEyebrow}>누구를 위한 건가요</p>
            <h2 className={styles.whoHeading}>
              여러 앱 다 써봤는데도,
              <br />
              시작에서 무너진다면
            </h2>
            <p className={styles.whoBody}>
              메모앱·투두·플래너에 적기는 하는데 그게 시작으로 안 이어지는 분들을
              위해 만들고 있어요.
            </p>
            <div className={styles.stats}>
              <p className={styles.statsLabel}>참고 — ADHD 연구가 말해주는 것</p>
              <div className={styles.statsRow}>
                {audienceStats.map((stat) => (
                  <div key={stat.num} className={styles.statItem}>
                    <span className={styles.statNum}>{stat.num}</span>
                    <span className={styles.statCaption}>{stat.caption}</span>
                    <span className={styles.statSource}>{stat.source}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.finalCta} data-section="final_cta">
          <div className={styles.inner}>
            <h2 className={styles.finalTitle}>지금, 첫 칸을 같이 만들어요</h2>
            <p className={styles.finalSub}>
              출시되면 등록하신 번호로 가장 먼저 알려드릴게요.
            </p>
            <div className={styles.ctaWrap}>
              <CtaButton onClick={() => openRegistration("final")} />
            </div>
            <div className={styles.footerLinks}>
              <Link href="/privacy" className={styles.footerLink}>
                개인정보 처리방침
              </Link>
              <a
                href="https://open.kakao.com/o/sgF3hZyi"
                target="_blank"
                rel="noreferrer"
                className={styles.footerLink}
              >
                문의하기
              </a>
            </div>
          </div>
        </section>
      </main>

      {flowStage === "form" ? (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.sheet}>
            <div className={styles.sheetTopbar}>
              <button
                type="button"
                className={styles.sheetClose}
                onClick={closeForm}
                aria-label="닫기"
              >
                <CloseIcon className={styles.sheetCloseIcon} />
              </button>
            </div>
            <div className={styles.formHeader}>
              <p className={styles.formEyebrow}>사전 등록</p>
              <h2 className={styles.formTitle}>사전 등록하기</h2>
              <p className={styles.formSubcopy}>출시되면 가장 먼저 알려드릴게요.</p>
            </div>
            <form className={styles.form} onSubmit={handleRegistrationSubmit}>
              <div className={styles.fields}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>휴대폰 번호</span>
                  <input
                    className={styles.input}
                    type="tel"
                    name="phone"
                    inputMode="numeric"
                    data-clarity-mask="true"
                    placeholder="010-0000-0000"
                    required
                    value={phoneValue}
                    onChange={(event) => {
                      setPhoneValue(event.target.value);
                      setSubmitError(null);
                    }}
                    onBlur={() => {
                      const normalized = normalizePhoneNumber(phoneValue);
                      if (normalized) {
                        setPhoneValue(normalized);
                      }
                    }}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>이메일 (선택)</span>
                  <input
                    className={styles.input}
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={emailValue}
                    onChange={(event) => {
                      setEmailValue(event.target.value);
                      setSubmitError(null);
                    }}
                  />
                </label>
              </div>

              <div className={styles.consentRow}>
                <button
                  type="button"
                  className={`${styles.checkbox} ${
                    consentChecked ? styles.checkboxOn : ""
                  }`}
                  role="checkbox"
                  aria-checked={consentChecked}
                  aria-label="개인정보 수집·이용 동의"
                  onClick={() => {
                    setConsentChecked((value) => !value);
                    setSubmitError(null);
                  }}
                >
                  {consentChecked ? (
                    <CheckIcon className={styles.checkboxCheck} />
                  ) : null}
                </button>
                <span className={styles.consentText}>
                  개인정보 수집·이용에 동의합니다
                </span>
                <Link href="/privacy" className={styles.consentLink}>
                  자세히
                </Link>
              </div>

              {submitError ? (
                <p className={styles.formError}>{submitError}</p>
              ) : null}

              <button
                type="submit"
                className={styles.submitButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? "등록 중..." : "사전 등록하기"}
              </button>
              <p className={styles.privacyNote}>
                등록하신 정보는 출시 안내 용도로만 사용돼요.
              </p>
            </form>
          </div>
        </div>
      ) : null}

      {surveyStep ? (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.sheet}>
            <div className={styles.surveyHeader}>
              <span className={styles.surveyStep}>{surveyStep}/5</span>
              <button
                type="button"
                className={styles.sheetClose}
                onClick={handleSurveyClose}
                disabled={isRegistrationSaving}
                aria-label="닫기"
              >
                <CloseIcon className={styles.sheetCloseIcon} />
              </button>
            </div>
            <div className={styles.progressTrack}>
              <span
                className={styles.progressFill}
                style={{ width: `${(surveyStep / 5) * 100}%` }}
              />
            </div>

            <div className={styles.surveyBody}>
              <h3 className={styles.surveyTitle}>{surveyMeta[surveyStep].title}</h3>
              <p className={styles.surveyDesc}>{surveyMeta[surveyStep].body}</p>

              <div className={styles.optionList}>
                {surveyStep === 1
                  ? thoughtCategoryOptions.map((option) => (
                      <OptionItem
                        key={option.id}
                        checked={surveyDraft.thoughtCategory === option.id}
                        inputType="radio"
                        name="thought-category"
                        label={option.label}
                        onChange={() =>
                          updateSurveyDraft((draft) => ({
                            ...draft,
                            thoughtCategory: option.id,
                          }))
                        }
                      />
                    ))
                  : null}

                {surveyStep === 2
                  ? painMomentOptions.map((option) => (
                      <OptionItem
                        key={option.id}
                        checked={surveyDraft.painMoment === option.id}
                        inputType="radio"
                        name="pain-moment"
                        label={option.label}
                        onChange={() =>
                          updateSurveyDraft((draft) => ({
                            ...draft,
                            painMoment: option.id,
                          }))
                        }
                      />
                    ))
                  : null}

                {surveyStep === 3
                  ? surveyOptions.map((option) => (
                      <OptionItem
                        key={option.id}
                        checked={surveyDraft.currentMethods.includes(option.id)}
                        inputType="checkbox"
                        name="current-methods"
                        label={option.label}
                        onChange={() => toggleMethod(option.id)}
                      />
                    ))
                  : null}

                {surveyStep === 4
                  ? primaryMethodOptions.map((option) => (
                      <OptionItem
                        key={option.id}
                        checked={surveyDraft.branchChoice === option.id}
                        inputType="radio"
                        name="branch-choice"
                        label={option.label}
                        onChange={() => toggleBranchChoice(option.id)}
                      />
                    ))
                  : null}

                {surveyStep === 5
                  ? biggestGapOptions.map((option) => (
                      <OptionItem
                        key={option.id}
                        checked={surveyDraft.biggestGap.includes(option.id)}
                        inputType="checkbox"
                        name="biggest-gap"
                        label={option.label}
                        onChange={() => toggleBiggestGap(option.id)}
                      />
                    ))
                  : null}
              </div>

              {surveyError ? (
                <p className={styles.surveyError}>{surveyError}</p>
              ) : null}
              <p className={styles.surveyStatus}>
                {isRegistrationSaving
                  ? "사전 등록을 저장하고 있어요..."
                  : isSurveySaving
                  ? "답변을 저장하고 있어요..."
                  : surveyStatusMessage}
              </p>
            </div>

            <div className={styles.surveyFooter}>
              {surveyStep > 1 ? (
                <button
                  type="button"
                  className={styles.surveyBack}
                  onClick={handleSurveyBack}
                  disabled={isRegistrationSaving}
                >
                  이전
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                className={styles.surveyNext}
                onClick={() => void handleSurveyNext()}
                disabled={isRegistrationSaving}
              >
                {surveyStep === 5 ? "제출하기" : "다음"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {flowStage === "complete" ? (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={`${styles.sheet} ${styles.completeSheet}`}>
            <span className={styles.completeBadgeRing}>
              <span className={styles.completeBadge}>
                <CheckIcon className={styles.completeCheck} />
              </span>
            </span>
            <div className={styles.completeText}>
              <h2 className={styles.completeHeadline}>사전 등록 완료!</h2>
              <p className={styles.completeBody}>
                출시되면 등록하신 번호로 가장 먼저 안내드릴게요. 기다려 주셔서
                고마워요.
              </p>
              <p className={styles.completeSupport}>
                마음이 편해지는 Untangle, 곧 만나요.
              </p>
            </div>
            <button
              type="button"
              className={styles.homeButton}
              onClick={handleComplete}
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
