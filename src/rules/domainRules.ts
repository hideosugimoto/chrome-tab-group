import type { DomainRule } from '../types';

/**
 * Domain rule table — the single source of truth for category mapping.
 *
 * Evaluation order: array order. More specific rules come first
 * (e.g. github.com/.../pull/ before github.com root). The classifier
 * uses Array.prototype.find — no if-else chains.
 *
 * Adding a new service:
 *   - Pick a category.
 *   - Append a row in the matching section. Use anchored host regex.
 *   - If the same host has multiple categories, list the more specific
 *     (path/title-qualified) row above the bare-host row.
 */
export const DOMAIN_RULES: readonly DomainRule[] = [
  // ─── Review (path-qualified GitHub/GitLab/Bitbucket) ──────────────
  { name: 'github-pr', hostMatch: /(^|\.)github\.com$/, pathInclude: /\/pulls?(\/|$)/, category: 'Review' },
  { name: 'github-issues', hostMatch: /(^|\.)github\.com$/, pathInclude: /\/issues(\/|$)/, category: 'Review' },
  { name: 'github-actions', hostMatch: /(^|\.)github\.com$/, pathInclude: /\/actions(\/|$)/, category: 'Cloud' },
  { name: 'github-projects', hostMatch: /(^|\.)github\.com$/, pathInclude: /\/projects(\/|$)/, category: 'Review' },
  // GitLab
  { name: 'gitlab-mr', hostMatch: /(^|\.)gitlab\.com$/, pathInclude: /\/-\/merge_requests(\/|$)/, category: 'Review' },
  { name: 'gitlab-issues', hostMatch: /(^|\.)gitlab\.com$/, pathInclude: /\/-\/issues(\/|$)/, category: 'Review' },
  { name: 'gitlab-pipelines', hostMatch: /(^|\.)gitlab\.com$/, pathInclude: /\/-\/pipelines(\/|$)/, category: 'Cloud' },
  { name: 'gitlab-jobs', hostMatch: /(^|\.)gitlab\.com$/, pathInclude: /\/-\/jobs(\/|$)/, category: 'Cloud' },
  // Bitbucket
  { name: 'bitbucket-pr', hostMatch: /(^|\.)bitbucket\.org$/, pathInclude: /\/pull-requests(\/|$)/, category: 'Review' },
  { name: 'bitbucket-pipelines', hostMatch: /(^|\.)bitbucket\.org$/, pathInclude: /\/addon\/pipelines/, category: 'Cloud' },

  // ─── Review: ticket / project mgmt ────────────────────────────────
  { name: 'jira', hostMatch: /\.atlassian\.net$/, pathInclude: /\/(jira|browse|projects|servicedesk)/, category: 'Review' },
  { name: 'jira-bare', hostMatch: /\.atlassian\.net$/, category: 'Review' },
  { name: 'backlog', hostMatch: /\.backlog\.(com|jp)$/, category: 'Review' },
  { name: 'trello', hostMatch: /(^|\.)trello\.com$/, category: 'Review' },
  { name: 'asana', hostMatch: /(^|\.)asana\.com$/, category: 'Review' },
  { name: 'monday', hostMatch: /(^|\.)monday\.com$/, category: 'Review' },
  { name: 'clickup', hostMatch: /(^|\.)clickup\.com$/, category: 'Review' },
  { name: 'linear', hostMatch: /(^|\.)linear\.app$/, category: 'Review' },
  { name: 'redmine', hostMatch: /(^|\.)redmine\.org$/, category: 'Review' },
  { name: 'youtrack', hostMatch: /\.youtrack\.cloud$/, category: 'Review' },
  { name: 'azure-boards', hostMatch: /(^|\.)dev\.azure\.com$/, pathInclude: /\/_(boards|workitems|backlogs)/, category: 'Review' },
  { name: 'azure-pipelines', hostMatch: /(^|\.)dev\.azure\.com$/, pathInclude: /\/_(build|release|pipelines)/, category: 'Cloud' },

  // ─── Chat ─────────────────────────────────────────────────────────
  { name: 'slack', hostMatch: /(^|\.)slack\.com$/, category: 'Chat' },
  { name: 'teams', hostMatch: /(^|\.)teams\.(microsoft|live)\.com$/, category: 'Chat' },
  { name: 'chatwork', hostMatch: /(^|\.)chatwork\.com$/, category: 'Chat' },
  { name: 'gmail', hostMatch: /(^|\.)mail\.google\.com$/, category: 'Chat' },
  { name: 'gchat', hostMatch: /(^|\.)chat\.google\.com$/, category: 'Chat' },
  { name: 'outlook', hostMatch: /(^|\.)outlook\.(office|live|office365)\.com$/, category: 'Chat' },
  { name: 'discord', hostMatch: /(^|\.)discord\.com$/, category: 'Chat' },
  { name: 'zoom', hostMatch: /(^|\.)zoom\.(us|com)$/, category: 'Chat' },
  { name: 'gmeet', hostMatch: /(^|\.)meet\.google\.com$/, category: 'Chat' },
  { name: 'webex', hostMatch: /(^|\.)webex\.com$/, category: 'Chat' },
  { name: 'lineworks', hostMatch: /(^|\.)worksmobile\.com$/, category: 'Chat' },
  { name: 'mattermost', hostMatch: /(^|\.)mattermost\.com$/, category: 'Chat' },
  { name: 'messenger', hostMatch: /(^|\.)messenger\.com$/, category: 'Chat' },

  // ─── Data: docs.google.com sub-products (must come before Docs) ───
  { name: 'gsheet', hostMatch: /(^|\.)docs\.google\.com$/, pathInclude: /\/spreadsheets\//, category: 'Data' },

  // ─── Docs: docs.google.com docs/presentation/forms + drive ────────
  { name: 'gdoc', hostMatch: /(^|\.)docs\.google\.com$/, pathInclude: /\/document\//, category: 'Docs' },
  { name: 'gslide', hostMatch: /(^|\.)docs\.google\.com$/, pathInclude: /\/presentation\//, category: 'Docs' },
  { name: 'gform', hostMatch: /(^|\.)docs\.google\.com$/, pathInclude: /\/forms\//, category: 'Docs' },
  { name: 'gdrive', hostMatch: /(^|\.)drive\.google\.com$/, category: 'Docs' },
  { name: 'gsites', hostMatch: /(^|\.)sites\.google\.com$/, category: 'Docs' },
  { name: 'notion', hostMatch: /(^|\.)notion\.(so|site)$/, category: 'Docs' },
  { name: 'confluence', hostMatch: /\.atlassian\.net$/, pathInclude: /\/wiki(\/|$)/, category: 'Docs' },
  // SharePoint: split by path keywords.
  { name: 'sharepoint-review', hostMatch: /\.sharepoint\.com$/, pathInclude: /\/(approval|approvals|task|tasks|review|form|forms)(\/|$)/i, category: 'Review' },
  { name: 'sharepoint-docs', hostMatch: /\.sharepoint\.com$/, category: 'Docs' },
  { name: 'onedrive', hostMatch: /(^|\.)onedrive\.live\.com$/, category: 'Docs' },
  { name: 'dropbox-paper', hostMatch: /(^|\.)paper\.dropbox\.com$/, category: 'Docs' },
  { name: 'dropbox', hostMatch: /(^|\.)dropbox\.com$/, category: 'Docs' },
  { name: 'box', hostMatch: /(^|\.)box\.com$/, category: 'Docs' },
  { name: 'coda', hostMatch: /(^|\.)coda\.io$/, category: 'Docs' },
  { name: 'scrapbox', hostMatch: /(^|\.)scrapbox\.io$/, category: 'Docs' },
  { name: 'esa', hostMatch: /(^|\.)esa\.io$/, category: 'Docs' },
  { name: 'kibela', hostMatch: /(^|\.)kibe\.la$/, category: 'Docs' },
  { name: 'qiita-team', hostMatch: /\.qiita\.com$/, pathInclude: /\/teams(\/|$)/, category: 'Docs' },

  // ─── Research ─────────────────────────────────────────────────────
  { name: 'stackoverflow', hostMatch: /(^|\.)stackoverflow\.com$/, category: 'Research' },
  { name: 'stackexchange', hostMatch: /\.stackexchange\.com$/, category: 'Research' },
  { name: 'mdn', hostMatch: /(^|\.)developer\.mozilla\.org$/, category: 'Research' },
  { name: 'devchrome', hostMatch: /(^|\.)developer\.chrome\.com$/, category: 'Research' },
  { name: 'devdocs', hostMatch: /(^|\.)devdocs\.io$/, category: 'Research' },
  { name: 'qiita', hostMatch: /(^|\.)qiita\.com$/, category: 'Research' },
  { name: 'zenn', hostMatch: /(^|\.)zenn\.dev$/, category: 'Research' },
  { name: 'medium', hostMatch: /(^|\.)medium\.com$/, category: 'Research' },
  { name: 'hn', hostMatch: /(^|\.)news\.ycombinator\.com$/, category: 'Research' },
  { name: 'reddit-prog', hostMatch: /(^|\.)reddit\.com$/, pathInclude: /\/r\/(programming|webdev|javascript|typescript|reactjs|node|golang|rust|python|devops|sre|kubernetes)/i, category: 'Research' },
  { name: 'laravel-docs', hostMatch: /(^|\.)laravel\.com$/, pathInclude: /\/docs/, category: 'Research' },
  { name: 'react-docs', hostMatch: /(^|\.)(react\.dev|reactjs\.org)$/, category: 'Research' },
  { name: 'vue-docs', hostMatch: /(^|\.)vuejs\.org$/, category: 'Research' },
  { name: 'next-docs', hostMatch: /(^|\.)nextjs\.org$/, category: 'Research' },
  { name: 'nuxt-docs', hostMatch: /(^|\.)nuxt\.com$/, category: 'Research' },
  { name: 'node-docs', hostMatch: /(^|\.)nodejs\.org$/, category: 'Research' },
  { name: 'python-docs', hostMatch: /(^|\.)docs\.python\.org$/, category: 'Research' },
  { name: 'php-docs', hostMatch: /(^|\.)php\.net$/, category: 'Research' },
  { name: 'docker-docs', hostMatch: /(^|\.)docs\.docker\.com$/, category: 'Research' },
  { name: 'k8s-docs', hostMatch: /(^|\.)kubernetes\.io$/, category: 'Research' },
  { name: 'aws-docs', hostMatch: /(^|\.)docs\.aws\.amazon\.com$/, category: 'Research' },
  { name: 'gcp-docs', hostMatch: /(^|\.)cloud\.google\.com$/, pathInclude: /\/docs(\/|$)/, category: 'Research' },
  { name: 'azure-docs', hostMatch: /(^|\.)learn\.microsoft\.com$/, category: 'Research' },

  // ─── Cloud ────────────────────────────────────────────────────────
  { name: 'aws-console', hostMatch: /(^|\.)console\.aws\.amazon\.com$/, category: 'Cloud' },
  { name: 'aws-signin', hostMatch: /(^|\.)signin\.aws\.amazon\.com$/, category: 'Cloud' },
  { name: 'gcp-console', hostMatch: /(^|\.)console\.cloud\.google\.com$/, category: 'Cloud' },
  { name: 'azure-portal', hostMatch: /(^|\.)portal\.azure\.com$/, category: 'Cloud' },
  { name: 'cloudflare', hostMatch: /(^|\.)(dash\.)?cloudflare\.com$/, category: 'Cloud' },
  { name: 'vercel', hostMatch: /(^|\.)vercel\.com$/, category: 'Cloud' },
  { name: 'netlify', hostMatch: /(^|\.)(app\.)?netlify\.(com|app)$/, category: 'Cloud' },
  { name: 'render', hostMatch: /(^|\.)dashboard\.render\.com$/, category: 'Cloud' },
  { name: 'railway', hostMatch: /(^|\.)railway\.app$/, category: 'Cloud' },
  { name: 'heroku', hostMatch: /(^|\.)dashboard\.heroku\.com$/, category: 'Cloud' },
  { name: 'firebase', hostMatch: /(^|\.)console\.firebase\.google\.com$/, category: 'Cloud' },
  { name: 'supabase', hostMatch: /(^|\.)supabase\.com$/, pathInclude: /\/dashboard/, category: 'Cloud' },
  { name: 'planetscale', hostMatch: /(^|\.)planetscale\.com$/, category: 'Cloud' },
  { name: 'mongo-atlas', hostMatch: /(^|\.)cloud\.mongodb\.com$/, category: 'Cloud' },
  { name: 'datadog', hostMatch: /\.datadoghq\.(com|eu)$/, category: 'Cloud' },
  { name: 'newrelic', hostMatch: /(^|\.)newrelic\.com$/, category: 'Cloud' },
  { name: 'grafana-cloud', hostMatch: /\.grafana\.net$/, category: 'Cloud' },
  { name: 'grafana-host', hostMatch: /(^|\.)grafana\.com$/, category: 'Cloud' },
  { name: 'sentry', hostMatch: /(^|\.)sentry\.io$/, category: 'Cloud' },
  { name: 'kibana-elastic', hostMatch: /\.elastic-cloud\.com$/, category: 'Cloud' },
  { name: 'elastic', hostMatch: /(^|\.)cloud\.elastic\.co$/, category: 'Cloud' },
  { name: 'circleci', hostMatch: /(^|\.)(app\.)?circleci\.com$/, category: 'Cloud' },
  { name: 'travis', hostMatch: /(^|\.)travis-ci\.(com|org)$/, category: 'Cloud' },
  { name: 'argocd', hostMatch: /(^|\.)argoproj\.github\.io$/, category: 'Cloud' },

  // ─── Data ─────────────────────────────────────────────────────────
  { name: 'sheets-bare', hostMatch: /(^|\.)sheets\.google\.com$/, category: 'Data' },
  { name: 'excel-online', hostMatch: /(^|\.)office\.com$/, pathInclude: /\/excel/, category: 'Data' },
  { name: 'airtable', hostMatch: /(^|\.)airtable\.com$/, category: 'Data' },
  { name: 'bigquery', hostMatch: /(^|\.)console\.cloud\.google\.com$/, pathInclude: /\/bigquery/, category: 'Data' },
  { name: 'looker-studio', hostMatch: /(^|\.)lookerstudio\.google\.com$/, category: 'Data' },
  { name: 'looker', hostMatch: /(^|\.)looker\.com$/, category: 'Data' },
  { name: 'tableau', hostMatch: /(^|\.)(online\.)?tableau\.com$/, category: 'Data' },
  { name: 'redash', hostMatch: /(^|\.)redash\.io$/, category: 'Data' },
  { name: 'metabase', hostMatch: /(^|\.)metabase\.com$/, category: 'Data' },
  { name: 'superset', hostMatch: /(^|\.)superset\.apache\.org$/, category: 'Data' },

  // ─── Design ───────────────────────────────────────────────────────
  { name: 'figma', hostMatch: /(^|\.)figma\.com$/, category: 'Design' },
  { name: 'figjam', hostMatch: /(^|\.)figjam\.com$/, category: 'Design' },
  { name: 'miro', hostMatch: /(^|\.)miro\.com$/, category: 'Design' },
  { name: 'excalidraw', hostMatch: /(^|\.)excalidraw\.com$/, category: 'Design' },
  { name: 'canva', hostMatch: /(^|\.)canva\.com$/, category: 'Design' },
  { name: 'whimsical', hostMatch: /(^|\.)whimsical\.com$/, category: 'Design' },
  { name: 'lucid', hostMatch: /(^|\.)lucid\.(app|chart)$/, category: 'Design' },
  { name: 'drawio', hostMatch: /(^|\.)(app\.diagrams\.net|draw\.io|diagrams\.net)$/, category: 'Design' },

  // ─── AI ───────────────────────────────────────────────────────────
  { name: 'chatgpt', hostMatch: /(^|\.)chatgpt\.com$/, category: 'AI' },
  { name: 'openai-chat', hostMatch: /(^|\.)chat\.openai\.com$/, category: 'AI' },
  { name: 'claude', hostMatch: /(^|\.)claude\.(ai|com)$/, category: 'AI' },
  { name: 'gemini', hostMatch: /(^|\.)gemini\.google\.com$/, category: 'AI' },
  { name: 'perplexity', hostMatch: /(^|\.)perplexity\.ai$/, category: 'AI' },
  { name: 'openai-platform', hostMatch: /(^|\.)platform\.openai\.com$/, category: 'AI' },
  { name: 'anthropic-console', hostMatch: /(^|\.)console\.anthropic\.com$/, category: 'AI' },
  { name: 'aistudio', hostMatch: /(^|\.)aistudio\.google\.com$/, category: 'AI' },
  { name: 'azure-openai', hostMatch: /(^|\.)oai\.azure\.com$/, category: 'AI' },
  { name: 'poe', hostMatch: /(^|\.)poe\.com$/, category: 'AI' },
  { name: 'notebooklm', hostMatch: /(^|\.)notebooklm\.google\.com$/, category: 'AI' },
  { name: 'huggingface', hostMatch: /(^|\.)huggingface\.co$/, category: 'AI' },
  { name: 'langsmith', hostMatch: /(^|\.)smith\.langchain\.com$/, category: 'AI' },

  // ─── Dev (last among the named services so qualifiers above win) ──
  { name: 'github-bare', hostMatch: /(^|\.)github\.com$/, category: 'Dev' },
  { name: 'gitlab-bare', hostMatch: /(^|\.)gitlab\.com$/, category: 'Dev' },
  { name: 'bitbucket-bare', hostMatch: /(^|\.)bitbucket\.org$/, category: 'Dev' },
  { name: 'sourcegraph', hostMatch: /(^|\.)sourcegraph\.com$/, category: 'Dev' },
  { name: 'npm', hostMatch: /(^|\.)(www\.)?npmjs\.com$/, category: 'Dev' },
  { name: 'yarn', hostMatch: /(^|\.)yarnpkg\.com$/, category: 'Dev' },
  { name: 'pnpm', hostMatch: /(^|\.)pnpm\.io$/, category: 'Dev' },
  { name: 'packagist', hostMatch: /(^|\.)packagist\.org$/, category: 'Dev' },
  { name: 'pypi', hostMatch: /(^|\.)pypi\.org$/, category: 'Dev' },
  { name: 'rubygems', hostMatch: /(^|\.)rubygems\.org$/, category: 'Dev' },
  { name: 'crates', hostMatch: /(^|\.)crates\.io$/, category: 'Dev' },
  { name: 'docker-hub', hostMatch: /(^|\.)hub\.docker\.com$/, category: 'Dev' },
  { name: 'snyk', hostMatch: /(^|\.)snyk\.io$/, category: 'Dev' },
  { name: 'sonarqube', hostMatch: /(^|\.)sonarcloud\.io$/, category: 'Dev' }
] as const;
