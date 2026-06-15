"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { initAmplitude, track } from "@/lib/amplitude";
import { initClarity } from "@/lib/clarity";
import type { ContactMode } from "@/lib/contact";
import { normalizeContactValue, normalizePhoneNumber } from "@/lib/contact";
import { LANDING_VARIANT, type LandingVariant } from "@/lib/experiment";
import styles from "./page.module.css";

type Feature = {
  eyebrow: string;
  title: string;
  titleAccent: string;
  description: string;
  bullets: string[];
  image: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
  visualTone?: "default" | "dark";
  reverse?: boolean;
};

type Stat = {
  value: string;
  text: string;
  sourceLabel: string;
  sourceHref: string;
};

type Faq = {
  question: string;
  answer: string[];
};

type SurveyMethod =
  | "endure"
  | "notes"
  | "calendar"
  | "ai"
  | "support"
  | "other";

type ThoughtCategoryOption =
  | "work"
  | "study"
  | "life_management"
  | "relationships"
  | "self_improvement"
  | "other";

type PainMomentOption =
  | "deadline_rush"
  | "cant_start"
  | "didnt_recheck"
  | "missed_priority"
  | "lost_focus"
  | "plan_fell_apart"
  | "froze_from_volume"
  | "forgot_schedule"
  | "none";

type BiggestGapOption =
  | "record_only"
  | "priority_hard"
  | "plan_fell_apart"
  | "still_procrastinate"
  | "hard_to_understand"
  | "replanning_is_annoying"
  | "too_many_apps"
  | "not_personal"
  | "no_major_issue"
  | "other";

type SurveyStep = 1 | 2 | 3 | 4;

type SurveyStage = SurveyStep | "done" | null;

type SurveyDraft = {
  currentStep: SurveyStep;
  thoughtCategory: ThoughtCategoryOption | "";
  thoughtCategoryOther: string;
  painMoment: PainMomentOption | "";
  currentMethods: SurveyMethod[];
  currentMethodsOther: string;
  biggestGapSelections: BiggestGapOption[];
  biggestGapOther: string;
};

type SurveyStorage = {
  contactMode: ContactMode;
  contactValue: string;
  submissionKey: string;
  surveyDraft: SurveyDraft;
  surveyCompleted: boolean;
};

type LegacySurveyDraft = Partial<SurveyDraft> & {
  currentStep?: number;
  thoughtCategory?: string;
  thoughtCategoryOther?: string;
  painMoment?: string;
  currentMethods?: SurveyMethod[];
  currentMethodsOther?: string;
  biggestGap?: string;
  biggestGapSelections?: BiggestGapOption[];
  biggestGapOther?: string;
};

type RegisterRequestPayload = {
  contactMode: ContactMode;
  value: string;
  submissionKey: string;
  variant: LandingVariant;
};

type SurveyRequestPayload = {
  submissionKey: string;
  step: SurveyStep;
  thoughtCategory: string;
  thoughtCategoryOther: string;
  painMoment: string;
  currentMethods: SurveyMethod[];
  currentMethodsOther: string;
  biggestGap: string;
  completed: boolean;
};

type RestoredSurveyState = {
  contactMode: ContactMode;
  contactValue: string;
  registrationSubmitted: boolean;
  submissionKey: string | null;
  surveyDraft: SurveyDraft;
  surveyStage: SurveyStage;
  isSurveyComplete: boolean;
  surveyStatusMessage: string | null;
};

const SURVEY_STORAGE_KEY = "untangle-survey-progress";

const thoughtCategoryOptions: {
  id: ThoughtCategoryOption;
  label: string;
}[] = [
  { id: "work", label: "일" },
  { id: "study", label: "공부" },
  { id: "life_management", label: "생활관리" },
  { id: "relationships", label: "인간관계" },
  { id: "self_improvement", label: "자기계발" },
  { id: "other", label: "기타" },
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
    label: "할 일을 적어뒀지만 다시 확인하지 않았어요",
  },
  {
    id: "missed_priority",
    label: "이것저것 하다가 중요한 일을 놓쳤어요",
  },
  {
    id: "plan_fell_apart",
    label: "계획은 세웠지만 하루가 지나면 흐트러졌어요",
  },
  {
    id: "froze_from_volume",
    label: "해야 할 일이 너무 많아 보여서 그냥 멈춰 있었어요",
  }
];

const surveyOptions: { id: SurveyMethod; label: string }[] = [
  { id: "endure", label: "그냥 버티고 있어요" },
  { id: "notes", label: "메모/투두앱을 써요" },
  { id: "calendar", label: "캘린더/알람을 써요" },
  { id: "ai", label: "AI를 써요" },
  { id: "support", label: "약/상담/주변 도움을 받아요" },
  { id: "other", label: "기타" },
];

const biggestGapOptions: { id: BiggestGapOption; label: string }[] = [
  {
    id: "record_only",
    label: "적어두기만 하고 실제로 시작하게 되지는 않았어요",
  },
  {
    id: "priority_hard",
    label: "할 일이 너무 많을 때 우선순위를 정하기 어려웠어요",
  },
  {
    id: "plan_fell_apart",
    label: "계획을 세워도 금방 흐트러졌어요",
  },
  {
    id: "hard_to_understand",
    label: "내가 왜 자꾸 미루는지 파악하기 어려웠어요",
  },
  {
    id: "replanning_is_annoying",
    label: "상황이 바뀌면 계획을 다시 짜기 귀찮았어요",
  },
  {
    id: "other",
    label: "기타",
  },
];

const valueProps = [
  {
    title: "나만을 위한 ADHD 파트너",
    body: "Untangle은 당신의 고유한 어려움과 강점을 이해하고, 함께 발전해 나가는 맞춤형 전략을 제안합니다.",
    icon: "brain",
  },
  {
    title: "똑똑한 하루 계획과 할 일 관리",
    body: "벅찬 일을 실행 가능한 단계로 나누고, 하루의 우선순위를 정하고, 상황에 맞게 계획을 조정할 수 있도록 도와줍니다.",
    icon: "calendar",
  },
  {
    title: "언제나 곁에 있는 ADHD 동반자",
    body: "필요한 순간마다 알림, 집중 전략, 그리고 다시 움직일 수 있는 힘을 낮과 밤 구분 없이 건네드립니다.",
    icon: "chat",
  },
];

