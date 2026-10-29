/** Keep opaque database identifiers intact while removing contact/date strings. */
export function redactCoachContext(value: string) {
  const uuid =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
  const redact = (text: string) =>
    text
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email removed]")
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "[date removed]")
      .replace(/(?:\+?\d[\s().-]*){10,}/g, "[phone removed]");
  let end = 0,
    result = "";
  for (const match of value.matchAll(uuid)) {
    result += redact(value.slice(end, match.index)) + match[0];
    end = match.index! + match[0].length;
  }
  return result + redact(value.slice(end));
}
