import type { Metadata } from "next";
import ChatWidget from "@/components/ChatWidget";
import SiteChrome from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Customer Chat | SurfSync",
  description: "Chat with SurfSync Infotech.",
  robots: { index: false, follow: false }
};

export default function CustomerChatPage() {
  return <SiteChrome><main className="page-shell live-chat-shell customer-chat-only"><ChatWidget loginEnabled={false} /></main></SiteChrome>;
}
