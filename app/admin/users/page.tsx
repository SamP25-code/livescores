"use client";

import { useEffect } from "react";
import { useAdminRole } from "@/lib/auth";
import UserManager from "@/components/UserManager";

export default function AdminUsersPage() {
  const role = useAdminRole();

  useEffect(() => {
    document.title = "Users · Admin · Penwortham Singles";
  }, []);

  return (
    <div className="page page-photo">
      <h1>Users</h1>
      {role === "scorer" ? (
        <p className="hint">Only an admin can add or change users.</p>
      ) : (
        role === "owner" && (
          <>
            <p className="hint">
              Everyone who can sign in to the admin side. A changed role takes effect the next time that person
              signs in (or within the hour).
            </p>
            <UserManager />
          </>
        )
      )}
    </div>
  );
}
