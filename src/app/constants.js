export const MAX_AUTOMOD_RULES = 5;
export const MAX_WORDS = 250;
export const MAX_REGEXES = 10;

// LHS (AI Moderation) constants
export const LHS_CATEGORIES = [
  { id: "dangerous_content", name: "Dangerous Content", description: "Content promoting dangerous or illegal activities" },
  { id: "hate_speech", name: "Hate Speech", description: "Content attacking protected groups" },
  { id: "harassment", name: "Harassment", description: "Content targeting individuals for harassment" },
  { id: "sexually_explicit", name: "Sexually Explicit", description: "Sexual or NSFW content" },
  { id: "toxicity", name: "Toxicity", description: "General toxic behavior" },
  { id: "severe_toxicity", name: "Severe Toxicity", description: "Extremely toxic or hateful content" },
  { id: "threat", name: "Threat", description: "Threats of violence or harm" },
  { id: "insult", name: "Insult", description: "Personal insults or attacks" },
  { id: "identity_attack", name: "Identity Attack", description: "Attacks based on identity characteristics" },
  { id: "phish", name: "Phishing", description: "Phishing attempts or suspicious links" },
  { id: "spam", name: "Spam", description: "Spam or repetitive unwanted content" },
];

export const DEFAULT_LHS_THRESHOLD = 0.55;
export const LHS_THRESHOLD_MIN = 0.0;
export const LHS_THRESHOLD_MAX = 1.0;
export const LHS_THRESHOLD_STEP = 0.01;

// Image Moderation constants
export const IMAGE_MOD_FILTERS = [
  { id: "general", name: "General", description: "General non-NSFW content detection", defaultThreshold: 0.2 },
  { id: "sensitive", name: "Sensitive", description: "Mildly sensitive content", defaultThreshold: 0.8 },
  { id: "questionable", name: "Questionable", description: "Borderline inappropriate content", defaultThreshold: 0.2 },
  { id: "explicit", name: "Explicit", description: "Explicit NSFW content", defaultThreshold: 0.2 },
  { id: "guro", name: "Gore/Violence", description: "Graphic violence and gore", defaultThreshold: 0.3 },
  { id: "realistic", name: "Realistic", description: "Photorealistic image detection", defaultThreshold: 0.25 },
  { id: "csam_check", name: "Possible-CSAM Check", description: "Possible-CSAM detection", defaultThreshold: 0.09 },
];

export const IMAGE_MOD_ACTIONS = ["delete", "warn", "kick", "ban"];

// All filters disabled by default (user must explicitly enable)
// Each filter has its own action (delete, warn, kick, ban)
export const DEFAULT_IMAGE_MOD_SETTINGS = {
  enabled: false,
  scan_attachments: true,
  scan_embeds: true,
  filters: {
    general: { enabled: false, threshold: 0.2, action: "delete" },
    sensitive: { enabled: false, threshold: 0.8, action: "delete" },
    questionable: { enabled: false, threshold: 0.2, action: "delete" },
    explicit: { enabled: false, threshold: 0.2, action: "delete" },
    guro: { enabled: false, threshold: 0.3, action: "delete" },
    realistic: { enabled: false, threshold: 0.25, action: "delete" },
    csam_check: { enabled: false, threshold: 0.09, action: "ban" },
  },
  log_only_mode: false,
};

export const STATUS_TEXT = {
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Payload Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a teapot",
  421: "Misdirected Request",
  422: "Unprocessable Content",
  423: "Locked",
  424: "Failed Dependency",
  425: "Too Early",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  451: "Unavailable For Legal Reasons",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  508: "Loop Detected",
  510: "Not Extended",
  511: "Network Authentication Required",
};

export const NAV_LINKS = [
  { path: "/", label: "Home", exact: true },
  { path: "/pages/terms.html", label: "Terms", exact: true },
  { path: "/pages/privacy.html", label: "Privacy", exact: true },
  { path: "/pages/contributors.html", label: "Contributors", exact: true },
];
