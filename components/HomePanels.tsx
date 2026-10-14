"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatWidget from "@/components/ChatWidget";
import TeamInbox from "@/components/TeamInbox";

export default function HomePanels() {
  const router = useRouter();
  const [customerSignedIn, setCustomerSignedIn] = useState<boolean | null>(null);
  const [teamSignedIn, setTeamSignedIn] = useState(false);
  const handleCustomerAuthChange = useCallback((signedIn: boolean, checking: boolean) => {
    setCustomerSignedIn(checking ? null : signedIn);
  }, []);
  const handleTeamAuthChange = useCallback((signedIn: boolean) => setTeamSignedIn(signedIn), []);

  useEffect(() => {
    if (teamSignedIn) router.replace("/team");
    else if (customerSignedIn === true) router.replace("/chat");
  }, [customerSignedIn, teamSignedIn, router]);

  return (
    <main className="page-shell live-chat-shell">
      <TeamInbox embedded loginEnabled onTeamAuthChange={handleTeamAuthChange} />
      <ChatWidget loginEnabled onCustomerAuthChange={handleCustomerAuthChange} />
    </main>
  );
}
