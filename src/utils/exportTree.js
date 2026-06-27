import { getSections, slugify } from './text.js';

function topicGroupLabel(topic) {
  return topic.group || topic.domain || 'Reference';
}

function topicSections(topic) {
  return topic.sections?.length ? topic.sections : getSections(topic.content || '');
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
  const groupNodes = new Map();
  const expandableIds = [];

  topics.forEach((topic) => {
    const groupLabel = topicGroupLabel(topic);
    let groupNode = groupNodes.get(groupLabel);

    if (!groupNode) {
      groupNode = {
        id: `group:${slugify(groupLabel) || 'reference'}`,
        type: 'group',
        label: groupLabel,
        children: []
      };
      groupNodes.set(groupLabel, groupNode);
      nodesById.set(groupNode.id, groupNode);
      root.children.push(groupNode);
    }

    const topicNode = {
      id: `topic:${topic.id}`,
      type: 'topic',
      label: topic.title,
      topicId: topic.id,
      group: groupLabel,
      domain: topic.domain,
      summary: topic.summary || '',
      children: []
    };

    const sections = topicSections(topic);
    sections.forEach((section) => {
      const sectionNode = {
        id: `section:${topic.id}:${section.id}`,
        type: 'section',
        label: section.title,
        topicId: topic.id,
        sectionId: section.id,
        level: section.level,
        children: []
      };
      topicNode.children.push(sectionNode);
      nodesById.set(sectionNode.id, sectionNode);
      sectionNodesByKey.set(`${topic.id}:${section.id}`, sectionNode);
    });

    groupNode.children.push(topicNode);
    nodesById.set(topicNode.id, topicNode);
    topicNodesByTopicId.set(topic.id, topicNode);
  });

  const assignLeaves = (node) => {
    if (!node.children?.length) {
      node.leafIds = [node.id];
      node.topicNodeIds = node.type === 'topic' ? [node.id] : [];
      node.totalLeaves = 1;
      return node.leafIds;
    }

    expandableIds.push(node.id);
    node.leafIds = node.children.flatMap(assignLeaves);
    node.topicNodeIds = node.children.flatMap((child) => child.topicNodeIds || []);
    if (node.type === 'topic' && !node.topicNodeIds.includes(node.id)) {
      node.topicNodeIds = [node.id, ...node.topicNodeIds];
    }
    node.totalLeaves = node.leafIds.length;
    return node.leafIds;
  };

  assignLeaves(root);

  return {
    root,
    nodesById,
    topicNodesByTopicId,
    sectionNodesByKey,
    expandableIds,
    leafIds: root.leafIds
  };
}

function selectableIdsForNode(node) {
  return Array.from(new Set([
    ...(node.leafIds || []),
    ...(node.topicNodeIds || []),
    node.type === 'topic' ? node.id : null
  ].filter(Boolean)));
}

export function getNodeSelectionState(node, selectedSet = new Set()) {
  const selectableIds = selectableIdsForNode(node);
  const selectedCount = selectableIds.reduce(
    (count, id) => count + (selectedSet.has(id) ? 1 : 0),
    0
  );
  const directTopicSelected = node.type === 'topic' && selectedSet.has(node.id);
  const totalCount = selectableIds.length || node.totalLeaves || 0;

  return {
    checked: directTopicSelected || (selectedCount > 0 && selectedCount === totalCount),
    indeterminate: !directTopicSelected && selectedCount > 0 && selectedCount < totalCount,
    selectedCount,
    totalCount
  };
}

export function applyNodeSelection(tree, selectedIds, nodeId, checked) {
  const node = tree.nodesById.get(nodeId);
  if (!node) return [...selectedIds];

  const next = new Set(selectedIds);
  selectableIdsForNode(node).forEach((id) => {
    if (checked) next.add(id);
    else next.delete(id);
  });

  return Array.from(next);
}

export function createSelectionForAll(tree) {
  const topicIds = Array.from(tree.topicNodesByTopicId?.values?.() || []).map((node) => node.id);
  return Array.from(new Set([...(tree.leafIds || []), ...topicIds]));
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
  return node ? [node.id] : createSelectionForTopic(tree, topicId);
}

export function buildExportPlan(topics, tree, selectedIds, scopeLabel = 'Custom selection') {
  const selectedSet = new Set(selectedIds);
  const documents = [];
  let selectedSectionCount = 0;

  topics.forEach((topic) => {
    const topicNode = tree.topicNodesByTopicId.get(topic.id);
    if (!topicNode) return;

    const directTopicSelected = selectedSet.has(topicNode.id);
    const selectedLeafIds = directTopicSelected
      ? [...(topicNode.leafIds || [])]
      : (topicNode.leafIds || []).filter((leafId) => selectedSet.has(leafId));
    if (!selectedLeafIds.length && !directTopicSelected) return;

    const sections = topicSections(topic);
    const includeFullTopic = directTopicSelected || selectedLeafIds.length === (topicNode.leafIds || []).length;
    const chosenSections = includeFullTopic
      ? sections
      : sections.filter((section) => selectedSet.has(`section:${topic.id}:${section.id}`));

    selectedSectionCount += chosenSections.length;

    documents.push({
      topicId: topic.id,
      topicTitle: topic.title,
      topicGroup: topicGroupLabel(topic),
      domain: topic.domain,
      summary: topic.summary || '',
      sourceFiles: topic.sourceFiles || [],
      anchorId: `export-topic-${topic.id}`,
      markdown: includeFullTopic || !chosenSections.length
        ? (topic.content || '')
        : chosenSections.map((section) => section.rawText).join('\n\n'),
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