const features: Feature[] = [
  {
    eyebrow: "생산성을 높이는 방식",
    title: "ADHD에 맞춰 설계된 할 일 관리",
    titleAccent: "할 일 관리",
    description: "Untangle은 당신의 할 일을 이렇게 함께 정리합니다:",
    bullets: [
      "그날의 에너지에 맞춰 하루 계획을 세워주고",
      "복잡한 프로젝트를 실행 가능한 단계로 나누고",
      "하루 동안 바뀌는 상황에 맞게 유연하게 조정합니다",
    ],
    image: {
      src: "/source-assets/feature-1-cutout.png",
      alt: "Untangle task planner screenshot",
      width: 1070,
      height: 1456,
    },
  },
  {
    eyebrow: "나에게 맞는 코칭",
    title: "개인화된 ADHD 코칭",
    titleAccent: "ADHD 코칭",
    description:
      "Untangle은 당신에게 맞는 실행 전략을 함께 설계합니다:",
    bullets: [
      "당신의 ADHD 강점과 반복되는 어려움을 파악하고",
      "실제로 지속 가능한 전략을 함께 만들고",
      "필요한 순간마다 바로 실행할 수 있는 가이드를 제공합니다",
    ],
    image: {
      src: "/source-assets/feature-2-cutout.png",
      alt: "Untangle coaching support screenshot",
      width: 1070,
      height: 1456,
    },
    reverse: true,
  },
  {
    eyebrow: "흐름을 놓치지 않도록",
    title: "먼저 챙겨주는 AI 어시스턴트",
    titleAccent: "AI 어시스턴트",
    description: "Untangle은 당신이 기억해내길 기다리지 않습니다:",
    bullets: [
      "할 일을 시작할 수 있도록 적절한 순간에 가볍게 알려주고",
      "중요한 일정이나 미뤄둔 일을 놓치지 않게 점검해주고",
      "그날의 흐름에 맞는 실행 전략을 바로 제안합니다",
    ],
    image: {
      src: "/source-assets/feature-3-cutout.png",
      alt: "Untangle proactive messages screenshot",
      width: 1080,
      height: 1444,
    },
    visualTone: "dark",
  },
];

const stats: Stat[] = [
  {
    value: "4.4%",
    text: "성인 중 4.4%가 ADHD를 겪고 있지만, 도움을 받는 비율은 20% 미만입니다",
    sourceLabel: "Source: National Institute of Health",
    sourceHref:
      "https://www.nimh.nih.gov/health/statistics/attention-deficit-hyperactivity-disorder-adhd",
  },
  {
    value: "80%",
    text: "ADHD를 가진 성인의 80%는 정리, 시간 관리, 할 일 완료에 어려움을 겪습니다",
    sourceLabel: "Source: Journal of Attention Disorders",
    sourceHref: "https://www.ncbi.nlm.nih.gov/",
  },
  {
    value: "3X",
    text: "ADHD를 가진 성인은 스트레스, 우울, 정서적 어려움을 겪을 가능성이 3배 높습니다",
    sourceLabel: "Source: National Comorbidity Survey Replication",
    sourceHref: "https://www.ncbi.nlm.nih.gov/",
  },
];

