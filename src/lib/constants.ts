import type { LibItem, Row, Status } from "./types";

export const VALID_CATS = [
  "General",
  "Mechanical",
  "Electrical",
  "Control/PLC",
  "IIoT/SCADA",
  "BMS",
  "Network",
  "Safety",
  "Documentation",
  "Testing",
  "Other",
];

export const STATUS_OPTS: { v: Status; l: string }[] = [
  { v: "comply", l: "✓ Comply" },
  { v: "partial", l: "~ Partial" },
  { v: "notcomply", l: "✗ Not Comply" },
  { v: "na", l: "— N/A" },
];

export const STATUS_LABELS: Record<Status, string> = {
  comply: "Comply",
  partial: "Partially Comply",
  notcomply: "Not Comply",
  na: "N/A",
};

export const STATUS_CLASS: Record<Status, string> = {
  comply: "sts-comply",
  partial: "sts-partial",
  notcomply: "sts-notcomply",
  na: "sts-na",
};

export const STAT_COLORS: Record<Status, string> = {
  comply: "#22c55e",
  partial: "#f0a500",
  notcomply: "#ef4444",
  na: "#5c6480",
};

export const DEFAULT_LIB: LibItem[] = [
  {
    id: "l01",
    label: "Comply — Standard",
    status: "comply",
    text: "Comply. Refer to system design documentation and technical proposal.",
  },
  {
    id: "l02",
    label: "Comply — PLC/TIA Portal",
    status: "comply",
    text: "Comply. Implemented via Siemens TIA Portal programming. Refer to PLC logic documentation.",
  },
  {
    id: "l03",
    label: "Comply — GX Works2",
    status: "comply",
    text: "Comply. Implemented via Mitsubishi GX Works2. Refer to ladder diagram documentation.",
  },
  {
    id: "l04",
    label: "Comply — MQTT",
    status: "comply",
    text: "Comply. Real-time data pipeline configured via MQTT protocol to central SCADA/cloud server.",
  },
  {
    id: "l05",
    label: "Comply — Modbus",
    status: "comply",
    text: "Comply. Hardware communication implemented via Modbus RTU/TCP protocol.",
  },
  {
    id: "l06",
    label: "Comply — BMS",
    status: "comply",
    text: "Comply. Integrated into Building Management System architecture per client specification.",
  },
  {
    id: "l07",
    label: "Comply — SCADA",
    status: "comply",
    text: "Comply. Data acquisition and monitoring interface configured in SCADA system.",
  },
  {
    id: "l08",
    label: "Comply — Thai (มาตรฐาน)",
    status: "comply",
    text: "ปฏิบัติตามข้อกำหนด ดูรายละเอียดในเอกสารการออกแบบระบบและข้อเสนอทางเทคนิค",
  },
  {
    id: "l09",
    label: "Partial — Pending Detail",
    status: "partial",
    text: "Partially comply. Final implementation subject to detailed engineering review and client confirmation.",
  },
  {
    id: "l10",
    label: "Partial — Alternative",
    status: "partial",
    text: "Partially comply. Alternative solution proposed — equivalent performance, different make/model. Pending client approval.",
  },
  {
    id: "l11",
    label: "Not Comply — Out of Scope",
    status: "notcomply",
    text: "Not in scope of this contract. To be confirmed with client during detailed design phase.",
  },
  {
    id: "l12",
    label: "N/A — Not Applicable",
    status: "na",
    text: "Not applicable to this project scope.",
  },
];

// UUID row ids so loaded/imported sessions never collide with a reset counter
// (needed once matrices persist and are loaded from JSON — F1).
export const mkRow = (o: Partial<Row> = {}): Row => ({
  id: crypto.randomUUID(),
  ref: "",
  requirement: "",
  translation: "",
  category: "General",
  status: "comply",
  remarks: "",
  _warn: false,
  ...o,
});
