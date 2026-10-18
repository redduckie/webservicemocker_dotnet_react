export const SOAP_OPERATION_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export function createSoapRequestExample(operationName: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    <${operationName}>
      <!-- Add request parameters here -->
    </${operationName}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renameSoapOperationInRequest(
  requestXml: string,
  oldName: string,
  newName: string
): string {
  if (!requestXml || oldName === newName) return requestXml;

  const operationTag = new RegExp(
    `(<\\/?(?:[A-Za-z_][\\w.-]*:)?)(?:${escapeRegExp(oldName)})(?=[\\s>/])`,
    "g"
  );
  return requestXml.replace(operationTag, `$1${newName}`);
}
