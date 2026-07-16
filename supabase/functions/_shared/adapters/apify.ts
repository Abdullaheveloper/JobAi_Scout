export async function runApifyActor(actor: string, input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const token = Deno.env.get("APIFY_API_TOKEN");
  if (!token) throw new Error("APIFY_API_TOKEN is missing");
  const actorId = actor.replace("/", "~");
  const start = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!start.ok) throw new Error(`Apify actor start failed (${start.status}): ${await start.text()}`);
  const run = (await start.json()).data;
  for (let attempt = 0; attempt < 80; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const poll = await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${encodeURIComponent(token)}`);
    const data = (await poll.json()).data;
    if (data.status === "SUCCEEDED") {
      const dataset = await fetch(`https://api.apify.com/v2/datasets/${data.defaultDatasetId}/items?token=${encodeURIComponent(token)}`);
      if (!dataset.ok) throw new Error(`Apify dataset fetch failed (${dataset.status})`);
      return await dataset.json();
    }
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(data.status)) throw new Error(`Apify actor ${data.status}: ${data.statusMessage || "No detail"}`);
  }
  throw new Error("Apify actor timed out");
}
