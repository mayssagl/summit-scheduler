export type Status = "Pending" | "Scheduled" | "Active" | "Completed" | "Cancelled";

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  start: string;
  end: string;
  tz: string;
  venue: string;
  module?: string;
  status: "Done" | "Today" | "Ahead";
}

export interface Student {
  id: string;
  name: string;
  email: string;
  dept: string;
  status: "Active" | "Invited" | "Dropped";
  attendance: number;
  completion: number;
  certIssued: boolean;
}

export interface Training {
  id: string;
  name: string;
  client: string;
  country: string;
  venue: string;
  language: "EN" | "FR";
  numStudents: number;
  startDate: string | null;
  endDate: string | null;
  completionThreshold: number;
  poRef: string;
  poValue: number;
  status: Status;
  instructor: string;
  instructorId: string;
  dmId: string;
  modules: string[];
  nps: number;
  surveyRate: number;
  learningGain: number;
  attendanceRate: number;
  sessions: Session[];
  students: Student[];
}

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function mkSessions(startOffset: number, count: number, venue: string, mod: string): Session[] {
  return Array.from({ length: count }, (_, i) => {
    const d = addDays(today, startOffset + i * 2);
    const diff = startOffset + i * 2;
    return {
      id: `s${i}-${startOffset}`,
      date: iso(d),
      start: "09:00",
      end: "17:00",
      tz: "Europe/Paris",
      venue,
      module: `${mod} ${i + 1}`,
      status: diff < 0 ? "Done" : diff === 0 ? "Today" : "Ahead",
    };
  });
}

function mkStudents(n: number): Student[] {
  const names = ["Emma Chen","Liam Patel","Sofia Garcia","Noah Kim","Olivia Brown","Ethan Wright","Ava Singh","Mason Lopez","Mia Dubois","Lucas Müller","Amelia Rossi","Henry Tanaka","Isabella Silva","James O'Connor","Charlotte Weber","Benjamin Park","Harper Costa","Elijah Nakamura","Evelyn Petit","Daniel Schmidt"];
  return Array.from({ length: n }, (_, i) => ({
    id: `st${i}`,
    name: names[i % names.length],
    email: `${names[i % names.length].toLowerCase().replace(/[^a-z]/g, ".")}@acme.com`,
    dept: ["Sales", "Engineering", "Product", "Marketing"][i % 4],
    status: i % 7 === 0 ? "Invited" : "Active",
    attendance: 70 + Math.floor(Math.random() * 30),
    completion: 60 + Math.floor(Math.random() * 40),
    certIssued: Math.random() > 0.4,
  }));
}

export const TRAININGS: Training[] = [
  {
    id: "t1", name: "Negotiation Skills", client: "Acme Corp", country: "France", venue: "Paris HQ",
    language: "EN", numStudents: 18, startDate: iso(addDays(today, -4)), endDate: iso(addDays(today, 6)),
    completionThreshold: 70, poRef: "PO-2024-881", poValue: 24000, status: "Active",
    instructor: "Jordan Lee", instructorId: "i1", dmId: "dm1",
    modules: ["Foundations", "Tactics", "Closing"],
    nps: 62, surveyRate: 88, learningGain: 34, attendanceRate: 92,
    sessions: mkSessions(-4, 5, "Paris HQ", "Module"),
    students: mkStudents(18),
  },
  {
    id: "t2", name: "Leadership Essentials", client: "Globex", country: "Germany", venue: "Berlin Office",
    language: "EN", numStudents: 12, startDate: iso(addDays(today, 14)), endDate: iso(addDays(today, 21)),
    completionThreshold: 75, poRef: "PO-2024-902", poValue: 18500, status: "Scheduled",
    instructor: "Jordan Lee", instructorId: "i1", dmId: "dm1",
    modules: ["Vision", "Coaching", "Feedback"],
    nps: 0, surveyRate: 0, learningGain: 0, attendanceRate: 0,
    sessions: mkSessions(14, 4, "Berlin Office", "Module"),
    students: mkStudents(12),
  },
  {
    id: "t3", name: "Data Storytelling", client: "Initech", country: "UK", venue: "London Hub",
    language: "EN", numStudents: 20, startDate: null, endDate: null,
    completionThreshold: 70, poRef: "PO-2024-915", poValue: 22000, status: "Pending",
    instructor: "Sara Wells", instructorId: "i2", dmId: "dm1",
    modules: ["Chart choice", "Narrative"],
    nps: 0, surveyRate: 0, learningGain: 0, attendanceRate: 0,
    sessions: [],
    students: mkStudents(20),
  },
  {
    id: "t4", name: "Negotiation Skills (FR)", client: "Lumière", country: "France", venue: "Lyon Centre",
    language: "FR", numStudents: 14, startDate: iso(addDays(today, -40)), endDate: iso(addDays(today, -25)),
    completionThreshold: 70, poRef: "PO-2024-744", poValue: 19500, status: "Completed",
    instructor: "Jordan Lee", instructorId: "i1", dmId: "dm2",
    modules: ["Bases", "Tactiques"],
    nps: 58, surveyRate: 91, learningGain: 31, attendanceRate: 89,
    sessions: mkSessions(-40, 4, "Lyon Centre", "Module"),
    students: mkStudents(14),
  },
  {
    id: "t5", name: "Agile for Managers", client: "Hooli", country: "USA", venue: "Remote",
    language: "EN", numStudents: 22, startDate: iso(addDays(today, -10)), endDate: iso(addDays(today, -2)),
    completionThreshold: 70, poRef: "PO-2024-820", poValue: 26000, status: "Cancelled",
    instructor: "Sara Wells", instructorId: "i2", dmId: "dm2",
    modules: ["Scrum", "Kanban"],
    nps: 0, surveyRate: 0, learningGain: 0, attendanceRate: 0,
    sessions: [],
    students: mkStudents(8),
  },
];

