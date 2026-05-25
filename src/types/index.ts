import { Timestamp } from "firebase/firestore";

export type TransactionType = "income" | "expense";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PersonalTransaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  description: string;
  paymentMethod?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  memberIds: string[];
  memberProfiles?: Record<string, { displayName: string; email: string }>;
  manualMembers?: { id: string; name: string }[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GroupMember {
  userId: string;
  role: "admin" | "member";
  joinedAt: Timestamp;
}

export interface GroupTransaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  description: string;
  paymentMethod?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GroupDue {
  id: string;
  amount: number;
  title: string;
  dueDate: string; // YYYY-MM-DD
  createdAt: Timestamp;
  createdBy: string;
  paidMemberIds: string[];
}

export interface GroupDuePayment {
  userId: string;
  isPaid: boolean;
  amountPaid?: number;
  paidAt?: Timestamp;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  createdAt: Timestamp;
}
