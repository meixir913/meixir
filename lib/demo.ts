import { roleLevel } from "./feed/classify";
import { employmentKind } from "./jobtypes";
import type { Alignment, AlignmentItem, CentreDetails, RoleDetails } from "./letter-types";
import type { InterviewSetup, JobAnalysis } from "./prompts";
import type { InterviewFeedback, InterviewTurn, Profile } from "./types";

// Scripted content used when no Anthropic API key is configured, so the whole
// dashboard can be explored before connecting Claude.

const note = "(Demo mode — add an ANTHROPIC_API_KEY for a letter written from your real resume and this centre.)";

export function demoLetter(profile: Profile, centre: CentreDetails, role: RoleDetails, alignment: AlignmentItem[]) {
  const name = profile.name || "Your Name";
  const centreName = centre.name || "your centre";
  const strong = alignment.filter((a) => a.strength !== "gap" && a.evidence);
  const seen = new Set<string>();
  // Turn a resume line into a sentence: "Planned an emergent program…" -> "I planned an emergent program…"
  const clause = (evidence: string) => {
    const e = evidence.replace(/^[-•*\s]+/, "").replace(/\.$/, "").trim();
    if (/^I\b/.test(e)) return `${e}.`;
    return /^([A-Z][a-z]+ed|Built|Led|Ran|Taught|Made|Wrote|Kept|Began|Grew|Won|Set|Took|Brought)\b/.test(e) ? `I ${e.charAt(0).toLowerCase()}${e.slice(1)}.` : `My experience includes ${e}.`;
  };
  const lead = (a: AlignmentItem) =>
    a.category === "philosophy"
      ? `Your ${a.centreElement} approach is close to my own practice.`
      : a.category === "curriculum"
        ? "The way you plan and document learning matches how I work."
        : a.category === "program"
          ? `Your ${a.centreElement.toLowerCase()} program is something I would love to contribute to.`
          : "I would bring hands-on experience to the role.";

  const approach = centre.approaches[0];
  return `Dear Hiring Team,

I would love to join ${centreName} as ${role.title || role.roleType || "an educator"}. ${
    approach && !strong.some((a) => a.centreElement === approach) ? `Your ${approach} approach` : "Your centre"
  } is exactly the environment I work best in${centre.suburb ? `, and being part of the ${centre.suburb} community would mean a great deal to me` : ""}.

${
  strong.length
    ? strong
        .filter((a) => !seen.has(a.evidence) && seen.add(a.evidence))
        .slice(0, 3)
        .map((a) => `${lead(a)} ${clause(a.evidence)}`)
        .join(" ")
    : "Across my placements and roles I have focused on building secure relationships, planning from children's interests, and documenting learning so families can share in it."
}

${
  profile.credential ? `I hold a ${profile.credential}` : "I bring my early childhood training"
}${profile.yearsExperience ? ` and ${profile.yearsExperience} years of experience` : ""}, and I am confident working with the EYLF and the National Quality Standard as part of a reflective team.

I am available for ${role.employmentType ? role.employmentType.toLowerCase() : "the"} work and would welcome the chance to visit ${centreName} and meet your team.

Warm regards,
${name}

${note}`;
}

export function demoAlignment(profile: Profile, centre: CentreDetails, role: RoleDetails): Alignment {
  const resume = `${profile.resume} ${profile.strengths}`;
  const used = new Set<string>();
  const find = (re: RegExp) => {
    const line = resume.split(/(?<=[.!?\n])\s*/).map((l) => l.replace(/^[-•*\s]+/, "").trim()).find((l) => re.test(l) && !used.has(l)) ?? "";
    if (line) used.add(line);
    return line;
  };
  const items: AlignmentItem[] = [
    { category: "philosophy", centreElement: centre.approaches[0] ?? "Child-led, play-based learning", evidence: find(/play|interest|child-led|reggio|emergent/i), strength: "strong", framing: "Lead with this: it mirrors the centre's own words." },
    { category: "curriculum", centreElement: "Planning and documenting against the EYLF", evidence: find(/eylf|document|observ|program|plan/i), strength: "partial", framing: "Give one concrete example of documentation shared with families." },
    { category: "program", centreElement: centre.programs.split(/[,\n]/)[0]?.trim() || "Outdoor and nature play", evidence: find(/garden|outdoor|nature|bush/i), strength: "partial", framing: "Connect it to the centre's program by name." },
    { category: "role", centreElement: role.roleType || "Working as part of a room team", evidence: find(/mentor|led |lead|team/i), strength: "strong", framing: "Show what you'd bring from day one." },
    { category: "philosophy", centreElement: "Partnership with families", evidence: find(/famil|parent/i), strength: "partial", framing: "Mention how you keep families involved in their child's learning." },
  ].map((i) => ({ ...i, strength: i.evidence ? i.strength : "gap", framing: i.evidence ? i.framing : "No direct evidence in the resume: leave it out or mention willingness to learn." })) as AlignmentItem[];
  return {
    summary: "Demo alignment based on simple keyword matching. Add an ANTHROPIC_API_KEY for a real comparison of the resume with this centre.",
    items,
  };
}

