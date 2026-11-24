import { appendFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

const { GH_TOKEN, ACTIONS_ID_TOKEN_REQUEST_URL, ACTIONS_ID_TOKEN_REQUEST_TOKEN,
  GITHUB_API_URL, GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_OUTPUT, PAGES_ARTIFACT_ID } = process.env;
const artifact = Number(PAGES_ARTIFACT_ID);
if (!Number.isSafeInteger(artifact) || artifact < 1) throw new Error("Pages artifact ID is missing");

async function request(url, token, body) {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}: ${data.message ?? "request failed"}`);
  return data;
}

const { value: oidc } = await request(ACTIONS_ID_TOKEN_REQUEST_URL, ACTIONS_ID_TOKEN_REQUEST_TOKEN);
if (!oidc) throw new Error("GitHub did not return an OIDC token");
const deployments = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/pages/deployments`;
const { id, page_url } = await request(deployments, GH_TOKEN, {
  artifact_id: artifact, pages_build_version: GITHUB_SHA, oidc_token: oidc,
});
if (!id) throw new Error("GitHub did not return a Pages deployment ID");

for (let attempt = 0; attempt < 60; attempt++) {
  const { status } = await request(`${deployments}/${encodeURIComponent(id)}`, GH_TOKEN);
  if (status === "succeed") {
    await appendFile(GITHUB_OUTPUT, `page_url=${page_url}\n`);
    console.log(`Published ${page_url}`);
    process.exit(0);
  }
  if (!["queued", "in_progress", "pending", "deployment_in_progress", "deployment_queued", "syncing"].includes(status)) {
    throw new Error(`Pages deployment ended with status: ${status}`);
  }
  await setTimeout(5000);
}
throw new Error("Timed out waiting for GitHub Pages");
