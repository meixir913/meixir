/** Each person's saved work, stored under their account. */
export const USER_DATA_KEYS = ["profile", "resumes", "jobs", "letters", "interviews"] as const;
export type UserDataKey = (typeof USER_DATA_KEYS)[number];
