import mongoose, { Schema } from "mongoose";
import { IUser } from "../interface/user.interface";

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      default: "",
      trim: true,
    },
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
      index: true,
    },
    apiKey: {
      type: String,
      default: "",
    },
    credits: {
      type: Number,
      default: 0,
    },
    hasClaimedCredits: {
      type: Boolean,
      default: true,
    },
    hasSetupApiKey: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const UserModel = mongoose.model<IUser>("User", UserSchema);
