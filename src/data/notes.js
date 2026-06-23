import { curatedNotes as baseNotes } from './baseNotes.js';
import { coreDeepNotes } from './coreDeepNotes.js';
import { generatedSourceNotes } from './generatedSourceNotes.js';
import { expandedDeepNotes } from './expandedDeepNotes.js';
import { flattenText, getSections, normalizeMarkdownContent } from '../utils/text.js';
import { appendTopicDepth, cleanGeneratedNoteLanguage } from './topicDepthEnhancements.js';

const mergeTargets = {
  'core-aws-s3-buckets': 'aws-s3',
  'core-aws-s3-eventbridge': 'aws-eventbridge',
  'core-aws-lambda-deep-dive': 'aws-lambda',
  'core-aws-ecs-fargate': 'aws-ecs-fargate',
  'core-aws-eks-kubernetes': 'aws-eks-kubernetes',
  'core-aws-load-balancers': 'aws-load-balancers',
  'core-aws-stepfunctions-large-file': 'aws-step-functions',
  'core-aws-dynamodb': 'aws-dynamodb',
  'core-aws-rds-aurora': 'aws-rds-aurora',
  'legacy-aws-iam': 'aws-iam',
  'legacy-aws-terraform': 'aws-terraform',
  'legacy-react-rtk-query': 'redux-rtk-query',
  'legacy-flask-fastapi-middleware': 'flask-middleware',
  'legacy-fastapi-body-response': 'fastapi-request-handling',
  'legacy-postgresql-sql': 'databases-postgresql',
  'legacy-ttl-caching-sideeffects': 'python-ttl-caching',
  'legacy-aws-integrated-architecture': 'aws-service-selection-guide',
  'source-fullstack-flask-from-scratch-to-production-patterns': 'flask-fundamentals',
  'source-fullstack-fastapi-from-scratch-to-advanced-patterns': 'fastapi-fundamentals',
  'source-fullstack-redux-toolkit-and-rtk-query-practical-deep-notes': 'redux-rtk-query',
  'source-fullstack-react-from-scratch-components-state-lifecycles-with-hooks': 'react-fundamentals',
  'source-fullstack-react-advanced-performance-refs-context-routing-auth': 'react-performance',
  'source-fullstack-postgresql-schema-design-indexes-transactions-query-tuning': 'databases-postgresql',
  'source-fullstack-sqs-queuing-deep-dive-visibility-timeout-dlq-fifo-idempotency-and-lambda-consume': 'aws-sqs',
  'source-fullstack-aws-scaling-scenarios-lambda-sqs-glue-and-event-driven-pipelines': 'aws-service-selection-guide',
  'source-awslead-part-c-lambda-deep-dive': 'aws-lambda',
  'source-awslead-part-d-s3-deep-dive': 'aws-s3',
  'source-awslead-part-e-messaging-and-event-driven-architecture': 'aws-sns-sqs-fanout',
  'source-awslead-part-f-api-gateway-and-python-apis': 'aws-api-gateway',
  'source-awslead-part-g-databases-on-aws': 'aws-rds-aurora',
  'source-awslead-part-h-aws-glue-and-etl': 'aws-glue',
  'source-awslead-part-i-containers-ec2-ecs-eks': 'aws-ecs-fargate',
  'source-awslead-part-j-observability-and-production-debugging': 'aws-cloudwatch',
  'source-awslead-part-l-deployment-ci-cd-iac': 'aws-terraform',
  'source-awslead-part-v2-f-step-functions-deep-dive': 'aws-step-functions'
};

const titleMap = {
  'aws-iam': 'IAM',
  'aws-terraform': 'Terraform on AWS',
  'flask-fastapi-middleware': 'Flask and FastAPI Middleware',
  'fastapi-body-response': 'FastAPI APIs',
  'react-rtk-query': 'RTK Query',
  'postgresql-sql': 'PostgreSQL',
  'ttl-caching-sideeffects': 'TTL Caching and Side Effects',
  'aws-integrated-architecture': 'AWS Integrated Architecture',
  'genai-langchain-agents': 'RAG, LangChain and Agents'
};

const domainMap = {
  'aws-iam': 'AWS Security',
  'aws-terraform': 'AWS Infrastructure as Code',
  'flask-fastapi-middleware': 'Backend APIs',
  'fastapi-body-response': 'Backend APIs',
  'react-rtk-query': 'React/Redux',
  'postgresql-sql': 'Databases',
  'ttl-caching-sideeffects': 'Python',
  'aws-integrated-architecture': 'AWS Architecture',
  'genai-langchain-agents': 'GenAI'
};

function inferGroup(note) {
  const text = `${note.group || ''} ${note.domain || ''} ${note.title || ''}`.toLowerCase();
  if (text.includes('javascript') || text.includes('ecmascript')) return 'JavaScript';
  if (text.includes('typescript') || text.includes('tsx')) return 'TypeScript';
  if (text.includes('css') || text.includes('flexbox') || text.includes('grid layout') || text.includes('tailwind')) return 'CSS';
  if (text.includes('aws') || text.includes('cloud')) return 'AWS';
  if (text.includes('flask')) return 'Flask';
  if (text.includes('fastapi')) return 'FastAPI';
  if (text.includes('redux') || text.includes('rtk')) return 'Redux';
  if (text.includes('react')) return 'React';
  if (text.includes('frontend') || text.includes('jinja') || text.includes('cors')) return 'Frontend Concepts';
  if (text.includes('backend') || text.includes('api') || text.includes('auth') || text.includes('microservice')) return 'Backend Concepts';
  if (text.includes('postgres') || text.includes('sql') || text.includes('database') || text.includes('mongodb') || text.includes('redis')) return 'Databases';
  if (text.includes('docker') || text.includes('kubernetes') || text.includes('deployment') || text.includes('ci') || text.includes('devops')) return 'DevOps';
  if (text.includes('python') || text.includes('asyncio') || text.includes('dunder')) return 'Python';
  return note.group || note.domain || 'Reference';
}