const faqs: Faq[] = [
  {
    question: "Untangle은 ChatGPT 같은 일반 AI와 무엇이 다른가요?",
    answer: [
      "ChatGPT 같은 일반 AI도 대화를 도와줄 수는 있지만, ADHD 지원을 위해 특별히 설계된 도구는 아닙니다.",
      "Untangle은 일정과 할 일 맥락을 이해하는 ADHD 전용 코치이자 어시스턴트로 설계되었습니다. 시간이 지날수록 사용자의 패턴, 어려움, 목표를 더 깊이 이해하게 되고, 그에 맞는 더 개인화된 전략을 제안할 수 있습니다.",
    ],
  },
  {
    question: "왜 일반적인 투두 앱이나 일정 관리 앱 대신 Untangle을 써야 하나요?",
    answer: [
      "ADHD가 있는 많은 사람들에게는 투두 리스트를 만드는 일 자체도 버겁게 느껴질 수 있습니다. 일반 앱은 의욕이 충분할 때는 도움이 되지만, 막막하거나 집중이 흐트러질 때는 한계가 있습니다.",
      "Untangle은 하루 상태에 맞춰 계획 수준을 조절하고, 할 일을 작은 단계로 나누고, 필요한 타이밍에 리마인드를 제공합니다. 단순히 적어두는 앱이 아니라, 실제로 실행까지 이어지도록 돕는 도구입니다.",
    ],
  },
  {
    question: "SNS에서 자주 보이는 다른 ADHD 앱과는 무엇이 다른가요?",
    answer: [
      "많은 ADHD 앱은 정보 제공이나 일반적인 팁 중심으로 구성되어 있습니다. 그런 정보도 유용하지만, 실제 하루를 운영하는 데에는 별도의 실행 도구가 필요합니다.",
      "Untangle은 ADHD 관리에 대한 이해를 바탕으로, 매일의 일정과 할 일 안에서 바로 실행할 수 있는 형태로 도움을 제공합니다. 즉, 지식 전달을 넘어서 실제 행동 변화까지 연결하는 데 초점이 있습니다.",
    ],
  },
  {
    question: "Untangle이 정말 제 ADHD 특성을 이해할 수 있나요?",
    answer: [
      "네. Untangle은 각 사용자의 ADHD 패턴을 더 깊고 구체적으로 이해하도록 설계되어 있습니다.",
      "단순히 정해진 답을 반복하는 AI가 아니라, 지속적인 상호작용을 통해 사용자의 습관, 어려움, 선호하는 방식 등을 학습합니다. 사용할수록 더 정확하게 필요를 예측하고, 더 맞춤형 전략을 제안할 수 있습니다.",
    ],
  },
  {
    question: "공식적으로 ADHD 진단을 받지 않았어도 사용할 수 있나요?",
    answer: [
      "물론입니다. Untangle은 공식 진단을 받은 사람만을 위한 도구가 아닙니다.",
      "ADHD와 비슷한 어려움을 겪고 있거나, 실행 기능 문제로 일상 관리가 어렵거나, 전반적으로 신경다양성 맥락에서 도움이 필요한 경우에도 유용할 수 있습니다. 다만 ADHD나 다른 인지 특성이 의심된다면 전문가 상담은 함께 받아보는 것을 권장합니다.",
    ],
  },
  {
    question: "Untangle을 쓰다 보면 AI에 의존하게 되지 않을까요?",
    answer: [
      "그렇지 않습니다. Untangle의 목표는 사용자가 ADHD를 더 잘 관리할 수 있도록 돕는 것입니다.",
      "장기적으로는 스스로 조절하고 실행하는 힘을 키우는 방향을 지향합니다. 시간이 지나면서 Untangle은 밀착 코치라기보다, 당신이 하루를 어떻게 운영하는지 잘 아는 스마트한 보조 도구에 가까워질 수 있습니다.",
    ],
  },
  {
    question: "Untangle이 인간 코치나 치료사를 대체할 수 있나요?",
    answer: [
      "Untangle은 유용한 지원 도구이지만, 전문적인 의료 조언이나 치료를 대신할 수는 없습니다.",
      "기존 치료나 코칭과 함께 사용할 때 더 효과적일 수 있습니다. 일상적인 실행 지원과 진행 상황 추적을 통해 전문적인 도움을 보완하는 역할을 합니다.",
    ],
  },
  {
    question: "내 데이터는 안전한가요?",
    answer: [
      "Untangle은 개인정보 보호와 데이터 보안을 매우 중요하게 다룹니다. 업계 표준 수준의 암호화와 엄격한 데이터 보호 원칙을 따릅니다.",
      "개인정보는 판매되거나 제3자와 공유되지 않으며, 일부 AI 서비스처럼 다른 목적의 모델 학습에 임의로 사용되지 않습니다. 원하면 언제든 데이터 삭제를 요청할 수 있습니다.",
    ],
  },
  {
    question: "Untangle은 언제 사용할 수 있고, 가격은 어떻게 되나요?",
    answer: [
      "출시 후에는 무료 체험 기간을 통해 Untangle의 기능을 직접 경험해볼 수 있습니다.",
      "초기 사용자에게는 베타 또는 파일럿 기간 동안 특별 할인 혜택이 제공될 예정입니다. 정확한 가격은 출시 시점에 더 가까워지면 안내되며, 목표는 높은 품질의 개인화된 지원을 유지하면서도 최대한 많은 사람이 접근할 수 있게 하는 것입니다.",
    ],
  },
];

function createInitialSurveyDraft(): SurveyDraft {
  return {
    currentStep: 1,
    thoughtCategory: "",
    thoughtCategoryOther: "",
    painMoment: "",
    currentMethods: [],
    currentMethodsOther: "",
    biggestGapSelections: [],
    biggestGapOther: "",
  };
}

function getSurveyStepError(step: SurveyStep, draft: SurveyDraft) {
  if (step === 1) {
    if (!draft.thoughtCategory) {
      return "가장 생각을 정리하기 어려운 카테고리를 골라주세요.";
    }

    if (
      draft.thoughtCategory === "other" &&
      !draft.thoughtCategoryOther.trim()
    ) {
      return "기타를 선택하셨다면 내용을 함께 적어주세요.";
    }
  }

  if (step === 2 && !draft.painMoment) {
    return "최근 2주 동안 가장 힘들었던 순간을 하나 골라주세요.";
  }

  if (step === 3) {
    if (draft.currentMethods.length === 0) {
      return "지금 버티는 방법을 한 가지 이상 골라주세요.";
    }

    if (
      draft.currentMethods.includes("other") &&
      !draft.currentMethodsOther.trim()
    ) {
      return "기타를 선택하셨다면 내용을 함께 적어주세요.";
    }
  }

  if (step === 4) {
    if (draft.biggestGapSelections.length === 0) {
      return "지금 방법에서 가장 아쉬운 점을 한 가지 이상 골라주세요.";
    }

    if (
      draft.biggestGapSelections.includes("other") &&
      !draft.biggestGapOther.trim()
    ) {
      return "기타를 선택하셨다면 내용을 함께 적어주세요.";
    }
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

function parseChoiceArray<T extends string>(
  options: { id: T; label: string }[],
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const matchedOption = options.find((option) => option.id === item);
    return matchedOption ? [matchedOption.id] : [];
  });
}

