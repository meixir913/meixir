export interface AlertPrefs {
  states: string[];
  roleTypes: string[];
  employment: string[];
  /** Optional words to look for in the title, centre or suburb, e.g. "Parramatta" or "kindy". */
  keywords: string;
}

export interface PushKeys {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface Subscriber {
  id: string;
  /** Secret used in manage, confirm and unsubscribe links. */
  token: string;
  email: string | null;
  emailStatus: "none" | "pending" | "active" | "unsubscribed";
  push: PushKeys | null;
  prefs: AlertPrefs;
  locale: string;
  createdAt: string;
  lastEmailAt: string | null;
  lastPushAt: string | null;
}

export const EMPTY_PREFS: AlertPrefs = { states: [], roleTypes: [], employment: [], keywords: "" };
