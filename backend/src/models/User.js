import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  role: { type: String, enum: ['owner', 'member'], default: 'member' },
  avatarUrl: { type: String, default: '', maxlength: 1000 },
  resetTokenHash: { type: String, select: false },
  resetTokenExpiresAt: { type: Date, select: false },
  emailVerified: { type: Boolean },
  verificationCodeHash: { type: String, select: false },
  verificationCodeExpiresAt: { type: Date, select: false },
  resetCodeHash: { type: String, select: false },
  resetCodeExpiresAt: { type: Date, select: false },
  loginCodeHash: { type: String, select: false },
  loginCodeExpiresAt: { type: Date, select: false },
  loginChallengeHash: { type: String, select: false },
}, { timestamps: true, versionKey: false });

export default mongoose.model('User', userSchema);