function parseBiggestGapFallback(value: unknown): {
  biggestGapSelections: BiggestGapOption[];
  biggestGapOther: string;
} {
  if (typeof value !== "string" || !value.trim()) {
    return {
      biggestGapSelections: [] as BiggestGapOption[],
      biggestGapOther: "",
    };
  }

  const parts = value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  const selections: BiggestGapOption[] = [];
  let biggestGapOther = "";

  for (const part of parts.length > 0 ? parts : [value.trim()]) {
    if (part.startsWith("기타:")) {
      selections.push("other");
      biggestGapOther = part.slice(3).trim();
      continue;
    }

    const matchedOption = biggestGapOptions.find(
      (option) => option.id === part || option.label === part,
    );

    if (matchedOption) {
      selections.push(matchedOption.id);
    }
  }

  if (selections.length === 0 && !biggestGapOther) {
    return {
      biggestGapSelections: ["other"] as BiggestGapOption[],
      biggestGapOther: value.trim(),
    };
  }

  return {
    biggestGapSelections: Array.from(new Set(selections)),
    biggestGapOther,
  };
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
    savedDraft.currentStep === 4
      ? savedDraft.currentStep
      : 1;

  const currentStep: SurveyStep = thoughtCategory ? normalizedCurrentStep : 1;

  const currentMethods = parseChoiceArray(surveyOptions, savedDraft.currentMethods);
  const parsedBiggestGap: {
    biggestGapSelections: BiggestGapOption[];
    biggestGapOther: string;
  } =
    parseChoiceArray(biggestGapOptions, savedDraft.biggestGapSelections).length > 0
      ? {
          biggestGapSelections: parseChoiceArray(
            biggestGapOptions,
            savedDraft.biggestGapSelections,
          ),
          biggestGapOther:
            typeof savedDraft.biggestGapOther === "string"
              ? savedDraft.biggestGapOther
              : "",
        }
      : parseBiggestGapFallback(savedDraft.biggestGap ?? "");

  const biggestGapSelections: BiggestGapOption[] =
    parsedBiggestGap.biggestGapSelections.includes("no_major_issue")
      ? ["no_major_issue"]
      : parsedBiggestGap.biggestGapSelections.filter(
          (item, index, items) => items.indexOf(item) === index,
        );

  return {
    currentStep,
    thoughtCategory,
    thoughtCategoryOther:
      thoughtCategory === "other" &&
      typeof savedDraft.thoughtCategoryOther === "string"
        ? savedDraft.thoughtCategoryOther
        : "",
    painMoment: parseSingleChoice(painMomentOptions, savedDraft.painMoment) as
      | PainMomentOption
      | "",
    currentMethods,
    currentMethodsOther:
      currentMethods.includes("other") &&
      typeof savedDraft.currentMethodsOther === "string"
        ? savedDraft.currentMethodsOther
        : "",
    biggestGapSelections,
    biggestGapOther: biggestGapSelections.includes("other")
      ? parsedBiggestGap.biggestGapOther
      : "",
  };
}

function getChoiceLabel<T extends string>(
  options: { id: T; label: string }[],
  id: T,
) {
  return options.find((option) => option.id === id)?.label ?? "";
}

function serializeBiggestGap(draft: SurveyDraft) {
  return draft.biggestGapSelections
    .map((selection) => {
      if (selection === "other") {
        return `기타: ${draft.biggestGapOther.trim()}`;
      }

      return getChoiceLabel(biggestGapOptions, selection);
    })
    .filter(Boolean)
    .join(" | ");
}

function getThoughtCategoryEventProps(draft: SurveyDraft) {
  if (!draft.thoughtCategory) {
    return {};
  }

  return {
    thought_category: draft.thoughtCategory,
    ...(draft.thoughtCategory === "other" && draft.thoughtCategoryOther.trim()
      ? { thought_category_other: draft.thoughtCategoryOther.trim() }
      : {}),
  };
}

function createDefaultSurveyState(): RestoredSurveyState {
  const emptyDraft = createInitialSurveyDraft();

  return {
    contactMode: "phone",
    contactValue: "",
    registrationSubmitted: false,
    submissionKey: null,
    surveyDraft: emptyDraft,
    surveyStage: null,
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
      contactMode: parsed.contactMode ?? defaultState.contactMode,
      contactValue: parsed.contactValue ?? defaultState.contactValue,
      registrationSubmitted: Boolean(parsed.submissionKey),
      submissionKey: parsed.submissionKey ?? null,
      surveyDraft: restoredDraft,
      surveyStage: parsed.surveyCompleted ? null : restoredStep,
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
    thoughtCategoryOther:
      draft.thoughtCategory === "other" ? draft.thoughtCategoryOther.trim() : "",
    painMoment: draft.painMoment
      ? getChoiceLabel(painMomentOptions, draft.painMoment)
      : "",
    currentMethods: draft.currentMethods,
    currentMethodsOther: draft.currentMethodsOther.trim(),
    biggestGap: serializeBiggestGap(draft),
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

function BrainIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M19.5 10c-4.4 0-8 3.6-8 8v1c-2 1.2-3.5 3.5-3.5 6.2 0 3.4 2.4 6.2 5.7 6.8.4 3.5 3.4 6.3 7 6.3 1.7 0 3.3-.6 4.6-1.6 1.3 1 2.9 1.6 4.6 1.6 3.7 0 6.7-2.8 7-6.4 3.2-.7 5.6-3.5 5.6-6.8 0-2.7-1.5-5-3.5-6.2v-1c0-4.4-3.6-8-8-8-2.2 0-4.2.9-5.6 2.4A7.8 7.8 0 0 0 19.5 10Z" />
      <path d="M25.5 12.8v22.5M19.4 15.6c2 1 3.3 3 3.3 5.3v1.4c0 2.6-1.6 4.9-4 5.9m12.9-12.6c-2 1-3.3 3-3.3 5.3v1.4c0 2.6 1.6 4.9 4 5.9M16.4 24.6c1.9.1 3.6 1.1 4.7 2.7m10.5-2.7a6.4 6.4 0 0 0-4.7 2.7" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M13 10.5v6M35 10.5v6M11 17.5h26M14 37h20a3 3 0 0 0 3-3V15a3 3 0 0 0-3-3H14a3 3 0 0 0-3 3v19a3 3 0 0 0 3 3Z" />
      <path d="M18 24h6v7h-6zM31.5 17.3a5.8 5.8 0 1 1 0 11.5 5.8 5.8 0 0 1 0-11.5Zm0 0v3.2l2 1.8" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M11 13h26a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H23l-7.5 5v-5H11a3 3 0 0 1-3-3V16a3 3 0 0 1 3-3Z" />
      <path d="M16 21h16M16 26h10" />
    </svg>
  );
}

function ValueIcon({ type }: { type: string }) {
  if (type === "brain") return <BrainIcon />;
  if (type === "calendar") return <CalendarIcon />;
  return <ChatIcon />;
}

