import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, popup, api, content, manifestSource] = await Promise.all([
  readFile(new URL("./popup.html", import.meta.url), "utf8"),
  readFile(new URL("./popup.js", import.meta.url), "utf8"),
  readFile(new URL("./api.js", import.meta.url), "utf8"),
  readFile(new URL("./content.js", import.meta.url), "utf8"),
  readFile(new URL("./manifest.json", import.meta.url), "utf8"),
]);
const manifest = JSON.parse(manifestSource);

for (const id of ["resumeBadge", "resumeInput", "resumeUploadBtn", "resumeUploadLabel", "resumeHelp"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `popup must include #${id}`);
}
for (const id of ["resumeDownloadBtn", "profileImageBadge", "profileImageInput", "profileImageUploadBtn", "profileImageHelp"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `popup must include #${id}`);
}
assert.match(html, /accept=["'][^"']*\.pdf[^"']*\.docx/i, "resume picker must accept PDF and DOCX");
assert.match(popup, /api\.uploadResume\(session, file\)/, "popup must upload the selected resume");
assert.match(popup, /profileService\.loadProfile\(session, true\)/, "popup must refresh the saved profile");
assert.match(api, /storage\/v1\/object\/resumes\//, "API must upload to the private resumes bucket");
assert.match(api, /resume_url:\s*filePath/, "API must save the private resume path to the profile");
assert.match(api, /uploadProfileImage/, "API must support private profile-image upload");
assert.match(api, /profile-assets/, "profile images must use the private profile-assets bucket");
assert.match(api, /avatar_url:\s*filePath/, "API must save the private profile-image path");
assert.ok(manifest.host_permissions.some((permission) => /\.supabase\.co\/\*$/.test(permission)), "manifest must authorize the configured private storage host");
assert.match(content, /new DataTransfer\(\)/, "standard file inputs must receive the downloaded resume");
assert.match(content, /storedFileName/, "attachments must preserve their real extension for ATS validation");
assert.match(content, /google-file-picker-required/, "Google Forms Drive pickers must remain a manual review step");
assert.match(content, /downloadSavedResume/, "Google Forms review must let the user prepare the saved resume");
assert.match(content, /findGoogleFilePicker/, "Google Forms review must guide the user to its protected picker");

console.log("Resume upload contract tests passed.");
