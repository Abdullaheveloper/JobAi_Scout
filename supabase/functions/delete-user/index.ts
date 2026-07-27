import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const STORAGE_BUCKETS = ["resumes", "profile-assets", "voice-history", "voice_audio"] as const;

async function listAllPaths(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const paths: string[] = [];
  const queue = [prefix];

  while (queue.length > 0) {
    const folder = queue.shift()!;
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
    if (error || !data) continue;

    for (const item of data) {
      const full = folder ? `${folder}/${item.name}` : item.name;
      // Folders have null id / metadata in Supabase storage list
      if (!item.id && item.name) {
        queue.push(full);
      } else if (item.name) {
        paths.push(full);
      }
    }
  }

  return paths;
}

async function removeUserStorage(
  admin: ReturnType<typeof createClient>,
  userId: string,
  extraPaths: { bucket: string; path: string }[]
) {
  const removed: string[] = [];

  for (const bucket of STORAGE_BUCKETS) {
    const paths = await listAllPaths(admin, bucket, userId);
    if (paths.length > 0) {
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (!error) removed.push(...paths.map((p) => `${bucket}/${p}`));
    }
  }

  // Also remove any explicit resume/avatar paths that may not be under userId/
  for (const extra of extraPaths) {
    if (!extra.path) continue;
    // Skip if already covered under userId prefix
    if (extra.path.startsWith(`${userId}/`)) continue;
    const { error } = await admin.storage.from(extra.bucket).remove([extra.path]);
    if (!error) removed.push(`${extra.bucket}/${extra.path}`);
  }

  return removed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }

    const callerId = claimsData.claims.sub as string;

    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .single();

    if (callerRole?.role !== "admin") {
      return json({ error: "Forbidden: admin only" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = body?.targetUserId as string | undefined;
    const confirmation = String(body?.confirmation || "").trim();

    if (!targetUserId) {
      return json({ error: "targetUserId is required" }, 400);
    }

    if (targetUserId === callerId) {
      return json({ error: "Cannot delete your own account" }, 400);
    }

    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, full_name, resume_url, avatar_url")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const targetEmail = targetProfile?.email || "";
    const confirmOk =
      confirmation === "Yes, delete permanently" ||
      (targetEmail && confirmation.toLowerCase() === targetEmail.toLowerCase());

    if (!confirmOk) {
      return json({
        error: 'Confirmation required: type the user email or "Yes, delete permanently"',
      }, 400);
    }

    // Block deleting the last remaining admin
    if (targetRole?.role === "admin") {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count || 0) <= 1) {
        return json({ error: "Cannot delete the last remaining admin" }, 400);
      }
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", callerId)
      .maybeSingle();

    // 1) Storage cleanup (before auth delete)
    const extraPaths: { bucket: string; path: string }[] = [];
    if (targetProfile?.resume_url) {
      extraPaths.push({ bucket: "resumes", path: targetProfile.resume_url });
    }
    if (targetProfile?.avatar_url) {
      extraPaths.push({ bucket: "profile-assets", path: targetProfile.avatar_url });
    }
    const storageRemoved = await removeUserStorage(supabaseAdmin, targetUserId, extraPaths);

    // 2) Tables without reliable CASCADE (or email-keyed)
    await supabaseAdmin.from("extension_usage").delete().eq("user_id", targetUserId);
    if (targetEmail) {
      await supabaseAdmin.from("extension_usage").delete().eq("email", targetEmail);
    }
    await supabaseAdmin.from("candidate_notes").delete().or(
      `recruiter_id.eq.${targetUserId},candidate_id.eq.${targetUserId}`
    );
    await supabaseAdmin.from("messages").delete().or(
      `sender_id.eq.${targetUserId},receiver_id.eq.${targetUserId}`
    );

    // Recruiter jobs: delete owned postings (applications cascade from jobs)
    const { data: recruiterJobs } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("recruiter_id", targetUserId);
    if (recruiterJobs?.length) {
      await supabaseAdmin
        .from("jobs")
        .delete()
        .eq("recruiter_id", targetUserId);
    }

    // 3) Audit log BEFORE auth delete (survives user removal — no FK)
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: callerId,
      admin_email: callerProfile?.email || null,
      action: "delete_user",
      target_user_id: targetUserId,
      target_user_email: targetEmail || null,
      metadata: {
        full_name: targetProfile?.full_name || null,
        role: targetRole?.role || null,
        storage_removed: storageRemoved,
        recruiter_jobs_deleted: recruiterJobs?.length || 0,
      },
    });

    // 4) Delete auth user → cascades profiles, roles, applications, etc.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (deleteError) {
      console.error("auth.admin.deleteUser failed:", deleteError);
      return json({ error: deleteError.message }, 500);
    }

    const displayName = targetProfile?.full_name || targetEmail || targetUserId;
    console.log(`Admin ${callerId} permanently deleted user ${targetUserId}`);

    return json({
      success: true,
      targetUserId,
      displayName,
      message: `User ${displayName} and all associated data permanently deleted`,
    });
  } catch (err) {
    console.error("delete-user error:", err);
    return json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
});
