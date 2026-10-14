import { z } from "zod";

const serviceNames = [
  "AI & Automation",
  "Web Development",
  "Mobile Development",
  "E-commerce & CMS",
  "WhatsApp Business API",
  "Digital Marketing",
  "Logo & Brand Design",
  "Shopify Development",
  "n8n Workflow Automation",
  "Cloud & DevOps",
  "Enterprise IT Solutions",
  "UI/UX Design",
  "Analytics setup",
  "Training & Documentation",
  "Swagat Suite",
  "HRMS",
  "Sales CRM",
  "PatronPing",
  "Not sure yet"
] as const;

const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000)
});

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1, "Please enter a message.").max(2000),
  history: z.array(historyMessageSchema).max(10).default([]),
  conversationId: z.uuid().optional()
});

const optionalPhoneSchema = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().trim().max(40).regex(/^[+\d][\d\s().-]{5,38}$/, "Enter a valid phone number.").optional()
);

export const leadRequestSchema = z.object({
  submissionId: z.uuid(),
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: z.email("Enter a valid email address.").max(254).transform((value) => value.toLowerCase()),
  phone: optionalPhoneSchema,
  service: z.enum(serviceNames),
  description: z.string().trim().min(10, "Describe your project in at least 10 characters.").max(2000),
  budget: z.string().trim().max(100).optional().default(""),
  timeline: z.string().trim().max(100).optional().default(""),
  consent: z.literal(true, { error: "Please agree before submitting your enquiry." })
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessage = z.infer<typeof historyMessageSchema>;
export type LeadInput = z.infer<typeof leadRequestSchema>;
