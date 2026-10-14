"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatWidget from "@/components/ChatWidget";
import TeamInbox from "@/components/TeamInbox";

type LoginRole = "customer" | "team";

export default function HomePanels() {
  const router = useRouter();
  const [loginRole, setLoginRole] = useState<LoginRole>("customer");
  const [customerSignedIn, setCustomerSignedIn] = useState(false);
  const [teamSignedIn, setTeamSignedIn] = useState(false);

  const onCustomerAuthChange = useCallback((signedIn: boolean, checking: boolean) => {
    if (!checking) setCustomerSignedIn(signedIn);
  }, []);
  const onTeamAuthChange = useCallback((signedIn: boolean) => setTeamSignedIn(signedIn), []);

  useEffect(() => {
    if (teamSignedIn) router.replace("/team");
    else if (customerSignedIn) router.replace("/chat");
  }, [customerSignedIn, router, teamSignedIn]);

  return (
    <main className="workspace-auth-shell">
      <section className="workspace-auth-card" aria-label="Sign in to SurfSync">
        <div className="workspace-auth-brand">
          <span className="workspace-auth-brand-label">SURFSYNC INFOTECH</span>
          <span className="workspace-auth-brand-label">ACCOUNT ACCESS</span>
        </div>

        <div className="workspace-auth-heading">
          <h1>Sign in to your workspace</h1>
          <p>Select the account type you want to access.</p>
        </div>

        <div className="role-switch" role="tablist" aria-label="Choose workspace">
          <button type="button" role="tab" aria-selected={loginRole === "customer"} className={loginRole === "customer" ? "selected" : ""} onClick={() => setLoginRole("customer")}>
            <span className="role-switch-icon" aria-hidden="true">C</span>
            <span><strong>Customer</strong><small>Chat with SurfSync</small></span>
          </button>
          <button type="button" role="tab" aria-selected={loginRole === "team"} className={loginRole === "team" ? "selected" : ""} onClick={() => setLoginRole("team")}>
            <span className="role-switch-icon" aria-hidden="true">T</span>
            <span><strong>Team member</strong><small>Open the team inbox</small></span>
          </button>
        </div>

        <div className="entry-auth-panel" hidden={loginRole !== "customer"}>
          <ChatWidget loginEnabled onCustomerAuthChange={onCustomerAuthChange} />
        </div>
        <div className="entry-auth-panel" hidden={loginRole !== "team"}>
          <TeamInbox embedded loginEnabled onTeamAuthChange={onTeamAuthChange} />
        </div>

      </section>
    </main>
  );
}
