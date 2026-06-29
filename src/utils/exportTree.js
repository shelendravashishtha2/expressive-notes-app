import { getSections, slugify } from './text.js';

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

function firstArray(...values) {
  return values.find((value) => Array.isArray(value)) || [];
}

function topicMarkdown(topic = {}) {
  return firstString(
    topic.content,
    topic.body_markdown,
    topic.bodyMarkdown,
    topic.markdown,
    topic.markdown_body,
    topic.rawText,
    topic.raw_text,
    topic.body,
    topic.text,
    topic.md
  );
}

function sectionMarkdownValue(section = {}) {
  return firstString(
    section.rawText,
    section.raw_text,
    section.markdown,
    section.content,
    section.body,
    section.bodyMarkdown,
    section.body_markdown,
    section.markdown_body,
    section.text,
    section.md
  );
}

function topicGroupLabel(topic) {
  return topic.group || topic.domain || 'Reference';
}

function normalizeSection(section = {}) {
  const title = section.title || section.heading || section.name || section.sectionTitle || section.section_title || 'Untitled section';
  return {
    ...section,
    id: section.id || section.sectionId || section.section_id || section.slug || section.sectionSlug || section.section_slug || slugify(title) || 'section',
    title,
    level: Number(section.level || section.depth || section.headingLevel || section.heading_level || 2),
    rawText: sectionMarkdownValue(section)
  };
}

function sectionCompletenessScore(sections = [], topic = {}) {
  if (!sections.length) return 0;

  const normalized = sections.map(normalizeSection);
  const bodyCount = normalized.filter((section) => section.rawText?.trim()).length;
  const nestedCount = normalized.filter((section) => Number(section.level) > 2).length;
  const uniqueLevels = new Set(normalized.map((section) => Number(section.level) || 2)).size;
  const onlyTopicShell = normalized.length === 1
    && slugify(normalized[0].title) === slugify(topic.title || '')
    && !normalized[0].rawText?.trim();

  return (normalized.length * 6)
    + (bodyCount * 3)
    + (nestedCount * 2)
    + uniqueLevels
    - (onlyTopicShell ? 100 : 0);
}

function flattenProvidedSections(sections = [], parentLevel = 1) {
  return sections.flatMap((section = {}) => {
    const ownLevel = Number(
      section.level
      || section.depth
      || section.headingLevel
      || section.heading_level
      || parentLevel + 1
      || 2
    );
    const children = firstArray(
      section.children,
      section.subsections,
      section.sections,
      section.items,
      section.headings,
      section.toc
    );

    return [
      { ...section, level: ownLevel },
      ...flattenProvidedSections(children, ownLevel)
    ];
  });
}

function providedTopicSections(topic = {}) {
  return flattenProvidedSections(firstArray(
    topic.sections,
    topic.section_tree,
    topic.sectionTree,
    topic.headings,
    topic.toc,
    topic.children,
    topic.subsections,
    topic.items
  ));
}

function rebuildMarkdownFromProvidedSections(sections = []) {
  return sections
    .map((section) => {
      const normalized = normalizeSection(section);
      const level = Math.max(2, Math.min(6, Number(normalized.level) || 2));
      const body = sectionMarkdownValue(section).trim();
      if (body) return body;
      return `${'#'.repeat(level)} ${normalized.title}`;
    })
    .filter(Boolean)
    .join('\n\n');
}


function topicSections(topic = {}) {
  const flattenedProvidedSections = providedTopicSections(topic);
  const providedSections = flattenedProvidedSections.filter((section, index) => {
    if (index !== 0 || flattenedProvidedSections.length <= 1) return true;
    const normalized = normalizeSection(section);
    return slugify(normalized.title) !== slugify(topic.title || '') || Boolean(normalized.rawText?.trim());
  });
  const markdown = topicMarkdown(topic) || rebuildMarkdownFromProvidedSections(providedSections);
  const parsedSections = markdown ? getSections(markdown) : [];

  if (!providedSections.length) return parsedSections;
  if (!parsedSections.length) return providedSections;

  const providedScore = sectionCompletenessScore(providedSections, topic);
  const parsedScore = sectionCompletenessScore(parsedSections, topic);

  // Some remote topics arrive with a single placeholder/root section while the
  // actual Markdown body already contains the full heading tree. Prefer the
  // parsed body tree whenever it is clearly richer so export/custom selection
  // does not collapse to an unusable 0/1 topic row.
  return parsedScore >= providedScore ? parsedSections : providedSections;
}

