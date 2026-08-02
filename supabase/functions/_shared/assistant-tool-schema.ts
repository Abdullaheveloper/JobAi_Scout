type JsonSchema = Record<string, unknown>;

export function normalizeAssistantToolSchema(value: unknown): JsonSchema {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { type: "object", properties: {}, additionalProperties: false };
  }

  const schema = { ...(value as JsonSchema) };
  if (typeof schema.type !== "string") schema.type = "string";

  if (schema.type === "object") {
    const properties = schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
      ? schema.properties as Record<string, unknown>
      : {};
    schema.properties = Object.fromEntries(
      Object.entries(properties).map(([name, property]) => [name, normalizeAssistantToolSchema(property)]),
    );
    schema.additionalProperties = false;
  }

  if (schema.type === "array") {
    schema.items = normalizeAssistantToolSchema(schema.items || { type: "string" });
  }

  return schema;
}
