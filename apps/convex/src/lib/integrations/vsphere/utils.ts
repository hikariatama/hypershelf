"use node";

type XmlNodeList = {
  length: number;
  item(index: number): XmlNode | null;
};

export type XmlNode = {
  nodeType: number;
  nodeName: string;
  localName?: string | null;
  nodeValue?: string | null;
  childNodes: XmlNodeList;
};

export type XmlElement = XmlNode & {
  localName?: string | null;
  getAttribute(name: string): string | null;
};

export function envelope(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:vim25="urn:vim25" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <soapenv:Body>
    ${inner}
  </soapenv:Body>
</soapenv:Envelope>`;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isElement(n: XmlNode): n is XmlElement {
  return n.nodeType === 1;
}

export function elementsByLocalName(
  root: XmlNode,
  local: string,
): XmlElement[] {
  const out: XmlElement[] = [];
  const stack: XmlNode[] = [root];
  while (stack.length) {
    const n = stack.pop();
    if (
      n &&
      isElement(n) &&
      (n.localName === local || n.nodeName.split(":").pop() === local)
    )
      out.push(n);
    if (n) {
      for (let i = 0; i < n.childNodes.length; i++) {
        const child = n.childNodes.item(i);
        if (child) stack.push(child);
      }
    }
  }
  return out;
}

export function firstChildByLocalName(
  el: XmlElement,
  local: string,
  maxDepth = 1,
): XmlElement | null {
  if (maxDepth <= 0) {
    return null;
  }

  const childElements: XmlElement[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes.item(i);
    if (n && isElement(n)) {
      if (n.localName === local || n.nodeName.split(":").pop() === local) {
        return n;
      }
      childElements.push(n);
    }
  }

  if (maxDepth > 1) {
    for (const child of childElements) {
      const found = firstChildByLocalName(child, local, maxDepth - 1);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

export function text(n: XmlNode): string {
  const walker: XmlNode[] = [n];
  let s = "";
  while (walker.length) {
    const cur = walker.pop();
    if (cur?.nodeType === 3) s += cur.nodeValue ?? "";
    if (cur) {
      for (let i = 0; i < cur.childNodes.length; i++) {
        const child = cur.childNodes.item(i);
        if (child) walker.push(child);
      }
    }
  }
  return s;
}

export function childrenByLocalName(
  node: XmlElement,
  local: string,
): XmlElement[] {
  const out: XmlElement[] = [];
  const kids = node.childNodes;
  for (let i = 0; i < kids.length; i += 1) {
    const k = kids.item(i);
    if (k && isElement(k) && k.localName === local) out.push(k);
  }
  return out;
}

export function parseIsoToMillis(s: string): number {
  if (!s) return 0;
  const m = /^(.+\.\d{3})\d+Z$/.exec(s);
  const t = m ? `${m[1]}Z` : s;
  const n = Date.parse(t);
  return Number.isNaN(n) ? 0 : n;
}
