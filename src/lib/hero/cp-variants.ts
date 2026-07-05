export type BranchingOption = {
  id: string;
  next?: string | null;
  next_node_id?: string | null;
};

export type BranchingNode = {
  id: string;
  type?: 'segment' | 'choice' | string;
  node_type?: 'segment' | 'choice' | string;
  next?: string | null;
  options?: BranchingOption[];
  timeout_default?: string | null;
};

export type BranchingScript = {
  start_node_id?: string | null;
  start?: string | null;
  nodes: BranchingNode[];
};

export type CpOptionsVariants = Record<string, Record<string, string[]>>;

export type CpVariantErrorCode =
  | 'missing_choice_variant'
  | 'invalid_subset_length'
  | 'duplicate_option'
  | 'unknown_option'
  | 'not_proper_subset'
  | 'missing_timeout_default'
  | 'unknown_node'
  | 'unreachable_node';

export type CpVariantError = {
  code: CpVariantErrorCode;
  node_id: string;
  detail: string;
};

export type CpVariantValidationResult = {
  ok: boolean;
  errors: CpVariantError[];
};

function nodeKind(node: BranchingNode): string | undefined {
  return node.type ?? node.node_type;
}

function choiceNodes(script: BranchingScript): BranchingNode[] {
  return script.nodes.filter((node) => nodeKind(node) === 'choice' || Array.isArray(node.options));
}

function optionNext(option: BranchingOption): string | null {
  return option.next ?? option.next_node_id ?? null;
}

function addError(
  errors: CpVariantError[],
  code: CpVariantErrorCode,
  nodeId: string,
  detail: string,
): void {
  errors.push({ code, node_id: nodeId, detail });
}

function reachableNodeIds(script: BranchingScript, variants: CpOptionsVariants): Set<string> {
  const nodesById = new Map(script.nodes.map((node) => [node.id, node]));
  const start = script.start_node_id ?? script.start ?? script.nodes[0]?.id;
  const visited = new Set<string>();
  const queue = start ? [start] : [];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodesById.get(nodeId);
    if (!node) continue;

    if (nodeKind(node) === 'choice' || Array.isArray(node.options)) {
      const subset = variants[node.id]?.['2'];
      const allowed = new Set(subset ?? node.options?.map((option) => option.id) ?? []);
      for (const option of node.options ?? []) {
        if (!allowed.has(option.id)) continue;
        const next = optionNext(option);
        if (next && !visited.has(next)) queue.push(next);
      }
      continue;
    }

    if (node.next && !visited.has(node.next)) queue.push(node.next);
  }

  return visited;
}

export function validateCpVariants(
  branchingScript: BranchingScript,
  cpOptionsVariants: CpOptionsVariants,
): CpVariantValidationResult {
  const errors: CpVariantError[] = [];
  const nodesById = new Set(branchingScript.nodes.map((node) => node.id));

  for (const nodeId of Object.keys(cpOptionsVariants)) {
    if (!nodesById.has(nodeId)) {
      addError(errors, 'unknown_node', nodeId, 'variant references an unknown node');
    }
  }

  for (const node of choiceNodes(branchingScript)) {
    const options = node.options ?? [];
    const optionIds = new Set(options.map((option) => option.id));
    const subset = cpOptionsVariants[node.id]?.['2'];

    if (!subset) {
      addError(errors, 'missing_choice_variant', node.id, 'choice node has no "2" subset');
      continue;
    }

    if (subset.length !== 2) {
      addError(errors, 'invalid_subset_length', node.id, '"2" subset must contain exactly two options');
    }

    if (new Set(subset).size !== subset.length) {
      addError(errors, 'duplicate_option', node.id, '"2" subset contains duplicate option ids');
    }

    for (const optionId of subset) {
      if (!optionIds.has(optionId)) {
        addError(errors, 'unknown_option', node.id, `unknown option id: ${optionId}`);
      }
    }

    if (subset.length >= optionIds.size) {
      addError(errors, 'not_proper_subset', node.id, '"2" subset must be a proper subset of options');
    }

    if (node.timeout_default && !subset.includes(node.timeout_default)) {
      addError(
        errors,
        'missing_timeout_default',
        node.id,
        'timeout_default must remain available in the "2" subset',
      );
    }
  }

  const reachable = reachableNodeIds(branchingScript, cpOptionsVariants);
  for (const node of branchingScript.nodes) {
    if (!reachable.has(node.id)) {
      addError(errors, 'unreachable_node', node.id, 'node is unreachable after applying the "2" subset');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
