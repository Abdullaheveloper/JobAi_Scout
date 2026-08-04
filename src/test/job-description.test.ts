import { describe, expect, it } from "vitest";
import { plainJobDescription } from "@/lib/job-description";

describe("plainJobDescription", () => {
  it("removes raw HTML while keeping readable spacing", () => {
    expect(plainJobDescription("<p><strong>Headquarters:</strong> Sweden<br />Remote</p>"))
      .toBe("Headquarters: Sweden Remote");
  });

  it("decodes escaped HTML before removing tags", () => {
    expect(plainJobDescription("&lt;p&gt;As long as there have been buildings&lt;/p&gt;"))
      .toBe("As long as there have been buildings");
  });
});
