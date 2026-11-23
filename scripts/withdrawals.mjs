import fs from 'node:fs';

const registry = new URL('../data/withdrawn-artists.json', import.meta.url);
const validHandle = /^[a-z0-9_]{1,15}$/;
export const withdrawnHandles = new Set(JSON.parse(fs.readFileSync(registry, 'utf8')));

export function isWithdrawnHandle(handle) {
  return withdrawnHandles.has(String(handle ?? '').toLowerCase());
}

export function approveWithdrawals(approvalPages) {
  for (const issue of approvalPages.flat()) {
    if (issue.pull_request) continue;
    for (const label of issue.labels ?? []) {
      // Only the maintainer-controlled label sets the identity to withdraw.
      // An issue author's editable title and body are never used for approval.
      const handle = label.name.match(/^withdraw:@([a-zA-Z0-9_]{1,15})$/)?.[1]?.toLowerCase();
      if (handle && validHandle.test(handle)) withdrawnHandles.add(handle);
    }
  }
  fs.writeFileSync(registry, JSON.stringify([...withdrawnHandles].sort(), null, 2) + '\n');
}