export function demoCentre(text: string): CentreDetails {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const pick = (re: RegExp) => sentences.filter((l) => re.test(l)).slice(0, 3).join(" ");
  return {
    name: "",
    suburb: "",
    state: "",
    website: "",
    curriculum: pick(/eylf|curriculum|learning framework|program(me)? of learning|intentional/i),
    philosophy: pick(/philosoph|believe|value|image of the child|capable/i),
    programs: pick(/kinder|nursery|toddler|bush|excursion|language|school readiness|room/i),
    approaches: [/reggio/i.test(text) && "Reggio Emilia", /montessori/i.test(text) && "Montessori", /bush|nature/i.test(text) && "Bush kinder / nature-based"].filter(Boolean) as string[],
  };
}

export function demoAnalysis(text: string): JobAnalysis {
  const firstLine = text.split("\n").find((l) => l.trim()) ?? "";
  const centre = demoCentre(text);
  return {
    title: /educator|ece|ect|teacher|leader|director/i.test(firstLine) ? firstLine.trim().slice(0, 80) : "Early Childhood Educator",
    centre: "",
    location: (text.match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)? (NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/) ?? [""])[0],
    state: (text.match(/\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/) ?? [""])[0],
    salary: (text.match(/\$\s?\d[\d.,]*(\s?[-–]\s?\$?\s?\d[\d.,]*)?(\s?(\/|per)\s?(hour|hr|year))?/i) ?? [""])[0],
    roleType: roleLevel(/educator|ece|ect|teacher|leader|director/i.test(firstLine) ? firstLine : "Educator"),
    employmentType: employmentKind(text),
    philosophies: [
      /reggio/i.test(text) && "Reggio Emilia",
      /montessori/i.test(text) && "Montessori",
      /emergent/i.test(text) && "Emergent curriculum",
      /play/i.test(text) && "Play-based",
      /bush|forest|nature|outdoor/i.test(text) && "Bush kinder / nature-based",
      /inclusi|anti-bias|diversity/i.test(text) && "Inclusive / anti-bias",
    ].filter(Boolean) as string[],
    curriculum: centre.curriculum,
    philosophy: centre.philosophy,
    programs: centre.programs,
    requirements: [],
    keywords: [],
  };
}

export function demoInterviewerTurn(setup: InterviewSetup, turns: InterviewTurn[]) {
  const questions = [
    "To start, tell me a little about yourself and what drew you to early childhood education.",
    `How would you describe your image of the child, and how does it show up in your day-to-day practice${setup.philosophies[0] ? `, especially in a ${setup.philosophies[0]} setting` : ""}?`,
    "Tell me about a time a child was showing challenging behaviour. What was happening, what did you do, and what was the outcome?",
    "A parent comes to you at pick-up upset that their child came home with a scratch no one mentioned. How would you handle that conversation?",
    "How do you plan and document learning so that it reflects the children's interests?",
    "Describe a disagreement you had with a co-worker and how you worked through it.",
    "How do you make sure every child, including children with extra support needs, feels a sense of belonging in your room?",
    "What does a safe, well-supervised outdoor play period look like to you?",
  ];
  const asked = turns.filter((t) => t.role === "interviewer").length;
  const reactions = ["Thank you, that's helpful.", "I appreciate that example.", "That makes sense.", "Great, thank you for sharing that."];
  const name = setup.candidateName ? `, ${setup.candidateName.split(" ")[0]}` : "";
  if (asked === 0) {
    return `Hi${name}, thanks so much for joining me today. I'm ${setup.interviewerName}, and I lead hiring at ${
      setup.centre || "our centre"
    }. ${questions[0]}`;
  }
  if (asked >= setup.questionCount) {
    return "Thank you for your thoughtful answers today. We'll be in touch within the week about next steps. Have a lovely day! [END]";
  }
  return `${reactions[asked % reactions.length]} ${questions[asked % questions.length]}`;
}

export function demoFeedback(turns: InterviewTurn[]): InterviewFeedback {
  const pairs: { question: string; answer: string }[] = [];
  turns.forEach((t, i) => {
    const next = turns[i + 1];
    if (t.role === "interviewer" && next?.role === "candidate") pairs.push({ question: t.text, answer: next.text });
  });
  return {
    overallScore: 72,
    summary:
      "You come across as warm and child-centred. Your answers would be stronger with more concrete examples and a clear outcome at the end of each story. (Demo feedback — connect an API key for a real review of your answers.)",
    strengths: ["Warm, relationship-focused language", "Shows genuine care for children's wellbeing"],
    improvements: [
      "Use the STAR structure: situation, task, action, result",
      "Name the centre's philosophy and connect it to your practice",
      "Mention safety, supervision and family communication explicitly",
    ],
    perQuestion: pairs.map((p) => ({
      question: p.question,
      score: p.answer.split(/\s+/).length > 40 ? 4 : 3,
      feedback:
        p.answer.split(/\s+/).length > 40
          ? "Good detail. Finish with the result and what you learned."
          : "This answer is brief. Add a specific moment from your experience and what changed because of your actions.",
      strongerAnswer:
        "In my toddler room, [your example] — I noticed..., so I..., and as a result... I shared this with the family through documentation, and it reminded me how important it is to follow the child's lead.",
    })),
  };
}