export default function Home() {
  const [openFaq, setOpenFaq] = useState(-1);
  const [isScrolled, setIsScrolled] = useState(false);
  const [contactMode, setContactMode] = useState<ContactMode>("phone");
  const [contactValue, setContactValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationSubmitted, setRegistrationSubmitted] = useState(false);
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [surveyDraft, setSurveyDraft] = useState<SurveyDraft>(
    createInitialSurveyDraft,
  );
  const [surveyStage, setSurveyStage] = useState<SurveyStage>(null);
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
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    initAmplitude();
    initClarity();
    track("page_viewed", { variant: LANDING_VARIANT });

    const sections = document.querySelectorAll("[data-section]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            track("section_viewed", {
              section: entry.target.getAttribute("data-section"),
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const restoredState = readStoredSurveyState();
    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      if (restoredState.registrationSubmitted) {
        setContactMode(restoredState.contactMode);
        setContactValue(restoredState.contactValue);
        setRegistrationSubmitted(restoredState.registrationSubmitted);
        setSubmissionKey(restoredState.submissionKey);
        setSurveyDraft(restoredState.surveyDraft);
        setSurveyStage(restoredState.surveyStage);
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
      contactMode,
      contactValue,
      submissionKey,
      surveyDraft,
      surveyCompleted: isSurveyComplete,
    };

    window.localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(payload));
  }, [
    contactMode,
    contactValue,
    hasRestoredSurveyState,
    isSurveyComplete,
    submissionKey,
    surveyDraft,
  ]);

  useEffect(() => {
    if (typeof document === "undefined" || surveyStage === null) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [surveyStage]);

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
      surveyStage === 4
        ? "제출 버튼을 누르면 답변이 저장됩니다."
        : "다음 버튼을 누르면 답변이 저장됩니다.",
    );
    setSurveyDraft((currentDraft) => updater(currentDraft));
  }

  function setStep(step: SurveyStep) {
    setSurveyStage(step);
    setSurveyDraft((currentDraft) => ({
      ...currentDraft,
      currentStep: step,
    }));
  }

  async function handleRegistrationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    setSurveyError(null);

    const normalizedValue = normalizeContactValue(contactMode, contactValue);
    if (!normalizedValue) {
      setIsSubmitting(false);
      setSubmitError(
        contactMode === "phone"
          ? "전화번호를 다시 확인해 주세요. 숫자만 입력해도 괜찮아요."
          : "이메일 주소를 다시 확인해 주세요.",
      );
      return;
    }

    track("registration_submitted", { contact_mode: contactMode });

    const nextSubmissionKey = crypto.randomUUID();
    const nextDraft = createInitialSurveyDraft();

    if (contactMode === "phone") {
      setContactValue(normalizedValue);
    } else {
      setContactValue(normalizedValue.trim());
    }

    setRegistrationSubmitted(true);
    setSubmissionKey(nextSubmissionKey);
    setSurveyDraft(nextDraft);
    setSurveyStage(1);
    setIsSurveyComplete(false);
    setSurveyStatusMessage("사전 등록을 저장하고 있어요.");

    setRegistrationSaveCount((count) => count + 1);

    try {
      await saveRegistrationRequest({
        contactMode,
        value: normalizedValue,
        submissionKey: nextSubmissionKey,
        variant: LANDING_VARIANT,
      });

      setSurveyStatusMessage("다음 버튼을 누르면 답변이 저장됩니다.");
      track("registration_success", {
        contact_mode: contactMode,
        submission_key: nextSubmissionKey,
        variant: LANDING_VARIANT,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "알 수 없는 오류";
      setSurveyError("등록 내용을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setSurveyStatusMessage("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      track("registration_error", { contact_mode: contactMode, error: message });
    } finally {
      setRegistrationSaveCount((count) => Math.max(0, count - 1));
      setIsSubmitting(false);
    }
  }

  async function handleSurveyNext() {
    if (surveyStage === null || surveyStage === "done") return;
    if (!submissionKey) return;

    const validationError = getSurveyStepError(surveyStage, surveyDraft);
    if (validationError) {
      setSurveyError(validationError);
      return;
    }

    const currentStep = surveyStage;

    if (currentStep === 4) {
      setSurveyError(null);
      setIsSurveyComplete(true);
      setSurveyStage("done");
      setSurveyStatusMessage(null);
      track("survey_completed", {
        submission_key: submissionKey,
        ...getThoughtCategoryEventProps(surveyDraft),
      });

      void queueSurveySave(
        createSurveySavePayload(submissionKey, 4, surveyDraft, true),
        { silent: true },
      );
      return;
    }

    const nextStep = (currentStep + 1) as SurveyStep;
    setSurveyError(null);
    setStep(nextStep);
    setSurveyStatusMessage(
      nextStep === 4
        ? "제출 버튼을 누르면 답변이 저장됩니다."
        : "다음 버튼을 누르면 답변이 저장됩니다.",
    );
    track("survey_step_completed", {
      step: currentStep,
      next_step: nextStep,
      ...getThoughtCategoryEventProps(surveyDraft),
    });

    void queueSurveySave(
      createSurveySavePayload(submissionKey, nextStep, surveyDraft, false),
      { silent: true },
    );
  }

  function handleSurveyBack() {
    if (
      surveyStage === 2 ||
      surveyStage === 3 ||
      surveyStage === 4
    ) {
      setStep((surveyStage - 1) as SurveyStep);
    }
  }

  function handleSurveyDone() {
    setSurveyStage(null);
    setSurveyStatusMessage(null);
  }

  function handleSurveyClose() {
    setSurveyError(null);
    setSurveyStage(null);
    setSurveyStatusMessage("이전 설문 내용을 이어서 작성할 수 있어요.");
  }

  function handleContactModeChange(nextMode: ContactMode) {
    setContactMode(nextMode);
    setContactValue("");
    setSubmitError(null);
    track("contact_mode_changed", { mode: nextMode });
  }

  function toggleMethod(method: SurveyMethod) {
    updateSurveyDraft((draft) => {
      const hasMethod = draft.currentMethods.includes(method);
      const nextMethods = hasMethod
        ? draft.currentMethods.filter((item) => item !== method)
        : [...draft.currentMethods, method];

      return {
        ...draft,
        currentMethods: nextMethods,
        currentMethodsOther:
          nextMethods.includes("other") ? draft.currentMethodsOther : "",
      };
    });
  }

  function toggleBiggestGap(option: BiggestGapOption) {
    updateSurveyDraft((draft) => {
      const hasOption = draft.biggestGapSelections.includes(option);
      let biggestGapSelections: BiggestGapOption[];

      if (option === "no_major_issue") {
        biggestGapSelections = hasOption ? [] : ["no_major_issue"];
      } else {
        const withoutNoMajorIssue = draft.biggestGapSelections.filter(
          (item) => item !== "no_major_issue",
        );

        biggestGapSelections = hasOption
          ? withoutNoMajorIssue.filter((item) => item !== option)
          : [...withoutNoMajorIssue, option];
      }

      return {
        ...draft,
        biggestGapSelections,
        biggestGapOther: biggestGapSelections.includes("other")
          ? draft.biggestGapOther
          : "",
      };
    });
  }

  const isPhoneMode = contactMode === "phone";
  const shouldShowSurveyModal = surveyStage !== null;

  return (
    <div className={styles.page}>
      <header
        className={`${styles.header} ${isScrolled ? styles.headerScrolled : ""}`}
      >
        <div className={styles.headerInner}>
          <a className={styles.brand} href="#top" aria-label="Untangle home">
            <span className={styles.brandText}>Untangle</span>
          </a>
          <nav className={styles.headerNav} aria-label="페이지 섹션">
            <a
              href="#intro"
              onClick={() => track("nav_clicked", { destination: "intro" })}
            >
              기능 소개
            </a>
            <a
              href="#features"
              onClick={() => track("nav_clicked", { destination: "features" })}
            >
              주요 기능
            </a>
            <a
              href="#pre-register"
              onClick={() => track("nav_clicked", { destination: "stats" })}
            >
              ADHD 데이터
            </a>
          </nav>
          <a
            className={styles.topbarCta}
            href="#pre-register"
            onClick={() => track("cta_clicked", { location: "topbar" })}
          >
            사전 등록하기
          </a>
        </div>
      </header>

      <main id="top">
        <section className={styles.heroShell} data-section="hero">
          <div className={styles.hero}>
            <div className={styles.heroContent}>
              <p className={styles.heroEyebrow}>ADHD를 위한 Untangle</p>
              <h1 className={styles.heroTitle}>
                해야할 일은 아는데,
                <br />
                시작이 안되는 날을 위한
                <br />
                AI 파트너
              </h1>
              <p className={styles.heroBody}>
                하루를 정리하고, 내 뇌를 더 잘 이해하고, 삶을 바꾸도록 설계된
                AI 코치와 함께 잠재력을 끌어올려 보세요.
              </p>
              <div className={styles.heroActions}>
                <a
                  className={styles.ctaPrimary}
                  href="#pre-register"
                  onClick={() => track("cta_clicked", { location: "hero" })}
                >
                  사전 등록하기
                </a>
              </div>
            </div>
            <div className={styles.heroVisual}>
              <Image
                src="/source-assets/hero-phone-cutout-v2.png"
                alt="Untangle mobile app preview"
                width={1029}
                height={1528}
                priority
              />
            </div>
          </div>
        </section>

        <section
          id="intro"
          className={styles.introSection}
          data-section="intro"
        >
          <div className={styles.containerNarrow}>
            <h2 className={styles.introTitle}>
              ADHD를 위한 정리 파트너
            </h2>
            <p className={styles.introSubtitle}>
              당신의 삶에 맞춰 반응하는 AI 지원으로 집중력을 높이고, 다시 앞으로
              나아가게 합니다.
            </p>
            <div className={styles.valueGrid}>
              {valueProps.map((item) => (
                <article key={item.title} className={styles.valueCard}>
                  <div className={styles.valueIcon}>
                    <ValueIcon type={item.icon} />
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="features"
          className={styles.featuresSection}
          data-section="features"
        >
          <div className={styles.container}>
            {features.map((feature) => {
              const title = feature.title.replace(
                feature.titleAccent,
                `__ACCENT__${feature.titleAccent}__ACCENT__`,
              );

              return (
                <article
                  key={feature.title}
                  className={`${styles.feature} ${
                    feature.reverse ? styles.featureReverse : ""
                  }`}
                >
                  <div className={styles.featureText}>
                    <p className={styles.eyebrow}>{feature.eyebrow}</p>
                    <h2>
                      {title.split("__ACCENT__").map((part, index) =>
                        index % 2 === 1 ? (
                          <span key={part} className={styles.featureAccent}>
                            {part}
                          </span>
                        ) : (
                          <span key={part}>{part}</span>
                        ),
                      )}
                    </h2>
                    <p className={styles.featureDescription}>
                      {feature.description}
                    </p>
                    <ul className={styles.featureList}>
                      {feature.bullets.map((bullet) => (
                        <li key={bullet}>
                          <span className={styles.check}>✓</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={styles.featureVisualFrame}>
                    <div
                      className={`${styles.featureVisual} ${
                        feature.visualTone === "dark"
                          ? styles.featureVisualDark
                          : ""
                      }`}
                    >
                      <Image
                        src={feature.image.src}
                        alt={feature.image.alt}
                        width={feature.image.width}
                        height={feature.image.height}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section
          id="pre-register"
          className={styles.statsSection}
          data-section="stats"
        >
          <div className={styles.container}>
            <h2 className={styles.statsTitle}>
              ADHD, 우리가 이 문제에 집중하는 이유
            </h2>
            <div className={styles.statsGrid}>
              {stats.map((stat) => (
                <article key={stat.value} className={styles.statCard}>
                  <div className={styles.statValue}>{stat.value}</div>
                  <p>{stat.text}</p>
                  <a
                    href={stat.sourceHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() =>
                      track("stat_source_clicked", {
                        source: stat.sourceLabel,
                      })
                    }
                  >
                    ({stat.sourceLabel})
                  </a>
                </article>
              ))}
            </div>
            <form className={styles.preRegisterCard} onSubmit={handleRegistrationSubmit}>
              {registrationSubmitted ? (
                <div className={styles.preRegisterSuccess}>
                  <p className={styles.preRegisterTitle}>
                    {isSurveyComplete
                      ? "사전 등록과 설문이 모두 저장되었습니다."
                      : "사전 등록이 완료되었습니다."}
                  </p>
                  <p className={styles.preRegisterBody}>
                    {isSurveyComplete
                      ? "남겨주신 답변을 바탕으로 Untangle을 더 세심하게 준비할게요."
                      : "이어서 열리는 설문에서 다음 또는 제출 버튼을 누르면 답변이 저장됩니다."}
                  </p>
                  <p className={styles.preRegisterConsent}>
                    등록 시 이용 약관 및{" "}
                    <Link href="/privacy" className={styles.inlineTextLink}>
                      개인정보 처리방침
                    </Link>
                    에 동의하게 됩니다.
                  </p>
                </div>
              ) : (
                <>
                  <p className={styles.preRegisterTitle}>사전 등록하기</p>
                  <p className={styles.preRegisterBody}>
                    연락받기 편한 방식 하나만 선택해 남겨주시면 출시 소식을 가장
                    먼저 알려드릴게요.
                  </p>
                  <div
                    className={styles.contactToggle}
                    role="group"
                    aria-label="연락 수단 선택"
                  >
                    <button
                      type="button"
                      className={`${styles.contactToggleButton} ${
                        isPhoneMode ? styles.contactToggleButtonActive : ""
                      }`}
                      aria-pressed={isPhoneMode}
                      onClick={() => handleContactModeChange("phone")}
                    >
                      전화번호
                    </button>
                    <button
                      type="button"
                      className={`${styles.contactToggleButton} ${
                        !isPhoneMode ? styles.contactToggleButtonActive : ""
                      }`}
                      aria-pressed={!isPhoneMode}
                      onClick={() => handleContactModeChange("email")}
                    >
                      이메일
                    </button>
                  </div>
                  <div className={styles.preRegisterFields}>
                    <label className={styles.preRegisterField}>
                      <span>{isPhoneMode ? "전화번호" : "이메일 주소"}</span>
                      {isPhoneMode ? (
                        <input
                          type="tel"
                          name="phone"
                          inputMode="numeric"
                          data-clarity-mask="true"
                          placeholder="01012345678 또는 010-1234-5678"
                          required
                          value={contactValue}
                          onChange={(event) => {
                            setContactValue(event.target.value);
                            setSubmitError(null);
                          }}
                          onBlur={() => {
                            const normalized = normalizePhoneNumber(contactValue);
                            if (normalized) {
                              setContactValue(normalized);
                            }
                          }}
                        />
                      ) : (
                        <input
                          type="email"
                          name="email"
                          placeholder="name@example.com"
                          required
                          value={contactValue}
                          onChange={(event) => {
                            setContactValue(event.target.value);
                            setSubmitError(null);
                          }}
                        />
                      )}
                    </label>
                  </div>
                  {submitError ? (
                    <p className={styles.preRegisterError}>{submitError}</p>
                  ) : null}
                  <button
                    type="submit"
                    className={styles.preRegisterButton}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "등록 중..." : "사전 등록하기"}
                  </button>
                  <p className={styles.preRegisterConsent}>
                    등록 시 이용 약관 및{" "}
                    <Link href="/privacy" className={styles.inlineTextLink}>
                      개인정보 처리방침
                    </Link>
                    에 동의하게 됩니다.
                  </p>
                </>
              )}
            </form>
          </div>
        </section>

        <section className={`${styles.faqSection} ${styles.hiddenSection}`}>
          <div className={styles.containerFaq}>
            <h2 className={styles.faqTitle}>자주 묻는 질문</h2>
            <div className={styles.faqList}>
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <article
                    key={faq.question}
                    className={`${styles.faqItem} ${
                      isOpen ? styles.faqItemOpen : ""
                    }`}
                  >
                    <button
                      type="button"
                      className={styles.faqButton}
                      onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    >
                      <span>{faq.question}</span>
                      <span className={styles.faqIcon}>{isOpen ? "−" : "+"}</span>
                    </button>
                    {isOpen ? (
                      <div className={styles.faqAnswer}>
                        {faq.answer.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <footer className={styles.siteFooter}>
          <div className={styles.siteFooterInner}>
            <p className={styles.siteFooterBrand}>Untangle</p>
            <div className={styles.siteFooterLinks}>
              <Link href="/privacy" className={styles.siteFooterLink}>
                개인정보 처리방침
              </Link>
              <a
                href="https://open.kakao.com/o/sgF3hZyi"
                target="_blank"
                rel="noreferrer"
                className={styles.siteFooterLink}
              >
                문의하기
              </a>
            </div>
          </div>
        </footer>
      </main>

      {shouldShowSurveyModal ? (
        <div className={styles.modalOverlay}>
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="survey-modal-title"
          >
            {surveyStage === "done" ? (
              <div className={styles.modalContent}>
                <p className={styles.modalStep}>마무리</p>
                <h3 id="survey-modal-title" className={styles.modalTitle}>
                  감사합니다.
                </h3>
                <p className={styles.modalBody}>
                  남겨주신 답변은 ADHD분들이 실제로 겪는 어려움을 이해하고,
                  Untangle이 더 잘 챙겨줄 수 있는 방향으로 만드는 데
                  사용됩니다.
                </p>
                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.modalPrimaryButton}
                    onClick={handleSurveyDone}
                  >
                    확인
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                  <p className={styles.modalStep}>{surveyStage}/4</p>
                  <button
                    type="button"
                    className={styles.modalCloseButton}
                    onClick={handleSurveyClose}
                    disabled={isRegistrationSaving}
                  >
                    닫기
                  </button>
                </div>
                {surveyStage === 1 ? (
                  <>
                    <h3 id="survey-modal-title" className={styles.modalTitle}>
                      가장 생각을 정리하기 어려운 카테고리는 무엇인가요?
                    </h3>
                    <p className={styles.modalBody}>
                      가장 가까운 답변 하나를 골라주세요.
                    </p>
                    <div className={styles.modalCheckboxGroup}>
                      {thoughtCategoryOptions.map((option) => {
                        const checked = surveyDraft.thoughtCategory === option.id;

                        return (
                          <label
                            key={option.id}
                            className={`${styles.modalCheckbox} ${
                              checked ? styles.modalCheckboxChecked : ""
                            }`}
                          >
                            <input
                              type="radio"
                              name="thought-category"
                              checked={checked}
                              onChange={() =>
                                updateSurveyDraft((draft) => ({
                                  ...draft,
                                  thoughtCategory: option.id,
                                  thoughtCategoryOther:
                                    option.id === "other"
                                      ? draft.thoughtCategoryOther
                                      : "",
                                }))
                              }
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {surveyDraft.thoughtCategory === "other" ? (
                      <label className={styles.modalField}>
                        <span className={styles.modalLabel}>기타 내용</span>
                        <input
                          className={styles.modalInput}
                          type="text"
                          value={surveyDraft.thoughtCategoryOther}
                          onChange={(event) =>
                            updateSurveyDraft((draft) => ({
                              ...draft,
                              thoughtCategoryOther: event.target.value,
                            }))
                          }
                          placeholder="직접 적어주세요"
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}

                {surveyStage === 2 ? (
                  <>
                    <h3 id="survey-modal-title" className={styles.modalTitle}>
                      최근 2주 동안 가장 힘들었던 순간이 있었나요?
                    </h3>
                    <p className={styles.modalBody}>
                      가장 가까운 답변 하나를 골라주세요.
                    </p>
                    <div className={styles.modalCheckboxGroup}>
                      {painMomentOptions.map((option) => {
                        const checked = surveyDraft.painMoment === option.id;

                        return (
                          <label
                            key={option.id}
                            className={`${styles.modalCheckbox} ${
                              checked ? styles.modalCheckboxChecked : ""
                            }`}
                          >
                            <input
                              type="radio"
                              name="pain-moment"
                              checked={checked}
                              onChange={() =>
                                updateSurveyDraft((draft) => ({
                                  ...draft,
                                  painMoment: option.id,
                                }))
                              }
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                {surveyStage === 3 ? (
                  <>
                    <h3 id="survey-modal-title" className={styles.modalTitle}>
                      지금은 어떻게 버티고 있나요?
                    </h3>
                    <p className={styles.modalBody}>
                      해당되는 걸 모두 골라주세요.
                    </p>
                    <div className={styles.modalCheckboxGroup}>
                      {surveyOptions.map((option) => {
                        const checked = surveyDraft.currentMethods.includes(
                          option.id,
                        );

                        return (
                          <label
                            key={option.id}
                            className={`${styles.modalCheckbox} ${
                              checked ? styles.modalCheckboxChecked : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMethod(option.id)}
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {surveyDraft.currentMethods.includes("other") ? (
                      <label className={styles.modalField}>
                        <span className={styles.modalLabel}>기타 내용</span>
                        <input
                          className={styles.modalInput}
                          type="text"
                          value={surveyDraft.currentMethodsOther}
                          onChange={(event) =>
                            updateSurveyDraft((draft) => ({
                              ...draft,
                              currentMethodsOther: event.target.value,
                            }))
                          }
                          placeholder="직접 적어주세요"
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}

                {surveyStage === 4 ? (
                  <>
                    <h3 id="survey-modal-title" className={styles.modalTitle}>
                      지금 방법에서 가장 아쉬운 점은 뭔가요?
                    </h3>
                    <p className={styles.modalBody}>
                      해당되는 걸 모두 골라주세요.
                    </p>
                    <div className={styles.modalCheckboxGroup}>
                      {biggestGapOptions.map((option) => {
                        const checked = surveyDraft.biggestGapSelections.includes(
                          option.id,
                        );

                        return (
                          <label
                            key={option.id}
                            className={`${styles.modalCheckbox} ${
                              checked ? styles.modalCheckboxChecked : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleBiggestGap(option.id)}
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {surveyDraft.biggestGapSelections.includes("other") ? (
                      <label className={styles.modalField}>
                        <span className={styles.modalLabel}>기타 내용</span>
                        <input
                          className={styles.modalInput}
                          type="text"
                          value={surveyDraft.biggestGapOther}
                          onChange={(event) =>
                            updateSurveyDraft((draft) => ({
                              ...draft,
                              biggestGapOther: event.target.value,
                            }))
                          }
                          placeholder="직접 적어주세요"
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}

                {surveyError ? (
                  <p className={styles.modalError}>{surveyError}</p>
                ) : null}
                <p className={styles.modalStatus}>
                  {isRegistrationSaving
                    ? "사전 등록을 저장하고 있어요..."
                    : isSurveySaving
                    ? "답변을 저장하고 있어요..."
                    : surveyStatusMessage}
                </p>
                <div className={styles.modalFooter}>
                  {surveyStage === 2 ||
                  surveyStage === 3 ||
                  surveyStage === 4 ? (
                    <button
                      type="button"
                      className={styles.modalSecondaryButton}
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
                    className={styles.modalPrimaryButton}
                    onClick={() => void handleSurveyNext()}
                    disabled={isRegistrationSaving}
                  >
                    {surveyStage === 4 ? "제출하기" : "다음"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
