# use-memory-value

Hooks for global state in memory and localstorage. It's like context, but only one state per value; allows you to subscribe and update values from far away.

## Installation

```bash
yarn add use-memory-value
```

It has the following peerDependencies, along with `react`:

```bash
yarn add localforage react-fast-compare
# assumes react is already installed
```

## Usage

Start by creating a new `MemoryValue` or `StoredMemoryValue`. You can declare this in any file, make sure it's exported and importable from all the files you want to use the value.

```typescript
import { MemoryValue } from 'use-memory-value';

interface State {
  foo: number;
  bar: string;
  baz?: boolean;
}

const INITIAL_STATE: State = {
  foo: 42,
  bar: 'yes',
};

export const MY_STATE = new MemoryValue<State>(INITIAL_STATE);
```

Then, where you want to use the value, import the `MemoryValue` and `useMemoryValue`:

```tsx
import { useMemoryValue, useMutableMemoryValue } from 'use-memory-value';

import { MY_STATE } from '../path/to/state';

export function ReadOnlyBar() {
  const state = useMemoryValue(MY_STATE);

  if (state.baz) {
    return <span>actually foo: {state && state.foo}</span>;
  }

  return <span>bar: {state && state.bar}</span>;
}

export function CountingFoo() {
  const [state, setState] = useMutableMemoryValue(MY_STATE);
  const increment = () =>
    setState((prev) =>
      // Increment foo, unless there is no previous value.
      prev ? { ...prev, foo: prev.foo + 1 } : { foo: 13, bar: 'no' }
    );

  return (
    <button type="button" onPress={increment}>
      Foo: {state.foo}
    </button>
  );
}

export function ActivateBaz() {
  const [, setState] = useMutableMemoryValue(MY_STATE);
  const activate = () => setState((prev) => ({ ...prev, baz: true }));

  return (
    <button type="button" onPress={activate}>
      Activate
    </button>
  );
}
```