export function getTraining(id: string) {
  return TRAININGS.find((t) => t.id === id);
}

export const INSTRUCTORS = [
  { id: "i1", name: "Jordan Lee", email: "jordan@trainops.co", status: "Active", trainingCount: 3, nps: 60, learningGain: 33, satisfaction: 4.4 },
  { id: "i2", name: "Sara Wells", email: "sara@trainops.co", status: "Active", trainingCount: 2, nps: 48, learningGain: 28, satisfaction: 4.1 },
  { id: "i3", name: "Marc Dupont", email: "marc@trainops.co", status: "Invited", trainingCount: 0, nps: 0, learningGain: 0, satisfaction: 0 },
];

export const DELIVERY_MANAGERS = [
  { id: "dm1", name: "Priya Shah", email: "priya@trainops.co", status: "Active", trainingCount: 3, nps: 61 },
  { id: "dm2", name: "Tom Ricci", email: "tom@trainops.co", status: "Active", trainingCount: 2, nps: 55 },
];

export const SURVEY_QUESTIONS = {
  l1: [
    { id: "q1", en: "Overall, how satisfied were you with this training?", fr: "Globalement, êtes-vous satisfait de cette formation ?", type: "1-5" },
    { id: "q2", en: "How likely are you to recommend this training?", fr: "Recommanderiez-vous cette formation ?", type: "0-10 NPS" },
    { id: "q3", en: "Any comments to share?", fr: "Avez-vous des commentaires ?", type: "Open" },
  ],
  l3: [
    { id: "q1", en: "How often do you apply what you learned?", fr: "À quelle fréquence appliquez-vous ce que vous avez appris ?", type: "Frequency" },
    { id: "q2", en: "Impact on your daily work?", fr: "Impact sur votre travail quotidien ?", type: "1-5" },
    { id: "q3", en: "What blockers remain?", fr: "Quels obstacles subsistent ?", type: "Open" },
  ],
};

export const STATUS_COLORS: Record<Status, string> = {
  Pending: "bg-[color-mix(in_oklab,var(--status-pending)_30%,white)] text-[color:var(--status-pending-fg)] ring-[color-mix(in_oklab,var(--status-pending)_50%,transparent)]",
  Scheduled: "bg-[color-mix(in_oklab,var(--status-scheduled)_22%,white)] text-[color:var(--status-scheduled-fg)] ring-[color-mix(in_oklab,var(--status-scheduled)_50%,transparent)]",
  Active: "bg-[color-mix(in_oklab,var(--status-active)_25%,white)] text-[color:var(--status-active-fg)] ring-[color-mix(in_oklab,var(--status-active)_50%,transparent)]",
  Completed: "bg-[color-mix(in_oklab,var(--status-completed)_45%,white)] text-[color:var(--status-completed-fg)] ring-[color-mix(in_oklab,var(--status-completed)_60%,transparent)]",
  Cancelled: "bg-[color-mix(in_oklab,var(--status-cancelled)_22%,white)] text-[color:var(--status-cancelled-fg)] ring-[color-mix(in_oklab,var(--status-cancelled)_50%,transparent)]",
};