function createGroupId(label, groupNodes) {
  const base = slugify(label) || 'reference';
  let id = `group:${base}`;
  let suffix = 2;
  while (groupNodes.has(id)) {
    id = `group:${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function createSectionId(topicId, section, existingIds) {
  const base = section.id || slugify(section.title) || 'section';
  let id = `section:${topicId}:${base}`;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `section:${topicId}:${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function appendSectionNodes(topicNode, topic, sections, nodesById, sectionNodesByKey) {
  const stack = [{ node: topicNode, level: 1 }];
  const existingIds = new Set();

  sections.map(normalizeSection).forEach((section) => {
    const sectionNode = {
      id: createSectionId(topic.id, section, existingIds),
      type: 'section',
      label: section.title,
      topicId: topic.id,
      sectionId: section.id,
      level: section.level,
      section,
      children: []
    };

    existingIds.add(sectionNode.id);

    while (stack.length > 1 && stack[stack.length - 1].level >= section.level) {
      stack.pop();
    }

    stack[stack.length - 1].node.children.push(sectionNode);
    stack.push({ node: sectionNode, level: section.level });

    nodesById.set(sectionNode.id, sectionNode);
    sectionNodesByKey.set(`${topic.id}:${section.id}`, sectionNode);
  });
}

export function buildExportTree(topics = []) {
  const root = {
    id: 'export:all',
    type: 'root',
    label: 'All Notes',
    children: []
  };

  const nodesById = new Map([[root.id, root]]);
  const topicNodesByTopicId = new Map();
  const sectionNodesByKey = new Map();
  const groupNodesByLabel = new Map();
  const groupNodesById = new Map();
  const expandableIds = [];

  topics.forEach((topic) => {
    if (!topic?.id) return;

    const groupLabel = topicGroupLabel(topic);
    let groupNode = groupNodesByLabel.get(groupLabel);

    if (!groupNode) {
      groupNode = {
        id: createGroupId(groupLabel, groupNodesById),
        type: 'group',
        label: groupLabel,
        children: []
      };
      groupNodesByLabel.set(groupLabel, groupNode);
      groupNodesById.set(groupNode.id, groupNode);
      nodesById.set(groupNode.id, groupNode);
      root.children.push(groupNode);
    }

    const topicNode = {
      id: `topic:${topic.id}`,
      type: 'topic',
      label: topic.title || 'Untitled topic',
      topicId: topic.id,
      group: groupLabel,
      domain: topic.domain,
      summary: topic.summary || '',
      children: []
    };

    appendSectionNodes(topicNode, topic, topicSections(topic), nodesById, sectionNodesByKey);

    groupNode.children.push(topicNode);
    nodesById.set(topicNode.id, topicNode);
    topicNodesByTopicId.set(topic.id, topicNode);
  });

  const assignSelectableIds = (node) => {
    const ownSelectableId = node.type === 'topic' || node.type === 'section' ? node.id : null;
    const childSelectableIds = (node.children || []).flatMap(assignSelectableIds);
    const selectableIds = Array.from(new Set([ownSelectableId, ...childSelectableIds].filter(Boolean)));

    if (node.children?.length) expandableIds.push(node.id);

    node.selectableIds = selectableIds;
    node.leafIds = selectableIds;
    node.topicNodeIds = node.type === 'topic'
      ? [node.id]
      : (node.children || []).flatMap((child) => child.topicNodeIds || []);
    node.totalLeaves = selectableIds.length;

    return selectableIds;
  };

  assignSelectableIds(root);

  return {
    root,
    nodesById,
    topicNodesByTopicId,
    sectionNodesByKey,
    expandableIds,
    leafIds: root.selectableIds || []
  };
}

function selectableIdsForNode(node) {
  return Array.from(new Set(node?.selectableIds || []));
}

function topicSelectionIdFor(selectionId = '') {
  if (!selectionId.startsWith('section:')) return null;
  const [, topicId] = selectionId.split(':');
  return topicId ? `topic:${topicId}` : null;
}

function isSelectionIdChecked(selectionId, selectedSet) {
  if (selectedSet.has(selectionId)) return true;
  const topicSelectionId = topicSelectionIdFor(selectionId);
  return Boolean(topicSelectionId && selectedSet.has(topicSelectionId));
}

export function getNodeSelectionState(node, selectedSet = new Set()) {
  const selectableIds = selectableIdsForNode(node);
  const selectedCount = selectableIds.reduce(
    (count, id) => count + (isSelectionIdChecked(id, selectedSet) ? 1 : 0),
    0
  );
  const totalCount = selectableIds.length || node.totalLeaves || 0;

  return {
    checked: totalCount > 0 && selectedCount === totalCount,
    indeterminate: selectedCount > 0 && selectedCount < totalCount,
    selectedCount,
    totalCount
  };
}

function expandTopicSelectionBeforePartialUncheck(tree, next, node) {
  if (node.type !== 'section' || !node.topicId) return;
  const topicNode = tree.topicNodesByTopicId.get(node.topicId);
  if (!topicNode || !next.has(topicNode.id)) return;

  next.delete(topicNode.id);
  selectableIdsForNode(topicNode).forEach((id) => {
    if (id !== topicNode.id) next.add(id);
  });
}

export function applyNodeSelection(tree, selectedIds, nodeId, checked) {
  const node = tree.nodesById.get(nodeId);
  if (!node) return [...selectedIds];

  const next = new Set(selectedIds);

  if (!checked) {
    expandTopicSelectionBeforePartialUncheck(tree, next, node);
  }

  selectableIdsForNode(node).forEach((id) => {
    if (checked) next.add(id);
    else next.delete(id);
  });

  if (!checked && node.type === 'section' && node.topicId) {
    next.delete(`topic:${node.topicId}`);
  }

  return Array.from(next);
}

export function createSelectionForAll(tree) {
  return Array.from(new Set(tree.root?.selectableIds || tree.leafIds || []));
}

export function clearSelection() {
  return [];
}

export function createSelectionForTopic(tree, topicId) {
  const node = tree.topicNodesByTopicId.get(topicId);
  return node ? selectableIdsForNode(node) : [];
}

export function createSelectionForSection(tree, topicId, sectionId) {
  if (!sectionId || sectionId === 'overview') {
    return createSelectionForTopic(tree, topicId);
  }

  const node = tree.sectionNodesByKey.get(`${topicId}:${sectionId}`);
  return node ? selectableIdsForNode(node) : createSelectionForTopic(tree, topicId);
}

function sectionMarkdown(section = {}) {
  return sectionMarkdownValue(section);
}

function selectedSectionIdsForTopic(tree, topicNode, selectedSet) {
  return new Set(
    (topicNode.selectableIds || [])
      .filter((id) => id.startsWith(`section:${topicNode.topicId}:`) && selectedSet.has(id))
      .map((id) => tree.nodesById.get(id)?.sectionId)
      .filter(Boolean)
  );
}

export function buildExportPlan(topics, tree, selectedIds, scopeLabel = 'Custom selection') {
  const selectedSet = new Set(selectedIds);
  const documents = [];
  let selectedSectionCount = 0;

  topics.forEach((topic) => {
    const topicNode = tree.topicNodesByTopicId.get(topic.id);
    if (!topicNode) return;

    const directTopicSelected = selectedSet.has(topicNode.id);
    const topicSelectableIds = topicNode.selectableIds || [];
    const selectedTopicIds = topicSelectableIds.filter((id) => selectedSet.has(id));
    if (!selectedTopicIds.length && !directTopicSelected) return;

    const sections = topicSections(topic).map(normalizeSection);
    const selectedSectionNodeIds = selectedSectionIdsForTopic(tree, topicNode, selectedSet);
    const allSectionIds = (topicNode.selectableIds || [])
      .filter((id) => id.startsWith(`section:${topic.id}:`));
    const allSectionsSelected = allSectionIds.length > 0 && allSectionIds.every((id) => selectedSet.has(id));
    const includeFullTopic = directTopicSelected || allSectionsSelected;
    const chosenSections = includeFullTopic
      ? sections
      : sections.filter((section) => selectedSectionNodeIds.has(section.id));

    selectedSectionCount += chosenSections.length;

    const selectedMarkdown = chosenSections
      .map(sectionMarkdown)
      .filter(Boolean)
      .join('\n\n');

    documents.push({
      topicId: topic.id,
      topicTitle: topic.title,
      topicGroup: topicGroupLabel(topic),
      domain: topic.domain,
      summary: topic.summary || '',
      sourceFiles: topic.sourceFiles || [],
      anchorId: `export-topic-${topic.id}`,
      markdown: includeFullTopic || !selectedMarkdown
        ? (topicMarkdown(topic) || selectedMarkdown || '')
        : selectedMarkdown,
      includeFullTopic,
      tocSections: includeFullTopic ? sections : chosenSections
    });
  });

  const selectedTopicCount = documents.length;
  const summaryText = selectedSectionCount
    ? `${selectedTopicCount} topics and ${selectedSectionCount} sections`
    : `${selectedTopicCount} topics`;

  return {
    scopeLabel,
    documents,
    selectedLeafCount: selectedSet.size,
    selectedTopicCount,
    selectedSectionCount,
    summaryText
  };
}
