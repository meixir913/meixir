"use client";

import { createContext, useContext } from "react";

export interface Account {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export const AccountContext = createContext<{ user: Account | null; logout: () => Promise<void> }>({
  user: null,
  logout: async () => {},
});

/** The signed-in account and a log-out action. */
export const useAccount = () => useContext(AccountContext);