function normalizeLegacyBase(note) {
  const patched = {
    ...note,
    id: `legacy-${note.id}`,
    title: titleMap[note.id] || note.title,
    domain: domainMap[note.id] || note.domain,
    group: inferGroup({ ...note, title: titleMap[note.id] || note.title, domain: domainMap[note.id] || note.domain }),
    content: `# ${titleMap[note.id] || note.title}\n\n${note.content}`,
  };
  return patched;
}

const legacyBase = baseNotes
  .filter((note) => Object.keys(titleMap).includes(note.id))
  .map(normalizeLegacyBase);

const allOriginalNotes = [
  ...coreDeepNotes,
  ...legacyBase,
  ...generatedSourceNotes.map((note) => ({ ...note, group: inferGroup(note) }))
];

function shortSource(note) {
  const content = note.content || '';
  if (content.length < 120000) return content;
  return `${content.slice(0, 120000)}\n\n> Source note truncated inside merged topic to protect browser performance. The complete extracted note remains available as its own source/reference topic.`;
}

const byId = new Map(expandedDeepNotes.map((note) => [note.id, { ...note }]));
const consumed = new Set();

for (const note of allOriginalNotes) {
  const targetId = mergeTargets[note.id];
  if (targetId && byId.has(targetId)) {
    const target = byId.get(targetId);
    target.content = `${target.content}\n\n---\n\n## Source expansion: ${note.title}\n\n${shortSource(note)}`;
    target.sourceFiles = Array.from(new Set([...(target.sourceFiles || []), ...(note.sourceFiles || []), note.id]));
    consumed.add(note.id);
  }
}

const referenceNotes = allOriginalNotes
  .filter((note) => !consumed.has(note.id))
  .map((note) => ({
    ...note,
    group: inferGroup(note),
    domain: note.domain || inferGroup(note),
    title: note.title,
    content: note.content?.startsWith('#') ? note.content : `# ${note.title}\n\n${note.content || ''}`
  }));

const groupOrder = ['AWS', 'Python', 'Flask', 'FastAPI', 'JavaScript', 'React', 'Redux', 'CSS', 'TypeScript', 'Frontend Concepts', 'Backend Concepts', 'Databases', 'DevOps', 'GenAI', 'Reference', 'Start Here', 'Practice Plan', 'Interview Q&A', 'Architecture'];
const topicOrder = [
  'frontend-javascript-deep-dive',
  'react-react-fundamentals','source-fullstack-react-from-scratch-components-state-lifecycles-with-hooks','react-hooks','react-rendering','source-fullstack-react-lifecycle-properly-render-commit-effects-cleanup-and-strict-mode','source-fullstack-react-virtual-dom-reconciliation-keys-memoization-and-intersectionobserver','react-forms','react-routing','react-api-integration','react-performance','core-react-render-performance','react-production-patterns-deep-dive','react-interview-questions',
  'redux-redux-fundamentals','redux-redux-toolkit','redux-createslice','redux-createasyncthunk','redux-rtk-query','redux-createapi','redux-cache-invalidation','source-fullstack-redux-lifecycle-properly-store-dispatch-reducers-middleware-async-thunks-and-rtk','redux-redux-interview-questions',
  'frontend-css-deep-dive',
  'frontend-typescript-deep-dive','source-fullstack-typescript-for-full-stack-react',
  'aws-s3','aws-eventbridge','aws-sns','aws-sqs','aws-sns-sqs-fanout','aws-lambda','aws-step-functions','aws-iam','aws-api-gateway','aws-load-balancers','aws-ecs-fargate','aws-eks-kubernetes','aws-glue','aws-dynamodb','aws-rds-aurora','aws-cloudwatch','aws-terraform','aws-service-selection-guide','aws-large-file-processing'
];

function depthAppendix(note, content) {
  return appendTopicDepth(note, cleanGeneratedNoteLanguage(note, content));
}

function enhance(note) {
  const group = note.group || inferGroup(note);
  const baseContent = normalizeMarkdownContent(cleanGeneratedNoteLanguage({ ...note, group }, note.content || ''));
  const content = normalizeMarkdownContent(depthAppendix({ ...note, group }, baseContent));
  const sections = getSections(content);
  return {
    ...note,
    content,
    group,
    domain: note.domain || group,
    sections,
    searchText: flattenText({ ...note, group, content })
  };
}

const seen = new Set();
const all = [...byId.values(), ...referenceNotes]
  .filter((note) => {
    if (!note?.id || seen.has(note.id)) return false;
    seen.add(note.id);
    return true;
  })
  .map(enhance)
  .sort((a, b) => {
    const ga = groupOrder.indexOf(a.group);
    const gb = groupOrder.indexOf(b.group);
    if ((ga === -1 ? 999 : ga) !== (gb === -1 ? 999 : gb)) return (ga === -1 ? 999 : ga) - (gb === -1 ? 999 : gb);
    const ta = topicOrder.indexOf(a.id);
    const tb = topicOrder.indexOf(b.id);
    if ((ta === -1 ? 9999 : ta) !== (tb === -1 ? 9999 : tb)) return (ta === -1 ? 9999 : ta) - (tb === -1 ? 9999 : tb);
    return a.title.localeCompare(b.title);
  });

export const curatedNotes = all;
export const groupOrderPreference = groupOrder;
