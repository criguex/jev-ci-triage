import type { Basis, FailureClass } from '../types.js';

export const CLASS_LABEL: Record<FailureClass, string> = {
  regression: 'Regression',
  flaky: 'Flaky',
  environment: 'Environment',
  'test-data': 'Test data',
  unknown: 'Unknown',
};

export const CLASS_ACTION: Record<FailureClass, string> = {
  regression: 'Likely a real product defect. Hold the merge and send it to the owner of the changed code.',
  unknown: 'Not enough evidence to decide. A person should look at these first.',
  'test-data': 'The product is probably fine; the test data or fixtures need fixing.',
  environment: 'Infrastructure or a dependency failed. Check the service or runner, not the code.',
  flaky: 'Nondeterministic test. Quarantine it and open a stability ticket. It was not re-run to hide it.',
};

export const BASIS_LABEL: Record<Basis, string> = {
  deterministic: 'rule',
  jev: 'Jev',
  'jev-low-confidence': 'Jev, low confidence',
  unverified: 'unverified',
};

export const CLASS_ORDER: FailureClass[] = ['regression', 'unknown', 'test-data', 'environment', 'flaky'];
