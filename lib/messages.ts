import hi from "./messages/hi";
import ne from "./messages/ne";
import vi from "./messages/vi";
import zh from "./messages/zh";

// Interface translations by locale. English needs no file: the English text is the key.
export const MESSAGES: Record<string, Record<string, string>> = { zh, vi, ne, hi };
