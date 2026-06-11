import { Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  displayName: string;
  role: "user" | "admin" | "superadmin";
  apiKey?: string;
  credits: number;
  hasClaimedCredits: boolean;
  hasSetupApiKey: boolean;
  createdAt: Date;
  updatedAt: Date;
}
