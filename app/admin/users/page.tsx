"use client";

import { useEffect } from "react";
import { isAnyAdmin, useAccess } from "@/lib/access";
import UserManager from "@/components/UserManager";
import { SITE_NAME } from "@/lib/site";

export default function AdminUsersPage() {
  const access = useAccess();

  useEffect(() => {
    document.title = `Users · Admin · ${SITE_NAME}`;
  }, []);

  return (
    <div className="page page-photo">
      <h1>Users</h1>
      {access && !isAnyAdmin(access) ? (
        <p className="hint">Only a competition&rsquo;s admin can add or change users.</p>
      ) : (
        access && (
          <>
            <p className="hint">
              {access.isSuper
                ? "Who runs and scores each competition. Add an admin to run one; admins add their own scorers."
                : "The scorers for the competitions you run."}
            </p>
            <UserManager />
          </>
        )
      )}
    </div>
  );
}
