import type { InterviewFeedback, InterviewTurn } from "./types";
import type { InterviewSetup, JobAnalysis, JobContext } from "./prompts";
import type { Profile } from "./types";

// Scripted content used when no Anthropic API key is configured, so the whole
// dashboard can be explored before connecting Claude.

export function demoCoverLetter(profile: Profile, job: JobContext) {
  const name = profile.name || "Your Name";
  const centre = job.centre || "your centre";
  const approach = job.philosophies[0] ?? "play-based";
  return `Dear Hiring Team,

I am delighted to apply for the ${job.title || "Early Childhood Educator"} position at ${centre}. Your ${approach} approach, and the way you describe children as curious, capable learners, reflects exactly how I try to show up in a classroom every day.

${
  profile.yearsExperience
    ? `Over my ${profile.yearsExperience} years as an educator, I have learned`
    : "Through my training and placements, I have learned"
} that the most meaningful learning grows out of relationships. I love slowing down to notice what children are wondering about, then shaping the environment and our provocations around those interests, and documenting their thinking so that families can see and celebrate it too.

I would bring warmth, reliability, and a genuine partnership mindset to your team. I value open communication with families and co-workers, I take health, safety and supervision seriously, and I am always reflecting on my practice so that every child feels a sense of belonging.

Thank you for considering my application. I would welcome the chance to visit ${centre} and talk about how I could contribute to your programs.

Warm regards,
${name}

(Demo mode — add an ANTHROPIC_API_KEY to generate a letter tailored to your real profile and this posting.)`;
}

export function demoAnalysis(text: string): JobAnalysis {
  const firstLine = text.split("\n").find((l) => l.trim()) ?? "";
  return {
    title: /educator|ece|ect|teacher/i.test(firstLine) ? firstLine.trim().slice(0, 80) : "Early Childhood Educator",
    centre: "",
    location: "",
    salary: (text.match(/\$\s?\d[\d.,]*(\s?[-–]\s?\$?\s?\d[\d.,]*)?(\s?(\/|per)\s?(hour|hr|year))?/i) ?? [""])[0],
    philosophies: [
      /reggio/i.test(text) && "Reggio Emilia",
      /montessori/i.test(text) && "Montessori",
      /emergent/i.test(text) && "Emergent curriculum",
      /play/i.test(text) && "Play-based",
      /bush|forest|nature|outdoor/i.test(text) && "Bush kinder / nature-based",
      /inclusi|anti-bias|diversity/i.test(text) && "Inclusive / anti-bias",
    ].filter(Boolean) as string[],
    programs: [],
    requirements: [],
    keywords: [],
    centreSummary: "",
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
